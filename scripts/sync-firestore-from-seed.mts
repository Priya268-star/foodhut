/**
 * Reconciles the live Firestore database with `src/data/seed-data.ts`.
 *
 * Why this exists
 * ---------------
 * `npm run seed` needs Admin SDK credentials (a service-account key or
 * application-default credentials), which a Firebase CLI login does not provide,
 * so the seed script cannot be re-run casually. That used to mean a change to the
 * seed data - a renamed dish, a corrected image path - could only be made by hand
 * in the console, and image paths in particular drift easily: a dish whose photo
 * becomes a real file is stored in Firestore as `.svg`, and editing the seed alone
 * leaves the deployed app pointing at a file that no longer exists.
 *
 * This script closes that gap. The OAuth token from `firebase login` is a project
 * owner credential and does carry `cloud-platform` scope, so the Firestore REST
 * API is reachable with it - unlike Service Usage and Cloud Storage, which the
 * same token is rejected by.
 *
 * It is deliberately a *reconciliation*, not a wipe-and-reload:
 *   - restaurants are patched field by field, so `ownerId`, ratings and anything
 *     a user has since changed are left alone
 *   - menu items are created when missing and patched when they differ
 *   - nothing is deleted, because an order references the dish it was placed for
 *
 * Run with --apply to write. Without it, this only prints what it would change.
 *
 *   node --experimental-strip-types scripts/sync-firestore-from-seed.mts
 *   node --experimental-strip-types scripts/sync-firestore-from-seed.mts --apply
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { SEED_RESTAURANTS } from '../src/data/seed-data.ts';

const ROOT = process.cwd();
const PROJECT_ID = process.env['FIREBASE_PROJECT_ID'] ?? 'foodhut-zomato-clone';
const HOST = 'https://firestore.googleapis.com';
const BASE = `${HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const APPLY = process.argv.includes('--apply');

/** Restaurant fields that must match the seed. Everything else is left alone. */
const RESTAURANT_SYNC_FIELDS = ['name', 'description', 'imageUrl', 'coverImageUrl', 'cuisines'] as const;

/**
 * Dish fields owned by the seed.
 *
 * `isAvailable` is in this list on purpose: `fetchMenu` queries
 * `where('isAvailable', '==', true)`, so a dish created without it is written to
 * the database correctly and then never shown to anybody. `rating` and
 * `ratingCount` drift legitimately once real orders come in, but they are seeded
 * values the menu card renders, so leaving them unset would show a blank score.
 */
const DISH_SYNC_FIELDS = [
  'restaurantId',
  'name',
  'description',
  'price',
  'imageUrl',
  'category',
  'isVeg',
  'isAvailable',
  'rating',
  'ratingCount',
  'sortOrder',
] as const;

interface SeedDish {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  isVeg: boolean;
  isAvailable: boolean;
  rating: number;
  ratingCount: number;
  sortOrder: number;
}

interface SeedRestaurant {
  id: string;
  name: string;
  description: string;
  cuisines: string[];
  imageUrl: string;
  coverImageUrl: string;
  [key: string]: unknown;
}

/* ------------------------------ credentials ------------------------------ */

interface Token {
  access_token: string;
  expires_at: number;
}

function readToken(): Token {
  const path = resolve(homedir(), '.config', 'configstore', 'firebase-tools.json');
  let parsed: { tokens?: { access_token?: string; expires_at?: number } };
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`Cannot read the Firebase CLI login at ${path}. Run: npx firebase login`);
  }
  const access = parsed.tokens?.access_token;
  const expires = parsed.tokens?.expires_at ?? 0;
  if (!access) throw new Error('No access token stored. Run: npx firebase login');
  return { access_token: access, expires_at: expires };
}

const token = readToken();
/* expires_at is in milliseconds. */
if (Date.now() / 1000 > token.expires_at) {
  console.log('Stored token has expired; run `npx firebase projects:list` to refresh it, then re-run.');
  process.exit(1);
}

const headers: Record<string, string> = {
  Authorization: `Bearer ${token.access_token}`,
  'Content-Type': 'application/json',
};

/* ---------------------------- Firestore values --------------------------- */

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { arrayValue: { values: FirestoreValue[] } };

function toValue(input: unknown): FirestoreValue {
  if (typeof input === 'string') return { stringValue: input };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') {
    return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  }
  if (Array.isArray(input)) return { arrayValue: { values: input.map(toValue) } };
  throw new Error(`Unsupported value type: ${typeof input}`);
}

function fromValue(value: Record<string, unknown>): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    const inner = (value.arrayValue as { values?: Record<string, unknown>[] }).values ?? [];
    return inner.map(fromValue);
  }
  return undefined;
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${response.status}: ${body.slice(0, 300)}`);
  }
  if (response.status === 204) return undefined;
  return response.json();
}

/**
 * A missing document is an expected outcome, not an error: the whole point of
 * this pass is to discover which documents still need creating.
 */
async function readDocIfExists(path: string): Promise<Doc | undefined> {
  const response = await fetch(`${BASE}/${path}`, { headers });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return (await response.json()) as Doc;
}

/**
 * Builds the field mask for a patch.
 *
 * Two forms are rejected by `projects.databases.documents.patch`: a bare
 * `updateMask=a,b` is refused as "Cannot bind query parameter" because updateMask
 * is a message type, and the comma-joined string is not a field-path list at all.
 * The documented query form is `updateMask.fieldPaths`, repeated once per field.
 */
const mask = (fields: readonly string[]) =>
  fields.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');

interface Doc {
  name: string;
  fields: Record<string, Record<string, unknown>>;
}

const readDoc = readDocIfExists;

async function listDocs(path: string): Promise<Doc[]> {
  const all: Doc[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ pageSize: '200' });
    if (pageToken) query.set('pageToken', pageToken);
    const body = (await api(`/${path}?${query}`)) as { documents?: Doc[]; nextPageToken?: string };
    all.push(...(body.documents ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return all;
}

/** Creates the document when absent, otherwise patches only the differing fields. */
async function writeDoc(
  path: string,
  desired: Record<string, unknown>,
  syncFields: readonly string[],
  label: string,
): Promise<'created' | 'updated' | 'unchanged' | 'dry-run'> {
  const current = await readDocIfExists(path);
  const payload = Object.fromEntries(
    syncFields.filter((f) => desired[f] !== undefined).map((f) => [f, toValue(desired[f])]),
  );

  if (!current) {
    if (!APPLY) {
      console.log(`    would create ${label}`);
      return 'dry-run';
    }
    await api(`/${path}?${mask(syncFields)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: payload }),
    });
    console.log(`    created  ${label}`);
    return 'created';
  }

  const changed = syncFields.filter((f) => {
    const have = current.fields[f] === undefined ? undefined : fromValue(current.fields[f]);
    return JSON.stringify(have) !== JSON.stringify(desired[f]);
  });

  if (changed.length === 0) return 'unchanged';

  const detail = changed
    .map((f) => `${f}: ${JSON.stringify(current.fields[f] ? fromValue(current.fields[f]) : null)} -> ${JSON.stringify(desired[f])}`)
    .join('; ');

  if (!APPLY) {
    console.log(`    would update ${label}\n              ${detail}`);
    return 'dry-run';
  }

  await api(`/${path}?${mask(changed)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: Object.fromEntries(changed.map((f) => [f, toValue(desired[f])])),
    }),
  });
  console.log(`    updated  ${label}\n              ${detail}`);
  return 'updated';
}

/* --------------------------------- run ---------------------------------- */

console.log(`project : ${PROJECT_ID}`);
console.log(`mode    : ${APPLY ? 'APPLY (writes to Firestore)' : 'DRY RUN - nothing will be written'}`);
console.log('');

for (const restaurant of SEED_RESTAURANTS as unknown as SeedRestaurant[]) {
  console.log(`  ${restaurant.name}  (${restaurant.id})`);

  await writeDoc(
    `restaurants/${restaurant.id}`,
    restaurant as unknown as Record<string, unknown>,
    RESTAURANT_SYNC_FIELDS,
    'restaurant',
  );

  const existing = await listDocs(`restaurants/${restaurant.id}/menu`);
  const byId = new Map(existing.map((d) => [d.name.split('/').pop() ?? '', d]));
  const seedDishes = (restaurant.menu as unknown as SeedDish[] | undefined) ?? [];

  for (const dish of seedDishes) {
    /*
     * `restaurantId` is derived from the document path rather than written in
     * `seed-data.ts` - a dish cannot live in one restaurant's menu and belong to
     * another - so it is filled in here instead.
     */
    const desired = { restaurantId: restaurant.id, ...dish } as unknown as Record<string, unknown>;

    await writeDoc(
      `restaurants/${restaurant.id}/menu/${dish.id}`,
      desired,
      DISH_SYNC_FIELDS,
      `dish ${dish.id} "${dish.name}"`,
    );
  }

  for (const [docId, doc] of byId) {
    if (!seedDishes.some((d) => d.id === docId)) {
      console.log(`    kept     dish ${docId} "${fromValue(doc.fields.name) ?? ''}" (not in the seed; left in place)`);
    }
  }
  console.log('');
}

console.log(APPLY ? 'Done - Firestore now matches the seed data.' : 'Dry run complete. Re-run with --apply to write.');
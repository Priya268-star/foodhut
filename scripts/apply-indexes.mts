/**
 * Creates the composite indexes in `firestore.indexes.json` directly via the
 * Firestore REST API.
 *
 * Why not `firebase deploy --only firestore:indexes`? The CLI creates indexes
 * as one batch and aborts the entire deploy on the first rejection — including
 * on `409 already exists`, which happens routinely while Firestore settles a
 * previous create/delete. Posting one at a time and tolerating that response
 * is idempotent and lets the rest of the set land.
 *
 *   run: npm run indexes:apply
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = process.env['FIREBASE_PROJECT_ID'] ?? 'foodhut-zomato-clone';
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;

function readToken(): string {
  for (const path of [
    join(process.env['APPDATA'] ?? '', 'configstore', 'firebase-tools.json'),
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
  ]) {
    try {
      const t = JSON.parse(readFileSync(path, 'utf8')) as { tokens?: { access_token?: string } };
      if (t.tokens?.access_token) return t.tokens.access_token;
    } catch {
      /* next */
    }
  }
  throw new Error('no firebase-tools.json — run `firebase login`');
}

const token = readToken();
const { indexes } = JSON.parse(
  readFileSync(resolve(process.cwd(), 'firestore.indexes.json'), 'utf8'),
) as { indexes: Array<{ collectionGroup: string; queryScope: string; fields: unknown[] }> };

const label = (fields: unknown[]) =>
  fields
    .map((f) => {
      const g = f as { fieldPath: string; order?: string; arrayConfig?: string };
      return g.arrayConfig ? `${g.fieldPath}~` : `${g.fieldPath}:${(g.order ?? 'ASC')[0]}`;
    })
    .join(',');

let created = 0;
let existing = 0;
const failed: string[] = [];

for (const index of indexes) {
  const response = await fetch(`${ROOT}/collectionGroups/${index.collectionGroup}/indexes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // `collectionGroup` is not part of the Index resource — omit it.
    body: JSON.stringify({ queryScope: index.queryScope, fields: index.fields }),
  });

  if (response.ok) {
    created += 1;
    continue;
  }

  const text = await response.text();
  if (response.status === 409 || /already exists/i.test(text)) {
    existing += 1;
    continue;
  }

  const message = /"message"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? text.slice(0, 120);
  failed.push(`${index.collectionGroup}: ${label(index.fields)}\n    ${message}`);
}

console.log(`created: ${created}   already present: ${existing}   failed: ${failed.length}`);
if (failed.length > 0) {
  console.log('\nfailed:');
  for (const f of failed) console.log(`  ${f}`);
  process.exitCode = 1;
}

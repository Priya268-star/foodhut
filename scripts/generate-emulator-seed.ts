/**
 * Generates `emulator-data/firestore-seed.json` in the Firestore emulator's
 * export format, so `firebase emulators:start` comes up with a populated
 * database — no Admin SDK, no credentials, works offline.
 *
 * Run:  npm run seed:emulator
 *
 * Unlike `scripts/seed.ts` this touches no credentials at all, which is why it
 * is the recommended way to get a working local environment.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SEED_OWNER, SEED_RESTAURANTS } from '../src/data/seed-data.ts';

/* ------------------------------ Firestore Value --------------------------- */

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

/** Converts a JS value into the Firestore emulator's export representation. */
function toValue(input: unknown): FirestoreValue {
  if (input === null || input === undefined) return { nullValue: null };

  /*
   * Checked *before* the primitive switch. A Date is an object, so it would
   * otherwise fall through to the map branch and be exported as a mapValue —
   * giving the document a string/map field where the app expects a real
   * Firestore Timestamp.
   */
  if (input instanceof Date) {
    return { timestampValue: input.toISOString() };
  }

  switch (typeof input) {
    case 'string':
      return { stringValue: input };
    case 'boolean':
      return { booleanValue: input };
    case 'number':
      // Firestore stores all numbers as doubles; integers are emitted as
      // integerValue so a round trip does not turn `3` into `3.0`.
      return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
    default:
      break;
  }

  if (Array.isArray(input)) {
    return { arrayValue: { values: input.map(toValue) } };
  }

  return { mapValue: { fields: toFields(input as Record<string, unknown>) } };
}

function toFields(record: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    fields[key] = toValue(value);
  }
  return fields;
}

/* --------------------------------- documents ------------------------------- */

/*
 * A `Date`, not an ISO string — `toValue` maps Date -> timestampValue, which
 * is what the emulator needs. The exported `createTime`/`updateTime` are
 * separate envelope fields and stay strings.
 */
const NOW = new Date();
const NOW_ISO = NOW.toISOString();

interface ExportedDocument {
  document: {
    name: string;
    fields: Record<string, FirestoreValue>;
    createTime: string;
    updateTime: string;
  };
}

function doc(path: string, fields: Record<string, unknown>): ExportedDocument {
  return {
    document: {
      name: path,
      fields: toFields(fields),
      // The envelope timestamps are RFC-3339 strings in the export format.
      createTime: NOW_ISO,
      updateTime: NOW_ISO,
    },
  };
}

/* ----------------------------------- build --------------------------------- */

const documents: ExportedDocument[] = [];

documents.push(
  doc(`users/${SEED_OWNER.uid}`, {
    uid: SEED_OWNER.uid,
    displayName: SEED_OWNER.displayName,
    email: SEED_OWNER.email,
    photoURL: null,
    phone: SEED_OWNER.phone,
    // Owner status is derived from `restaurants.ownerId`, so nothing to store.
    role: 'customer',
    createdAt: NOW,
    updatedAt: NOW,
  }),
  // One sample address, as its own document (see the addresses rules block).
  doc(`users/${SEED_OWNER.uid}/addresses/seed-addr-1`, {
    id: 'seed-addr-1',
    label: 'Home',
    line1: 'Flat 402, Green Residency',
    line2: 'Near MG Road',
    city: 'Bengaluru',
    postalCode: '560001',
    phone: SEED_OWNER.phone,
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
  }),
);

for (const restaurant of SEED_RESTAURANTS) {
  const { menu, ...fields } = restaurant;

  documents.push(
    doc(`restaurants/${restaurant.id}`, {
      ...fields,
      ownerId: SEED_OWNER.uid,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );

  for (const item of menu) {
    documents.push(
      doc(`restaurants/${restaurant.id}/menu/${item.id}`, {
        ...item,
        restaurantId: restaurant.id,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  }
}

const exportPayload = {
  kind: 'firestore#export',
  database: '(default)',
  data: documents,
};

const outDir = resolve(process.cwd(), 'emulator-data');
mkdirSync(outDir, { recursive: true });

const outFile = resolve(outDir, 'firestore-seed.json');
writeFileSync(outFile, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');

console.log(`[seed:emulator] wrote ${documents.length} documents to ${outFile}`);
console.log(
  `[seed:emulator] ${SEED_RESTAURANTS.length} restaurants, ` +
    `${SEED_RESTAURANTS.reduce((sum, r) => sum + r.menu.length, 0)} dishes, 1 owner`,
);

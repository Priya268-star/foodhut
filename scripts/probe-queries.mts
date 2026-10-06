/**
 * Runs the exact queries `fetchRestaurants` builds, against a live project, and
 * reports which ones Firestore can serve.
 *
 * Run with the emulator or a real project:
 *   FIREBASE_PROJECT_ID=foodhut-zomato-clone node scripts/probe-queries.mts
 *
 * Useful when the app shows `failed-precondition`, which means exactly one
 * thing (a missing index) but does not say which — this names it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = process.env['FIREBASE_PROJECT_ID'] ?? 'foodhut-zomato-clone';
const KEY = process.env['FIREBASE_API_KEY'];
const HOST = process.env['FIRESTORE_EMULATOR_HOST'];
const ROOT = HOST
  ? `http://${HOST}/v1/projects/${PROJECT}/databases/(default)`
  : `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;

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
  return '';
}

/** Builds the structuredQuery the same way `fetchRestaurants` composes one. */
const from = [{ collectionId: 'restaurants' }];
const relevance = [
  { field: { fieldPath: 'isFeatured' }, direction: 'DESCENDING' },
  { field: { fieldPath: 'rating' }, direction: 'DESCENDING' },
  { field: { fieldPath: '__name__' }, direction: 'DESCENDING' },
];

interface Case {
  label: string;
  where?: Record<string, unknown>[];
  orderBy: Record<string, unknown>[];
}

const CASES: Case[] = [
  { label: 'relevance (home default)', orderBy: relevance },
  {
    label: 'rating sort',
    orderBy: [
      { field: { fieldPath: 'rating' }, direction: 'DESCENDING' },
      { field: { fieldPath: '__name__' }, direction: 'DESCENDING' },
    ],
  },
  {
    label: 'deliveryTime sort',
    orderBy: [
      { field: { fieldPath: 'deliveryTimeMinutes' }, direction: 'ASCENDING' },
      { field: { fieldPath: '__name__' }, direction: 'DESCENDING' },
    ],
  },
  {
    label: 'deliveryFee sort',
    orderBy: [
      { field: { fieldPath: 'deliveryFee' }, direction: 'ASCENDING' },
      { field: { fieldPath: '__name__' }, direction: 'DESCENDING' },
    ],
  },
  {
    label: 'cuisine=Pizza + relevance',
    where: [
      {
        fieldFilter: {
          field: { fieldPath: 'cuisines' },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: 'Pizza' },
        },
      },
    ],
    orderBy: relevance,
  },
  {
    label: 'priceLevel in [1,2] + relevance',
    where: [
      {
        fieldFilter: {
          field: { fieldPath: 'priceLevel' },
          op: 'EQUAL',
          value: { integerValue: '1' },
        },
      },
    ],
    orderBy: relevance,
  },
  {
    label: 'isOpen=true + relevance',
    where: [
      {
        fieldFilter: { field: { fieldPath: 'isOpen' }, op: 'EQUAL', value: { booleanValue: true } },
      },
    ],
    orderBy: relevance,
  },
];

const headers: Record<string, string> = { 'Content-Type': 'application/json' };
const token = readToken();
if (token) headers['Authorization'] = `Bearer ${token}`;
const url = `${ROOT}/documents:runQuery${KEY ? `?key=${KEY}` : ''}`;

let failures = 0;

for (const testCase of CASES) {
  const structuredQuery: Record<string, unknown> = {
    from,
    orderBy: testCase.orderBy,
    limit: 31,
  };
  if (testCase.where)
    structuredQuery['where'] = { compositeFilter: { op: 'AND', filters: testCase.where } };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ structuredQuery }),
  });

  const text = await response.text();

  if (response.ok) {
    // Without the streaming content type, runQuery returns one JSON array.
    const rows = JSON.parse(text) as Array<{
      document?: { fields?: Record<string, { stringValue?: string }> };
    }>;
    const docs = rows.filter((row) => row.document);
    console.log(`OK    ${testCase.label.padEnd(28)} ${String(docs.length).padStart(2)} docs`);
    for (const d of docs.slice(0, 6)) {
      console.log(`        ${d.document!.fields?.['name']?.stringValue}`);
    }
  } else {
    failures += 1;
    const message = /"message"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? text.slice(0, 120);
    console.log(`FAIL  ${testCase.label.padEnd(28)} ${message.slice(0, 100)}`);
  }
}

console.log(`\n${CASES.length - failures}/${CASES.length} queries served`);
void resolve;

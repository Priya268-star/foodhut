/**
 * One-off: seed a live project from emulator-data/firestore-seed.json using the
 * Firebase CLI's OAuth token, via the Firestore REST :commit endpoint.
 *
 * IAM-authenticated REST requests bypass security rules, which is what makes
 * this equivalent to the Admin SDK without needing a service-account key.
 * This is deploy-time convenience only — the documented, repeatable path is
 * `npm run seed` with a service account.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'foodhut-zomato-clone';
const DB = '(default)';
const PARENT = `projects/${PROJECT}/databases/${DB}/documents`;

/* --- CLI token ----------------------------------------------------------- */

function readToken(): string {
  const candidates = [
    join(process.env['APPDATA'] ?? '', 'configstore', 'firebase-tools.json'),
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
  ];
  for (const path of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
        tokens?: { access_token?: string };
      };
      const token = parsed.tokens?.access_token;
      if (token) {
        console.log(`token: ${path}`);
        return token;
      }
    } catch {
      // try the next candidate
    }
  }
  throw new Error('Could not find firebase-tools.json — run `firebase login` first.');
}

/* --- convert export documents to REST writes ----------------------------- */

type FirestoreValue = Record<string, unknown>;

interface ExportedDoc {
  document: { name: string; fields: Record<string, FirestoreValue> };
}

const seed = JSON.parse(
  readFileSync(resolve(process.cwd(), 'emulator-data/firestore-seed.json'), 'utf8'),
) as { data: ExportedDoc[] };

const writes = seed.data.map((entry) => ({
  update: {
    name: `${PARENT}/${entry.document.name}`,
    fields: entry.document.fields,
  },
}));

/* --- commit in batches (REST caps writes per request) -------------------- */

const BATCH = 200;
const token = readToken();
const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents:commit`;

let written = 0;

for (let i = 0; i < writes.length; i += BATCH) {
  const chunk = writes.slice(i, i + BATCH);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes: chunk }),
  });

  if (!response.ok) {
    console.error(`batch at ${i} failed: ${response.status} ${await response.text()}`);
    process.exit(1);
  }

  written += chunk.length;
  console.log(`  wrote ${written}/${writes.length}`);
}

console.log(`\nseeded ${written} documents into ${PROJECT}`);

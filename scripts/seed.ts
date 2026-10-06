/**
 * Seed script — populates an empty Firestore project with demo restaurants.
 *
 * Run with:  npm run seed
 *
 * Notes
 *  - Uses the Admin SDK, which bypasses security rules. That is why it is a
 *    script and not a page: the browser must never hold these credentials.
 *  - Idempotent: re-running updates documents rather than duplicating them.
 *  - Money values are in paise, matching the app's domain model.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SEED_RESTAURANTS, SEED_OWNER } from '../src/data/seed-data.ts';

/* --------------------------- service-account loading ---------------------- */

function loadCredentials() {
  const path = resolve(process.cwd(), 'service-account.json');
  try {
    // The key file is gitignored; prefer it over ambient credentials.
    return cert(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    // Fall back to `gcloud auth application-default login` / GOOGLE_APPLICATION_CREDENTIALS.
    return undefined;
  }
}

const projectId = process.env['FIREBASE_PROJECT_ID'] ?? process.env['GCLOUD_PROJECT'];

const app =
  getApps()[0] ??
  initializeApp({
    credential: loadCredentials(),
    projectId,
    storageBucket: process.env['FIREBASE_STORAGE_BUCKET'],
  });

const db = getFirestore(app);

/* ---------------------------------- seeding -------------------------------- */

async function seed() {
  const ownerRef = db.collection('users').doc(SEED_OWNER.uid);

  await ownerRef.set(
    {
      uid: SEED_OWNER.uid,
      displayName: SEED_OWNER.displayName,
      email: SEED_OWNER.email,
      photoURL: null,
      phone: SEED_OWNER.phone,
      // Ownership is derived from restaurants.ownerId, so the role stays
      // `customer`; only `admin` is ever granted explicitly.
      role: 'customer',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Addresses are their own documents — see the addresses block in the rules.
  await ownerRef.collection('addresses').doc('seed-addr-1').set(
    {
      id: 'seed-addr-1',
      label: 'Home',
      line1: 'Flat 402, Green Residency',
      line2: 'Near MG Road',
      city: 'Bengaluru',
      postalCode: '560001',
      phone: SEED_OWNER.phone,
      isDefault: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`[seed] owner profile: ${SEED_OWNER.email}`);

  let count = 0;

  for (const restaurant of SEED_RESTAURANTS) {
    const ref = db.collection('restaurants').doc(restaurant.id);
    const { id, menu, ...fields } = restaurant;

    await ref.set(
      {
        ...fields,
        ownerId: SEED_OWNER.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    count += 1;

    // Replace the menu wholesale: simplest correct behaviour for a seed.
    const batch = db.batch();
    const menuRef = ref.collection('menu');

    for (const item of menu) {
      batch.set(menuRef.doc(item.id), {
        ...item,
        restaurantId: id,
        rating: 0,
        ratingCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    console.log(`[seed] ${fields.name} — ${menu.length} dishes`);
  }

  console.log(`\n[seed] done — ${count} restaurants ready.`);
  console.log(
    '[seed] sign in as this uid in the Firebase console, then open the dashboard:\n' +
      `       uid=${SEED_OWNER.uid}  email=${SEED_OWNER.email}`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  });

export type { Timestamp };

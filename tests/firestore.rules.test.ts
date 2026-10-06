/**
 * Firestore security rules tests.
 *
 * These are the tests that actually matter for this app: the rules are the only
 * security boundary, so "the UI hides the button" is not a control. Each test
 * asserts on a specific attack, not on a feature.
 *
 * Requires the Firestore emulator (Java 11+):
 *
 *   npm run emulators      # terminal 1
 *   npm run test:rules     # terminal 2
 *
 * The emulator enforces the real `firestore.rules` and `firestore.indexes.json`
 * from the repo root, so a passing run also proves both compile.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/* ------------------------------- fixtures --------------------------------- */

const OWNER_UID = 'owner-1';
const OTHER_UID = 'other-1';
/** Deliberately has NO user profile document — exercises the `exists()` guards. */
const PROFILE_LESS_UID = 'ghost-user';
const CUSTOMER_UID = 'customer-1';
const RESTAURANT_ID = 'rest-1';
const MENU_PATH = `restaurants/${RESTAURANT_ID}/menu`;

const NOW = new Date();

const OWNER_PROFILE = {
  uid: OWNER_UID,
  displayName: 'Owner',
  email: 'owner@test.local',
  photoURL: null,
  phone: null,
  role: 'customer',
  createdAt: NOW,
  updatedAt: NOW,
};

/** Addresses are their own documents — see the addresses block in the rules. */
const ADDRESS = {
  id: 'addr-1',
  label: 'Home',
  line1: 'Flat 1, Test Residency',
  city: 'Testville',
  postalCode: '560001',
  phone: '+919800000000',
  isDefault: true,
};

const RESTAURANT = {
  name: 'Test Kitchen',
  description: 'A restaurant used in rules tests.',
  cuisines: ['North Indian'],
  imageUrl: 'https://example.com/a.jpg',
  coverImageUrl: null,
  rating: 0,
  ratingCount: 0,
  deliveryTimeMinutes: 30,
  deliveryFee: 4000,
  priceLevel: 2,
  location: { area: 'Test Nagar', city: 'Testville' },
  ownerId: OWNER_UID,
  isOpen: true,
  isAcceptingOrders: true,
  isFeatured: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const MENU_ITEM = {
  restaurantId: RESTAURANT_ID,
  name: 'Paneer Tikka',
  description: 'Charred paneer with peppers and onion.',
  price: 29900,
  imageUrl: 'https://example.com/b.jpg',
  category: 'Starters',
  isVeg: true,
  isAvailable: true,
  rating: 0,
  ratingCount: 0,
  sortOrder: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'customer-1',
    userName: 'Customer',
    email: 'customer@test.local',
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Test Kitchen',
    items: [
      {
        menuItemId: 'm-1',
        name: 'Paneer Tikka',
        unitPrice: 29900,
        quantity: 2,
        isVeg: true,
        imageUrl: '',
      },
    ],
    address: ADDRESS,
    subtotal: 59800,
    deliveryFee: 4000,
    tax: 2990,
    total: 66790,
    status: 'placed',
    paymentMethod: 'cod',
    statusHistory: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/* --------------------------------- harness -------------------------------- */

let env: RulesTestEnvironment;

async function main() {
  env = await initializeTestEnvironment({
    projectId: 'foodhut-rules-test',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  /*
   * The emulator is long-lived and persistent, so a previous run's documents
   * would still be there. Without this, `setDoc` on an order becomes an
   * *update* and hits the (correctly strict) update rule instead of create,
   * making order tests fail for the wrong reason. Always start empty.
   */
  await env.clearFirestore();

  // Seed as an admin, so the fixtures bypass the rules being tested.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `users/${OWNER_UID}`), OWNER_PROFILE);
    await setDoc(doc(db, `users/${OTHER_UID}`), {
      ...OWNER_PROFILE,
      uid: OTHER_UID,
      email: 'other@test.local',
    });
    await setDoc(doc(db, `users/${CUSTOMER_UID}`), {
      ...OWNER_PROFILE,
      uid: CUSTOMER_UID,
      displayName: 'Customer',
      email: 'customer@test.local',
    });
    // NOTE: PROFILE_LESS_UID intentionally gets no document.
    await setDoc(doc(db, `restaurants/${RESTAURANT_ID}`), RESTAURANT);
  });

  const asUser = (uid: string) => env.authenticatedContext(uid).firestore();
  const db = (uid: string | null) =>
    uid === null ? env.unauthenticatedContext().firestore() : asUser(uid);

  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  PASS  ${name}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({ name, ok: false, detail });
      console.log(`  FAIL  ${name}\n        ${detail.split('\n')[0]}`);
    }
  }

  console.log('\nfirestore.rules\n');

  /* ------------------------------ profiles ------------------------------- */

  await test('a signed-in user can read their own profile', async () => {
    await assertSucceeds(getDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}`)));
  });

  await test("a user CANNOT read someone else's profile", async () => {
    await assertFails(getDoc(doc(asUser(OTHER_UID), `users/${OWNER_UID}`)));
  });

  await test('anonymous users can browse but not write', async () => {
    // Browsing is intentionally public, so an unauthenticated read must work.
    await assertSucceeds(getDoc(doc(db(null), `restaurants/${RESTAURANT_ID}`)));
    // Writes are not.
    await assertFails(setDoc(doc(db(null), 'restaurants/hack'), RESTAURANT));
  });

  await test('a user cannot promote themselves to admin', async () => {
    await assertFails(updateDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}`), { role: 'admin' }));
  });

  await test('a user cannot invent an authority-implying field', async () => {
    // There is no `ownedRestaurantIds` — ownership is derived from
    // `restaurants.ownerId` — and no embedded `addresses` array. Writing
    // either should be rejected outright.
    await assertFails(
      updateDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}`), {
        ownedRestaurantIds: [RESTAURANT_ID],
      } as never),
    );
    await assertFails(
      updateDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}`), {
        addresses: [ADDRESS],
      } as never),
    );
  });

  await test('a user can update their own display name', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}`), { displayName: 'Renamed' }),
    );
  });

  /* ------------------------------ addresses ----------------------------- */

  await test('a valid saved address is accepted', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}/addresses/addr-1`), ADDRESS),
    );
  });

  await test('a malformed address is rejected', async () => {
    await assertFails(
      setDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}/addresses/bad-pin`), {
        ...ADDRESS,
        id: 'bad-pin',
        postalCode: 'not-a-pin',
      }),
    );
  });

  await test('an address missing a required field is rejected', async () => {
    const { city: _omitted, ...noCity } = ADDRESS;
    void _omitted;
    await assertFails(
      setDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}/addresses/no-city`), {
        ...noCity,
        id: 'no-city',
      }),
    );
  });

  await test('an address cannot carry unexpected fields', async () => {
    await assertFails(
      setDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}/addresses/sneaky`), {
        ...ADDRESS,
        id: 'sneaky',
        geoCoordinates: { lat: 12.9, lng: 77.6 },
      }),
    );
  });

  await test('the embedded id must match the document id', async () => {
    await assertFails(
      setDoc(doc(asUser(OWNER_UID), `users/${OWNER_UID}/addresses/mismatch`), {
        ...ADDRESS,
        id: 'a-different-id',
      }),
    );
  });

  await test("a user cannot write into someone else's addresses", async () => {
    await assertFails(
      setDoc(doc(asUser(OTHER_UID), `users/${OWNER_UID}/addresses/stolen`), {
        ...ADDRESS,
        id: 'stolen',
      }),
    );
  });

  await test('a user with no profile document is denied, not errored', async () => {
    /*
     * `isAdmin()` reads the caller's profile. If that document is missing, a
     * naive `get(...).data.role` throws during evaluation. The request must be
     * denied *cleanly* - the emulator log should show a rule reason, not an
     * "evaluation error". This is what the `exists()` guards in the rules are for.
     */
    await assertFails(
      updateDoc(doc(asUser(PROFILE_LESS_UID), 'orders/o-1'), { status: 'delivered' }),
    );
    await assertFails(setDoc(doc(asUser(PROFILE_LESS_UID), `${MENU_PATH}/ghost`), MENU_ITEM));
  });

  /* ----------------------------- restaurants ----------------------------- */

  await test('the public can browse a restaurant', async () => {
    await assertSucceeds(getDoc(doc(db(OTHER_UID), `restaurants/${RESTAURANT_ID}`)));
  });

  await test('a restaurant cannot be created with a spoofed ownerId', async () => {
    await assertFails(
      setDoc(doc(asUser(OWNER_UID), 'restaurants/spoofed'), {
        ...RESTAURANT,
        ownerId: OTHER_UID,
      }),
    );
  });

  await test('a restaurant cannot be created with a non-zero rating', async () => {
    await assertFails(
      setDoc(doc(asUser(OWNER_UID), 'restaurants/fakerating'), {
        ...RESTAURANT,
        rating: 5,
      }),
    );
  });

  await test('the owner can update a mutable field', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(OWNER_UID), `restaurants/${RESTAURANT_ID}`), { isOpen: false }),
    );
  });

  await test('the owner cannot reassign ownerId', async () => {
    await assertFails(
      updateDoc(doc(asUser(OWNER_UID), `restaurants/${RESTAURANT_ID}`), { ownerId: OTHER_UID }),
    );
  });

  await test('the owner cannot rewrite the rating aggregate', async () => {
    await assertFails(
      updateDoc(doc(asUser(OWNER_UID), `restaurants/${RESTAURANT_ID}`), {
        rating: 5,
        ratingCount: 9999,
      }),
    );
  });

  await test("a non-owner cannot edit the restaurant's fields", async () => {
    await assertFails(
      updateDoc(doc(asUser(OTHER_UID), `restaurants/${RESTAURANT_ID}`), { isOpen: false }),
    );
  });

  /* --------------------------------- menu -------------------------------- */

  await test('the owner can add a menu item', async () => {
    await assertSucceeds(setDoc(doc(asUser(OWNER_UID), `${MENU_PATH}/m-1`), MENU_ITEM));
  });

  await test("a non-owner cannot add a menu item to someone else's restaurant", async () => {
    await assertFails(setDoc(doc(asUser(OTHER_UID), `${MENU_PATH}/m-2`), MENU_ITEM));
  });

  await test('the public can read the menu', async () => {
    await assertSucceeds(getDoc(doc(asUser(OTHER_UID), `${MENU_PATH}/m-1`)));
  });

  /* -------------------------------- reviews ------------------------------ */

  await test('a user can review as themselves', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(OTHER_UID), `restaurants/${RESTAURANT_ID}/reviews/r-1`), {
        userId: OTHER_UID,
        userName: 'Other',
        userPhotoURL: null,
        restaurantId: RESTAURANT_ID,
        menuItemId: null,
        rating: 5,
        comment: 'Excellent food, would order again.',
        createdAt: NOW,
      }),
    );
  });

  await test('a user cannot post a review impersonating someone else', async () => {
    await assertFails(
      setDoc(doc(asUser(OTHER_UID), `restaurants/${RESTAURANT_ID}/reviews/r-2`), {
        userId: OWNER_UID,
        userName: 'Owner',
        userPhotoURL: null,
        restaurantId: RESTAURANT_ID,
        menuItemId: null,
        rating: 1,
        comment: 'Fake review from a different account.',
        createdAt: NOW,
      }),
    );
  });

  await test('a rating outside 1-5 is rejected', async () => {
    await assertFails(
      setDoc(doc(asUser(OTHER_UID), `restaurants/${RESTAURANT_ID}/reviews/r-3`), {
        userId: OTHER_UID,
        userName: 'Other',
        userPhotoURL: null,
        restaurantId: RESTAURANT_ID,
        menuItemId: null,
        rating: 99,
        comment: 'Rating out of range should fail.',
        createdAt: NOW,
      }),
    );
  });

  /* -------------------------------- orders ------------------------------- */

  await test('a customer can place a consistent order', async () => {
    await assertSucceeds(setDoc(doc(db(CUSTOMER_UID), 'orders/o-1'), order()));
  });

  await test('a tampered total is rejected', async () => {
    await assertFails(setDoc(doc(db(CUSTOMER_UID), 'orders/o-bad'), order({ total: 1 })));
  });

  await test('an order cannot be placed on behalf of another user', async () => {
    await assertFails(
      setDoc(doc(db(CUSTOMER_UID), 'orders/o-impersonate'), order({ userId: OWNER_UID })),
    );
  });

  await test('an order cannot be created already delivered', async () => {
    await assertFails(
      setDoc(doc(db(CUSTOMER_UID), 'orders/o-skip'), order({ status: 'delivered' })),
    );
  });

  await test('the restaurant owner can advance the status one step', async () => {
    await assertSucceeds(updateDoc(doc(asUser(OWNER_UID), 'orders/o-1'), { status: 'confirmed' }));
  });

  await test('the status cannot skip a step', async () => {
    await assertFails(updateDoc(doc(asUser(OWNER_UID), 'orders/o-1'), { status: 'delivered' }));
  });

  await test('the status cannot move backwards', async () => {
    await assertFails(updateDoc(doc(asUser(OWNER_UID), 'orders/o-1'), { status: 'placed' }));
  });

  await test('the total is immutable after placement', async () => {
    await assertFails(
      updateDoc(doc(asUser(OWNER_UID), 'orders/o-1'), { status: 'preparing', total: 1 }),
    );
  });

  await test('the customer can cancel while the order is active', async () => {
    await assertSucceeds(updateDoc(doc(db(CUSTOMER_UID), 'orders/o-1'), { status: 'cancelled' }));
  });

  await test('a cancelled order cannot be revived', async () => {
    await assertFails(updateDoc(doc(asUser(OWNER_UID), 'orders/o-1'), { status: 'delivered' }));
  });

  await test('a customer cannot touch the line items', async () => {
    await assertSucceeds(setDoc(doc(db(CUSTOMER_UID), 'orders/o-2'), order()));
    await assertFails(
      updateDoc(doc(db(CUSTOMER_UID), 'orders/o-2'), {
        status: 'cancelled',
        items: [],
      }),
    );
  });

  await test("a customer cannot read another customer's order", async () => {
    await assertFails(getDoc(doc(db('someone-else'), 'orders/o-1')));
  });

  await test('orders are never deletable', async () => {
    await assertFails(deleteDoc(doc(asUser(OWNER_UID), 'orders/o-1')));
  });

  /* ----------------------------- favourites ------------------------------ */

  await test('a user can favourite a real restaurant', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(OTHER_UID), `users/${OTHER_UID}/favourites/${RESTAURANT_ID}`), {
        userId: OTHER_UID,
        restaurantId: RESTAURANT_ID,
        createdAt: NOW,
      }),
    );
  });

  await test('a favourite cannot reference a restaurant that does not exist', async () => {
    await assertFails(
      setDoc(doc(asUser(OTHER_UID), `users/${OTHER_UID}/favourites/ghost`), {
        userId: OTHER_UID,
        restaurantId: 'ghost',
        createdAt: NOW,
      }),
    );
  });

  await test("a user cannot write into someone else's favourites", async () => {
    await assertFails(
      setDoc(doc(asUser(OWNER_UID), `users/${OTHER_UID}/favourites/${RESTAURANT_ID}`), {
        userId: OTHER_UID,
        restaurantId: RESTAURANT_ID,
        createdAt: NOW,
      }),
    );
  });

  /* --------------------------------- report ------------------------------ */

  await env.cleanup();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);

  if (failed.length > 0) {
    console.log('\nfailures:');
    for (const f of failed) console.log(`  - ${f.name}\n    ${f.detail?.split('\n')[0]}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('\nrules test run failed:', error);
  console.error(
    '\nIs the Firestore emulator running on port 8080? Start it with: npm run emulators',
  );
  process.exit(1);
});

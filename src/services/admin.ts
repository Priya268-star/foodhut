/**
 * Owner/admin writes for restaurants and their menus.
 *
 * These live apart from the read services on purpose: every function here is an
 * owner-authorised mutation, so keeping them together makes the privileged write
 * surface easy to audit against `firestore.rules`.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { firebaseAuth, firestore } from '@/config/firebase';
import { toUserMessage } from '@/lib/firebase/errors';
import { toRestaurant } from '@/lib/mappers';
import {
  menuItemDoc,
  restaurantDoc,
  restaurantMenuCollection,
  restaurantsCollection,
} from '@/lib/paths';
import type { MenuItemDraft, Restaurant } from '@/types/models';

/* ------------------------------ restaurants ------------------------------- */

export type RestaurantWritableFields = Omit<
  Restaurant,
  'id' | 'ownerId' | 'rating' | 'ratingCount' | 'createdAt' | 'updatedAt'
>;

/**
 * Creates a restaurant owned by the caller.
 *
 * `ownerId` is read from the auth token rather than from caller input, and the
 * rules re-verify it, so it cannot be spoofed. This is a single atomic write:
 * owner status is *derived* from `restaurants.ownerId` (see `services/ownership.ts`),
 * so there is no second write to a user profile to keep in sync.
 */
export async function createRestaurant(fields: RestaurantWritableFields): Promise<string> {
  const ownerId = firebaseAuth().currentUser?.uid;
  if (!ownerId) throw new Error('You must be signed in to create a restaurant.');

  const ref = await addDoc(collection(firestore(), restaurantsCollection()), {
    ...fields,
    ownerId,
    rating: 0,
    ratingCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateRestaurant(
  id: string,
  changes: Partial<RestaurantWritableFields>,
): Promise<void> {
  await updateDoc(doc(firestore(), restaurantDoc(id)), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRestaurant(id: string): Promise<void> {
  await deleteDoc(doc(firestore(), restaurantDoc(id)));
}

/**
 * Live list of the restaurants this account manages.
 *
 * The scope depends on the role, and the difference matters:
 *
 *   owner -> only restaurants whose `ownerId` is this uid.
 *   admin -> *every* restaurant.
 *
 * An admin is a platform operator, not a restaurant owner. Ownership is derived
 * from `restaurants.ownerId` (see `services/ownership.ts`), so an admin owns
 * nothing and filtering by `ownerId` showed them an empty panel even though the
 * rules grant them full access to every restaurant, every menu and every order.
 * The panel existed; it was simply pointed at the wrong set.
 */
export function subscribeToManagedRestaurants(
  ownerId: string | null,
  isAdmin: boolean,
  handlers: { onChange: (restaurants: Restaurant[]) => void; onError?: (message: string) => void },
): Unsubscribe {
  if (!ownerId) {
    handlers.onChange([]);
    return () => {};
  }

  const base = collection(firestore(), restaurantsCollection());
  const q = isAdmin ? query(base) : query(base, where('ownerId', '==', ownerId));

  return onSnapshot(
    q,
    (snap) =>
      handlers.onChange(snap.docs.map(toRestaurant).sort((a, b) => a.name.localeCompare(b.name))),
    (error) => handlers.onError?.(toUserMessage(error)),
  );
}

/* --------------------------------- menu ----------------------------------- */

export async function createMenuItem(restaurantId: string, draft: MenuItemDraft): Promise<string> {
  const ref = await addDoc(collection(firestore(), restaurantMenuCollection(restaurantId)), {
    ...draft,
    rating: 0,
    ratingCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  changes: Partial<MenuItemDraft>,
): Promise<void> {
  await updateDoc(doc(firestore(), menuItemDoc(restaurantId, itemId)), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMenuItem(restaurantId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(firestore(), menuItemDoc(restaurantId, itemId)));
}

/**
 * Availability is the most frequent owner edit, so batch it — a single commit
 * instead of one round trip per row (Firestore caps batches at 500 writes).
 */
export async function setMenuAvailability(
  restaurantId: string,
  updates: Array<{ id: string; isAvailable: boolean }>,
): Promise<void> {
  if (updates.length === 0) return;

  const db = firestore();
  const batch = writeBatch(db);
  const chunk = updates.slice(0, 500);

  for (const update of chunk) {
    batch.update(doc(db, menuItemDoc(restaurantId, update.id)), {
      isAvailable: update.isAvailable,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/** Points a menu item at a new image, used after an upload completes. */
export async function setMenuItemImage(
  restaurantId: string,
  itemId: string,
  imageUrl: string,
): Promise<void> {
  await setDoc(
    doc(firestore(), menuItemDoc(restaurantId, itemId)),
    { imageUrl, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function restaurantExists(id: string): Promise<boolean> {
  return (await getDoc(doc(firestore(), restaurantDoc(id)))).exists();
}

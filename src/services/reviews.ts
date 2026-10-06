/**
 * Reviews and favourites.
 *
 * Reviews are a subcollection of the restaurant, so rules can express
 * "anyone signed in may write, but only the author may delete" without a join.
 * Favourites live under the user for the same reason and need no index.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy as fbOrderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { firestore } from '@/config/firebase';
import { toFavourite, toReview } from '@/lib/mappers';
import {
  reviewDoc,
  restaurantReviewsCollection,
  userFavouriteDoc,
  userFavouritesCollection,
} from '@/lib/paths';
import type { Favourite, Review } from '@/types/models';

/* -------------------------------- reviews --------------------------------- */

export interface SubmitReviewInput {
  userId: string;
  userName: string;
  userPhotoURL: string | null;
  restaurantId: string;
  menuItemId: string | null;
  rating: number;
  comment: string;
}

export async function submitReview(input: SubmitReviewInput): Promise<string> {
  const ref = await addDoc(
    collection(firestore(), restaurantReviewsCollection(input.restaurantId)),
    {
      userId: input.userId,
      userName: input.userName,
      userPhotoURL: input.userPhotoURL,
      restaurantId: input.restaurantId,
      menuItemId: input.menuItemId,
      rating: input.rating,
      comment: input.comment,
      createdAt: serverTimestamp(),
    },
  );
  return ref.id;
}

export async function fetchReviews(restaurantId: string, max = 20): Promise<Review[]> {
  const snap = await getDocs(
    query(
      collection(firestore(), restaurantReviewsCollection(restaurantId)),
      fbOrderBy('createdAt', 'desc'),
      fbLimit(max),
    ),
  );
  return snap.docs.map(toReview);
}

export function subscribeToReviews(
  restaurantId: string,
  handlers: { onChange: (reviews: Review[]) => void; onError?: (error: Error) => void },
  max = 20,
): Unsubscribe {
  const q = query(
    collection(firestore(), restaurantReviewsCollection(restaurantId)),
    fbOrderBy('createdAt', 'desc'),
    fbLimit(max),
  );
  return onSnapshot(
    q,
    (snap) => handlers.onChange(snap.docs.map(toReview)),
    (error) => handlers.onError?.(error),
  );
}

export async function deleteReview(restaurantId: string, reviewId: string): Promise<void> {
  await deleteDoc(doc(firestore(), reviewDoc(restaurantId, reviewId)));
}

/* ------------------------------- favourites ------------------------------- */

/** The doc id *is* the restaurant id, which makes toggling a cheap `set`/`delete`. */
export async function addFavourite(userId: string, restaurantId: string): Promise<void> {
  await setDoc(
    doc(firestore(), userFavouriteDoc(userId, restaurantId)),
    { userId, restaurantId, createdAt: serverTimestamp() },
    { merge: true },
  );
}

export async function removeFavourite(userId: string, restaurantId: string): Promise<void> {
  await deleteDoc(doc(firestore(), userFavouriteDoc(userId, restaurantId)));
}

export async function fetchFavourites(userId: string): Promise<Favourite[]> {
  const snap = await getDocs(
    query(
      collection(firestore(), userFavouritesCollection(userId)),
      fbOrderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(toFavourite);
}

/**
 * Reactive favourite set for the card heart button.
 * The presence check runs client-side because Firestore has no "where id in set".
 */
export function subscribeToFavourites(
  userId: string | null,
  handlers: { onChange: (ids: Set<string>) => void; onError?: (error: Error) => void },
): Unsubscribe {
  if (!userId) {
    handlers.onChange(new Set());
    return () => {};
  }

  return onSnapshot(
    collection(firestore(), userFavouritesCollection(userId)),
    (snap) => handlers.onChange(new Set(snap.docs.map((d) => d.id))),
    (error) => handlers.onError?.(error),
  );
}

export async function isFavourite(userId: string, restaurantId: string): Promise<boolean> {
  const snap = await getDoc(doc(firestore(), userFavouriteDoc(userId, restaurantId)));
  return snap.exists();
}

/** "Have I already reviewed this restaurant?" — used to disable the form. */
export function subscribeToUserReviewForRestaurant(
  restaurantId: string,
  userId: string | null,
  handlers: { onChange: (review: Review | null) => void },
): Unsubscribe {
  if (!userId) {
    handlers.onChange(null);
    return () => {};
  }

  return onSnapshot(
    query(
      collection(firestore(), restaurantReviewsCollection(restaurantId)),
      where('userId', '==', userId),
      fbLimit(1),
    ),
    (snap) => {
      const doc = snap.docs.at(0);
      handlers.onChange(doc ? toReview(doc) : null);
    },
  );
}

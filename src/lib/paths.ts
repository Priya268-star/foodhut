/**
 * Firestore path builders — the single place that knows the collection layout.
 *
 * Using these everywhere (instead of string literals) keeps queries and rules
 * in sync, and a path typo becomes a compile error rather than an empty screen.
 */

export const usersCollection = () => 'users';
export const userDoc = (uid: string) => `users/${uid}`;

/**
 * Addresses are a subcollection, not an array on the profile — see the note in
 * `types/models.ts` and the address match block in `firestore.rules`.
 */
export const userAddressesCollection = (uid: string) => `users/${uid}/addresses`;
export const userAddressDoc = (uid: string, addressId: string) =>
  `users/${uid}/addresses/${addressId}`;

export const restaurantsCollection = () => 'restaurants';
export const restaurantDoc = (id: string) => `restaurants/${id}`;

export const restaurantMenuCollection = (restaurantId: string) =>
  `restaurants/${restaurantId}/menu`;
export const menuItemDoc = (restaurantId: string, itemId: string) =>
  `restaurants/${restaurantId}/menu/${itemId}`;

export const restaurantReviewsCollection = (restaurantId: string) =>
  `restaurants/${restaurantId}/reviews`;
export const reviewDoc = (restaurantId: string, reviewId: string) =>
  `restaurants/${restaurantId}/reviews/${reviewId}`;

export const userFavouritesCollection = (uid: string) => `users/${uid}/favourites`;
export const userFavouriteDoc = (uid: string, restaurantId: string) =>
  `users/${uid}/favourites/${restaurantId}`;

export const ordersCollection = () => 'orders';
export const orderDoc = (id: string) => `orders/${id}`;

/** Firestore limits itself to 30 composite indexes per collection; keep ours lean. */
export const MAX_RESTAURANT_QUERY_LIMIT = 30;

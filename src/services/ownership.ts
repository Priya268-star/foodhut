/**
 * Ownership lookup.
 *
 * Ownership is derived from `restaurants/{id}.ownerId` — the same field the
 * security rules authorise against. It is deliberately *not* denormalised onto
 * the user profile: a client-writable copy would need a rule that lets a user
 * claim ownership, and any such rule is a privilege-escalation surface.
 *
 * The cost is one `limit(1)` query, which AuthContext holds open for the whole
 * session so the header and the admin route guard share a single listener.
 */
import {
  collection,
  limit as fbLimit,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { firestore } from '@/config/firebase';
import { restaurantsCollection } from '@/lib/paths';

export function subscribeToOwnership(
  userId: string | null,
  handlers: { onChange: (ownsRestaurant: boolean) => void; onError?: (error: Error) => void },
): Unsubscribe {
  if (!userId) {
    handlers.onChange(false);
    return () => {};
  }

  // `limit(1)` is all we need — we only care whether *any* restaurant is owned.
  const q = query(
    collection(firestore(), restaurantsCollection()),
    where('ownerId', '==', userId),
    fbLimit(1),
  );

  return onSnapshot(
    q,
    (snap) => handlers.onChange(!snap.empty),
    (error) => handlers.onError?.(error),
  );
}

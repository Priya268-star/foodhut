import { useCallback, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useFavourites } from '@/hooks/useFirestoreData';
import { addFavourite, removeFavourite } from '@/services/reviews';

/**
 * Favourite state + toggle, shared by the home grid, the restaurant page and
 * the favourites page so a heart flips everywhere at once.
 *
 * `onRequireSignIn` lets the caller own the "please log in" UX.
 */
export function useFavouriteToggle(onRequireSignIn: () => void) {
  const { user } = useAuth();
  const { ids, loading } = useFavourites();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const toggle = useCallback(
    async (restaurantId: string) => {
      if (!user) {
        onRequireSignIn();
        return;
      }

      setPendingId(restaurantId);
      try {
        // Optimistic: the local set flips immediately via the snapshot listener.
        if (ids.has(restaurantId)) await removeFavourite(user.uid, restaurantId);
        else await addFavourite(user.uid, restaurantId);
      } catch (error) {
        console.error('[favourites] toggle failed', error);
      } finally {
        setPendingId(null);
      }
    },
    [user, ids, onRequireSignIn],
  );

  return {
    isFavourite: useCallback((restaurantId: string) => ids.has(restaurantId), [ids]),
    toggle,
    pendingId,
    loading,
  };
}

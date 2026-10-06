import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import {
  collection as fsCollection,
  doc as firestoreDoc,
  getDoc,
  onSnapshot,
  orderBy as fbOrderBy,
  query,
} from 'firebase/firestore';

import { firestore } from '@/config/firebase';
import { toRestaurant } from '@/lib/mappers';
import { userFavouritesCollection } from '@/lib/paths';
import { useAuth } from '@/context/AuthContext';
import { removeFavourite } from '@/services/reviews';
import { Button } from '@/components/ui/Button';
import { RestaurantCard, RestaurantCardSkeleton } from '@/components/RestaurantCard';
import { Alert, EmptyState } from '@/components/ui/Primitives';
import type { Restaurant } from '@/types/models';

/**
 * Favourites page.
 *
 * Firestore has no "where id in (large list)" and no join, so we keep the
 * favourite ids live and resolve the restaurant documents ourselves. Fetches
 * are memoised per id so re-renders do not re-read the same document.
 */
export function FavouritesPage() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[] | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    return onSnapshot(
      query(
        fsCollection(firestore(), userFavouritesCollection(user.uid)),
        fbOrderBy('createdAt', 'desc'),
      ),
      (snap) => {
        setIds(snap.docs.map((doc) => doc.id));
        setLoading(false);
      },
      (err) => {
        console.error('[favourites] subscribe failed', err);
        setError('Could not load your favourites.');
        setLoading(false);
      },
    );
  }, [user]);

  useEffect(() => {
    if (!ids) return;
    if (ids.length === 0) {
      setRestaurants([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const cache = new Map<string, Restaurant | null>();

    void (async () => {
      try {
        // Favourite ids *are* restaurant ids, so each doc is a direct read.
        // The cache is per-effect: a re-subscribe only refetches what changed.
        const results = await Promise.all(
          ids.map(async (id) => {
            const cached = cache.get(id);
            if (cached !== undefined) return cached;

            const snap = await getDoc(firestoreDoc(firestore(), `restaurants/${id}`));
            const restaurant = snap.exists() ? toRestaurant(snap) : null;
            cache.set(id, restaurant);
            return restaurant;
          }),
        );
        if (!cancelled) setRestaurants(results.filter((r): r is Restaurant => r !== null));
      } catch (err) {
        console.error('[favourites] resolve failed', err);
        if (!cancelled) setError('Could not load your favourites.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ids]);

  /** A doc that has since been deleted is dropped from the list. */
  const unfavourite = async (restaurantId: string) => {
    if (!user) return;
    try {
      await removeFavourite(user.uid, restaurantId);
    } catch (err) {
      console.error('[favourites] remove failed', err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-ink-900 mb-1 text-xl font-bold tracking-tight sm:text-2xl">Favourites</h1>
      <p className="text-ink-500 mb-6 text-sm">
        {restaurants.length > 0
          ? `${restaurants.length} restaurant${restaurants.length === 1 ? '' : 's'} saved`
          : 'Restaurants you save will appear here.'}
      </p>

      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title="No favourites yet"
          description="Tap the heart on any restaurant to save it here for quick access."
          action={
            <Link to="/">
              <Button>Explore restaurants</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              isFavourite
              onToggleFavourite={(id) => void unfavourite(id)}
              onRequireSignIn={() => undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

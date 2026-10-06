/**
 * Reusable Firestore data hooks.
 *
 * Each hook owns exactly one subscription, tears it down on unmount, and
 * exposes a uniform `{ data, loading, error }` shape so pages stay declarative.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';

import { toUserMessage } from '@/lib/firebase/errors';
import { useAuth } from '@/context/AuthContext';
import { fetchMenu } from '@/services/menu';
import { fetchMyOrders } from '@/services/orders';
import { fetchCuisines, fetchRestaurantById } from '@/services/restaurants';
import { subscribeToFavourites, subscribeToReviews } from '@/services/reviews';
import type { MenuItem, Order, Restaurant, Review } from '@/types/models';

interface QueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/* ------------------------------- restaurant ------------------------------- */

export function useRestaurant(restaurantId: string | undefined) {
  const [data, setData] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!restaurantId) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRestaurantById(restaurantId)
      .then((restaurant) => {
        if (cancelled) return;
        if (!restaurant) {
          setError('This restaurant is no longer available.');
          setData(null);
        } else {
          setData(restaurant);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toUserMessage(err, 'Could not load this restaurant.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId, nonce]);

  return { restaurant: data, loading, error, retry: useCallback(() => setNonce((n) => n + 1), []) };
}

/* ---------------------------------- menu ---------------------------------- */

export function useMenu(restaurantId: string | undefined): QueryResult<MenuItem[]> {
  const [data, setData] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setData([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchMenu(restaurantId)
      .then((items) => {
        if (!cancelled) setData(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toUserMessage(err, 'Could not load the menu.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return { data, loading, error };
}

/* -------------------------------- cuisines -------------------------------- */

export function useCuisines(): QueryResult<string[]> {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchCuisines()
      .then((cuisines) => {
        if (!cancelled) setData(cuisines);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toUserMessage(err, 'Could not load cuisines.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

/* -------------------------------- reviews --------------------------------- */

export function useReviews(restaurantId: string | undefined): QueryResult<Review[]> {
  const [data, setData] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe: Unsubscribe = subscribeToReviews(restaurantId, {
      onChange: (reviews) => {
        setData(reviews);
        setLoading(false);
        setError(null);
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });

    return unsubscribe;
  }, [restaurantId]);

  return { data, loading, error };
}

/* ------------------------------- favourites ------------------------------- */

/** Live set of favourite restaurant ids — drives every heart button at once. */
export function useFavourites(): { ids: Set<string>; loading: boolean } {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }

    setLoading(true);
    return subscribeToFavourites(user.uid, {
      onChange: (next) => {
        setIds(next);
        setLoading(false);
      },
      onError: () => setLoading(false),
    });
  }, [user]);

  return { ids, loading };
}

/* --------------------------------- orders --------------------------------- */

export function useMyOrders(): QueryResult<Order[]> & { refresh: () => void } {
  const { user } = useAuth();
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchMyOrders(user.uid)
      .then((orders) => {
        if (!cancelled) setData(orders);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toUserMessage(err, 'Could not load your orders.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  return { data, loading, error, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}

/**
 * Restaurants list with filters, search and cursor pagination.
 *
 * The hook owns the query lifecycle: it cancels in-flight work when filters
 * change, resets the cursor on any filter change, and exposes a stable
 * `loadMore` for the "Load more" button.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toUserMessage } from '@/lib/firebase/errors';
import {
  fetchRestaurants,
  type RestaurantFilters,
  type RestaurantSort,
} from '@/services/restaurants';
import type { Restaurant } from '@/types/models';

export interface UseRestaurantsResult {
  restaurants: Restaurant[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

export function useRestaurants(filters: RestaurantFilters): UseRestaurantsResult {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nonce, setNonce] = useState(0);

  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const search = useDebouncedValue(filters.search ?? '', 350);

  // Serialise the filter set so the effect depends on values, not object identity.
  const queryKey = useMemo(
    () =>
      JSON.stringify({
        search,
        cuisine: filters.cuisine ?? null,
        maxPriceLevel: filters.maxPriceLevel ?? null,
        sort: filters.sort ?? 'relevance',
        onlyOpen: filters.onlyOpen ?? false,
        featuredOnly: filters.featuredOnly ?? false,
      }),
    [
      search,
      filters.cuisine,
      filters.maxPriceLevel,
      filters.sort,
      filters.onlyOpen,
      filters.featuredOnly,
    ],
  );

  const effectiveFilters = useMemo<RestaurantFilters>(
    () => ({ ...filters, search }),
    // `queryKey` is the canonical signature of these filters.
    [queryKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Any filter change invalidates the cursor and the accumulated page.
  useEffect(() => {
    cursorRef.current = null;
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchRestaurants(effectiveFilters)
      .then((page) => {
        if (cancelled) return;
        setRestaurants(page.restaurants);
        cursorRef.current = page.lastDocument;
        setHasMore(page.hasMore);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(toUserMessage(err, 'Could not load restaurants.'));
        setRestaurants([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveFilters, nonce]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || cursorRef.current === null) return;

    setLoadingMore(true);
    fetchRestaurants(effectiveFilters, undefined, cursorRef.current)
      .then((page) => {
        setRestaurants((prev) => {
          // Guard against duplicates if a page overlaps the previous cursor.
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...page.restaurants.filter((r) => !seen.has(r.id))];
        });
        cursorRef.current = page.lastDocument;
        setHasMore(page.hasMore);
      })
      .catch((err: unknown) => setError(toUserMessage(err, 'Could not load more restaurants.')))
      .finally(() => setLoadingMore(false));
  }, [effectiveFilters, hasMore, loadingMore]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { restaurants, loading, loadingMore, error, hasMore, loadMore, retry };
}

export type { RestaurantSort };

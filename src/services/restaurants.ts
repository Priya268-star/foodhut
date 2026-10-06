/**
 * Restaurant queries.
 *
 * Read paths only — writes live in `restaurantsService`/`menuService` below and
 * are guarded by ownership rules on the Firestore side.
 */
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy as fbOrderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';

import { firestore } from '@/config/firebase';
import { toRestaurant } from '@/lib/mappers';
import { MAX_RESTAURANT_QUERY_LIMIT, restaurantDoc, restaurantsCollection } from '@/lib/paths';
import type { Restaurant } from '@/types/models';

export const RESTAURANT_SORTS = ['relevance', 'rating', 'deliveryTime', 'deliveryFeeLow'] as const;
export type RestaurantSort = (typeof RESTAURANT_SORTS)[number];

export interface RestaurantFilters {
  search?: string;
  cuisine?: string | null;
  maxPriceLevel?: number | null;
  sort?: RestaurantSort;
  onlyOpen?: boolean;
  featuredOnly?: boolean;
}

export interface RestaurantPage {
  restaurants: Restaurant[];
  lastDocument: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/** The document-id tiebreaker, as a single shared constraint. */
const BY_ID = fbOrderBy(documentId(), 'desc');

/**
 * Sort orders, each tied off with the document id.
 *
 * The tiebreaker matters: without a total ordering, `startAfter` cursor
 * pagination can repeat or skip documents when two rows tie. Ordering by the
 * document id also costs nothing in *query* terms, unlike a secondary `orderBy`
 * on a real field, which would multiply the index count across every filter
 * combination.
 *
 * The direction is spelled out because it is load-bearing. Firestore matches an
 * `orderBy` chain to a composite index by exact direction, so `documentId()` with
 * no direction (which defaults to ascending) will not use a `__name__ DESCENDING`
 * index and the query fails with `failed-prevention`. These must stay in step
 * with `scripts/generate-indexes.mts`, which emits `__name__ DESCENDING`.
 */
const ORDER_BY: Record<RestaurantSort, QueryConstraint[]> = {
  relevance: [fbOrderBy('isFeatured', 'desc'), fbOrderBy('rating', 'desc'), BY_ID],
  rating: [fbOrderBy('rating', 'desc'), BY_ID],
  deliveryTime: [fbOrderBy('deliveryTimeMinutes', 'asc'), BY_ID],
  deliveryFeeLow: [fbOrderBy('deliveryFee', 'asc'), BY_ID],
};

/**
 * Fetches one page of restaurants.
 *
 * Firestore has no native full-text search without Algolia/Elastic, so `search`
 * is a client-side match over the returned page. Acceptable for the seeded demo
 * dataset; the README documents the production path.
 */
export async function fetchRestaurants(
  filters: RestaurantFilters = {},
  pageSize = MAX_RESTAURANT_QUERY_LIMIT,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<RestaurantPage> {
  const db = firestore();
  const constraints: QueryConstraint[] = [...ORDER_BY[filters.sort ?? 'relevance']];

  if (filters.cuisine) constraints.push(where('cuisines', 'array-contains', filters.cuisine));
  if (filters.onlyOpen) constraints.push(where('isOpen', '==', true));
  if (filters.featuredOnly) constraints.push(where('isFeatured', '==', true));

  /*
   * Price is a *discrete* set of tiers (1-4), so this is `in`, not `<=`.
   *
   * That is not cosmetic. Firestore allows only one range field per query, and
   * after a range the orderBy clause may not add further fields — so
   * `where('priceLevel', '<=', n)` combined with `orderBy('isFeatured', ...)`
   * fails at runtime with "order by clause cannot contain more fields after the
   * key". An `in` filter is equality-like, so every sort still works, and it
   * says exactly what the UI means: these price tiers, or cheaper.
   */
  if (filters.maxPriceLevel) {
    const tiers = [1, 2, 3, 4].filter((tier) => tier <= (filters.maxPriceLevel as number));
    constraints.push(where('priceLevel', 'in', tiers));
  }

  if (cursor) constraints.push(startAfter(cursor));
  // One extra doc lets us detect `hasMore` without a second count query.
  constraints.push(fbLimit(pageSize + 1));

  const snap = await getDocs(query(collection(db, restaurantsCollection()), ...constraints));
  const hasMore = snap.docs.length > pageSize;
  const page = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

  let restaurants = page.map(toRestaurant);
  const term = filters.search?.trim().toLowerCase();
  if (term) {
    restaurants = restaurants.filter((r) =>
      [r.name, r.description, r.location.area, ...r.cuisines]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }

  return { restaurants, lastDocument: page.at(-1) ?? null, hasMore };
}

export async function fetchRestaurantById(id: string): Promise<Restaurant | null> {
  const snap = await getDoc(doc(firestore(), restaurantDoc(id)));
  if (!snap.exists()) return null;
  // A `DocumentSnapshot` has the same `data()` shape the mapper needs; the id
  // comes from the doc reference rather than the query snapshot.
  return toRestaurant({ id: snap.id, data: () => snap.data() } as never);
}

/** Distinct cuisines, derived from the catalogue for the filter chips. */
export async function fetchCuisines(): Promise<string[]> {
  const { restaurants } = await fetchRestaurants({ sort: 'rating' });
  const set = new Set(restaurants.flatMap((r) => r.cuisines));
  return [...set].sort((a, b) => a.localeCompare(b));
}

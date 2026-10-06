/**
 * Generates `firestore.indexes.json`.
 *
 * Firestore needs one composite index per (filter x sort) combination, and
 * getting that list by hand is error-prone — a missing one surfaces only as a
 * `failed-precondition` at runtime, in production, for one specific filter.
 * So we derive the list from the same shape the queries use.
 *
 *   run: npm run indexes
 *
 * Keep `src/services/restaurants.ts` and the SORTS / FILTERS below in sync.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* ------------------------------ the query space ---------------------------- */

type Direction = 'ASCENDING' | 'DESCENDING';

interface SortSpec {
  /** Mirrors `ORDER_BY` in src/services/restaurants.ts. */
  readonly id: string;
  /** The composite fields, in query order. */
  readonly order: ReadonlyArray<{ fieldPath: string; order: Direction }>;
}

const SORTS: SortSpec[] = [
  {
    id: 'relevance',
    order: [
      { fieldPath: 'isFeatured', order: 'DESCENDING' },
      { fieldPath: 'rating', order: 'DESCENDING' },
    ],
  },
  { id: 'rating', order: [{ fieldPath: 'rating', order: 'DESCENDING' }] },
  { id: 'deliveryTime', order: [{ fieldPath: 'deliveryTimeMinutes', order: 'ASCENDING' }] },
  { id: 'deliveryFeeLow', order: [{ fieldPath: 'deliveryFee', order: 'ASCENDING' }] },
];

type FilterSpec =
  { kind: 'equality' | 'range'; fieldPath: string } | { kind: 'array'; fieldPath: string };

/** Mirrors the optional filters in `fetchRestaurants`. */
const FILTERS: FilterSpec[] = [
  { kind: 'array', fieldPath: 'cuisines' },
  // Treated as equality, because the query filters price with `in`, not `<=`.
  // See the note in src/services/restaurants.ts for why that matters.
  { kind: 'equality', fieldPath: 'priceLevel' },
  { kind: 'equality', fieldPath: 'isOpen' },
];

/* ------------------------- other queries, by hand ------------------------- */

const OTHER_INDEXES = [
  /*
   * The owner dashboard queries `where('ownerId', '==')` with *no* orderBy
   * (it sorts client-side by name), so the single-field index on `ownerId`
   * is sufficient — no composite is required. Adding one here is rejected by
   * Firestore as "not necessary, configure using single field index controls".
   */
  {
    collectionGroup: 'menu',
    queryScope: 'COLLECTION' as const,
    fields: [
      { fieldPath: 'isAvailable', order: 'ASCENDING' as Direction },
      { fieldPath: 'sortOrder', order: 'ASCENDING' as Direction },
      { fieldPath: '__name__', order: 'ASCENDING' as Direction },
    ],
  },
  {
    collectionGroup: 'orders',
    queryScope: 'COLLECTION' as const,
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' as Direction },
      { fieldPath: 'createdAt', order: 'DESCENDING' as Direction },
    ],
  },
  {
    collectionGroup: 'orders',
    queryScope: 'COLLECTION' as const,
    fields: [
      { fieldPath: 'restaurantId', order: 'ASCENDING' as Direction },
      { fieldPath: 'createdAt', order: 'DESCENDING' as Direction },
    ],
  },
  {
    collectionGroup: 'reviews',
    queryScope: 'COLLECTION' as const,
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' as Direction },
      { fieldPath: 'createdAt', order: 'DESCENDING' as Direction },
    ],
  },
];

/* -------------------------------- generate -------------------------------- */

function* combinations<T>(items: readonly T[]): Generator<T[]> {
  const total = 2 ** items.length;
  for (let mask = 0; mask < total; mask += 1) {
    const picked: T[] = [];
    for (let bit = 0; bit < items.length; bit += 1) {
      if (mask & (1 << bit)) picked.push(items[bit]!);
    }
    yield picked;
  }
}

const field = (spec: FilterSpec) =>
  spec.kind === 'array'
    ? ({ fieldPath: spec.fieldPath, arrayConfig: 'CONTAINS' } as const)
    : ({ fieldPath: spec.fieldPath, order: 'ASCENDING' } as const);

const indexes: unknown[] = [];

/**
 * Sorts Firestore already serves from a single-field index, so a composite for
 * them is rejected.
 *
 * This is an empirical list, not a general rule. Firestore accepts
 * `orderBy('deliveryTimeMinutes') + __name__` but refuses the same shape for
 * `rating` — probing each one against the API is the only reliable way, which
 * is what `scripts/probe-queries.mts` is for.
 *
 * One unnecessary entry is enough to fail an entire `firebase deploy`, so it
 * must be excluded here rather than tolerated at deploy time.
 */
const SERVED_BY_SINGLE_FIELD_INDEX = new Set(['rating']);

for (const sort of SORTS) {
  for (const filters of combinations(FILTERS)) {
    const singleFieldSort = sort.order.length === 1 ? sort.order[0]!.fieldPath : null;
    if (
      filters.length === 0 &&
      singleFieldSort &&
      SERVED_BY_SINGLE_FIELD_INDEX.has(singleFieldSort)
    ) {
      continue;
    }

    indexes.push({
      collectionGroup: 'restaurants',
      queryScope: 'COLLECTION',
      // Equality and array-contains filters come first; Firestore requires
      // exactly one range field and it must lead the remaining order-by fields.
      //
      // `__name__` is required, not decorative. Every query ties off with
      // `orderBy(documentId())` so pagination has a total ordering, and an
      // orderBy on the document id is only servable by a composite. The
      // Firebase CLI appends it silently, which hides the requirement —
      // without it Firestore rejects the definition as "not necessary".
      fields: [
        ...filters.map(field),
        ...sort.order,
        { fieldPath: '__name__', order: 'DESCENDING' as Direction },
      ],
    });
  }
}

indexes.push(...OTHER_INDEXES);

const payload = {
  indexes,
  fieldOverrides: [
    // `restaurantId` on a menu item always equals the parent id, so indexing it
    // separately is pure write cost.
    { collectionGroup: 'menu', fieldPath: 'restaurantId', indexes: [] },
  ],
};

const outFile = resolve(process.cwd(), 'firestore.indexes.json');
writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`[indexes] wrote ${indexes.length} indexes to firestore.indexes.json`);
console.log(
  `           ${SORTS.length} sorts x ${2 ** FILTERS.length} filter combinations + ${OTHER_INDEXES.length} bespoke`,
);

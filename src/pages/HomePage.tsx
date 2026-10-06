import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, UtensilsCrossed, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useCuisines } from '@/hooks/useFirestoreData';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useFavouriteToggle } from '@/hooks/useFavouriteToggle';
import { RESTAURANT_SORTS, type RestaurantSort } from '@/services/restaurants';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Modal';
import { RestaurantCard, RestaurantCardSkeleton } from '@/components/RestaurantCard';
import { useDishCovers } from '@/hooks/useDishCovers';
import { useAuth } from '@/context/AuthContext';
import { formatPriceLevel } from '@/lib/format';
import type { Restaurant } from '@/types/models';

const SORT_LABELS: Record<RestaurantSort, string> = {
  relevance: 'Relevance',
  rating: 'Rating',
  deliveryTime: 'Delivery time',
  deliveryFeeLow: 'Delivery fee',
};

export function HomePage() {
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const cuisine = params.get('cuisine');
  const sortParam = params.get('sort');
  // Guard against a hand-edited URL sending an unknown key to the query.
  const sort: RestaurantSort = RESTAURANT_SORTS.includes(sortParam as RestaurantSort)
    ? (sortParam as RestaurantSort)
    : 'relevance';
  const priceParam = Number(params.get('price') ?? 0);
  const maxPrice = priceParam >= 1 && priceParam <= 4 ? priceParam : null;
  const onlyOpen = params.get('open') === '1';

  // Filters live in the URL: shareable, bookmarkable, survives refresh.
  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const filters = useMemo(
    () => ({ search, cuisine, sort, maxPriceLevel: maxPrice, onlyOpen }),
    [search, cuisine, sort, maxPrice, onlyOpen],
  );

  const { restaurants, loading, loadingMore, error, hasMore, loadMore, retry } =
    useRestaurants(filters);
  const { data: cuisines, loading: cuisinesLoading } = useCuisines();

  const activeFilterCount =
    (cuisine ? 1 : 0) + (maxPrice ? 1 : 0) + (onlyOpen ? 1 : 0) + (sort !== 'relevance' ? 1 : 0);

  const clearAll = () => setParams(search ? { q: search } : {}, { replace: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <AdminShortcut />

      {/* Hero — only when browsing, not when a search is active. */}
      {!search && !cuisine && (
        <section className="from-brand-600 to-brand-800 relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="relative z-10 max-w-xl">
            <h1 className="text-3xl leading-tight font-black tracking-tight sm:text-5xl">
              Order food you'll
              <br className="hidden sm:block" /> love, delivered fast.
            </h1>
            <p className="mt-4 max-w-md text-base text-white/85 sm:text-lg">
              Explore {cuisines.length > 0 ? `${cuisines.length}+ ` : ''}cuisines from the best
              restaurants in your city.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#restaurants"
                className="text-brand-700 inline-flex h-11 items-center rounded-xl bg-white px-6 text-sm font-bold transition-transform hover:scale-105 motion-reduce:transform-none"
              >
                Browse restaurants
              </a>
            </div>
          </div>
          <div
            className="pointer-events-none absolute -top-16 -right-16 size-80 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-black/10 blur-2xl"
            aria-hidden
          />
        </section>
      )}

      {/* Cuisine chips */}
      <section aria-label="Filter by cuisine" className="mb-6">
        <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <FilterChip active={!cuisine} onClick={() => updateParam('cuisine', null)}>
            All
          </FilterChip>
          {cuisinesLoading
            ? Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
              ))
            : cuisines.map((item) => (
                <FilterChip
                  key={item}
                  active={cuisine === item}
                  onClick={() => updateParam('cuisine', cuisine === item ? null : item)}
                >
                  {item}
                </FilterChip>
              ))}
        </div>
      </section>

      {/* Filter toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="restaurants" className="text-ink-900 text-lg font-bold tracking-tight">
            {search ? `Results for "${search}"` : (cuisine ?? 'All restaurants')}
          </h2>
          {!loading && !error && (
            <p className="text-ink-500 text-sm">
              {restaurants.length} restaurant{restaurants.length === 1 ? '' : 's'} found
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              leadingIcon={<X className="size-3.5" />}
            >
              Clear ({activeFilterCount})
            </Button>
          )}

          <FilterPanel
            sort={sort}
            maxPrice={maxPrice}
            onlyOpen={onlyOpen}
            onSort={(value) => updateParam('sort', value === 'relevance' ? null : value)}
            onMaxPrice={(value) => updateParam('price', value ? String(value) : null)}
            onOnlyOpen={(value) => updateParam('open', value ? '1' : null)}
          />
        </div>
      </div>

      {/* Results */}
      {error && (
        <Alert tone="danger" title="Could not load restaurants">
          {error}
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={retry}>
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="size-6" />}
          title="No restaurants found"
          description={
            search
              ? `We couldn't find anything for "${search}". Try a different search or clear your filters.`
              : 'Try adjusting your filters to see more restaurants.'
          }
          action={
            activeFilterCount > 0 || search ? (
              <Button
                variant="outline"
                onClick={() => {
                  setParams({}, { replace: true });
                }}
              >
                Reset everything
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <RestaurantGrid restaurants={restaurants} cuisine={cuisine} search={search} />
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={loadMore} loading={loadingMore}>
                Load more restaurants
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- filter controls ---------------------------- */

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-ink-200 text-ink-700 hover:border-ink-300 hover:bg-ink-50 bg-white',
      )}
    >
      {children}
    </button>
  );
}

function FilterPanel({
  sort,
  maxPrice,
  onlyOpen,
  onSort,
  onMaxPrice,
  onOnlyOpen,
}: {
  sort: RestaurantSort;
  maxPrice: number | null;
  onlyOpen: boolean;
  onSort: (value: RestaurantSort) => void;
  onMaxPrice: (value: number | null) => void;
  onOnlyOpen: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = (maxPrice ? 1 : 0) + (onlyOpen ? 1 : 0) + (sort !== 'relevance' ? 1 : 0);

  return (
    <>
      {/* Sort stays visible on desktop; the rest lives in the sheet. */}
      <div className="hidden items-center gap-2 sm:flex">
        <label htmlFor="sort-select" className="sr-only">
          Sort restaurants
        </label>
        <select
          id="sort-select"
          value={sort}
          onChange={(event) => onSort(event.target.value as RestaurantSort)}
          className="border-ink-200 text-ink-700 focus:border-brand-400 focus:ring-brand-500/15 h-9 rounded-xl border bg-white px-3 text-sm font-medium focus:ring-2 focus:outline-none"
        >
          {RESTAURANT_SORTS.map((option) => (
            <option key={option} value={option}>
              {SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        leadingIcon={<SlidersHorizontal className="size-3.5" />}
      >
        Filters{activeCount > 0 && ` (${activeCount})`}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Filters" size="sm">
        <div className="space-y-6">
          <fieldset>
            <legend className="text-ink-800 mb-2 text-sm font-semibold">Sort by</legend>
            <div className="space-y-1.5">
              {RESTAURANT_SORTS.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                    sort === option
                      ? 'border-brand-400 bg-brand-50 text-brand-800 font-semibold'
                      : 'border-ink-200 hover:bg-ink-50',
                  )}
                >
                  <input
                    type="radio"
                    name="sort"
                    value={option}
                    checked={sort === option}
                    onChange={() => onSort(option)}
                    className="accent-brand-600"
                  />
                  {SORT_LABELS[option]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-ink-800 mb-2 text-sm font-semibold">Price</legend>
            <div className="flex flex-wrap gap-2">
              {[null, 1, 2, 3].map((level) => (
                <button
                  key={String(level)}
                  type="button"
                  onClick={() => onMaxPrice(level)}
                  aria-pressed={maxPrice === level}
                  className={cn(
                    'h-9 rounded-xl border px-4 text-sm font-semibold transition-colors',
                    maxPrice === level
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                  )}
                >
                  {level === null ? 'Any' : `${formatPriceLevel(level)} & below`}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="sr-only">Availability</legend>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(event) => onOnlyOpen(event.target.checked)}
                className="accent-brand-600 size-4.5 rounded"
              />
              <span className="text-ink-700 text-sm">Hide closed restaurants</span>
            </label>
          </fieldset>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                onMaxPrice(null);
                onOnlyOpen(false);
                onSort('relevance');
              }}
            >
              Reset
            </Button>
            <Button fullWidth onClick={() => setOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/**
 * A visible route into the admin panel, shown only to accounts that have one.
 *
 * The header already links to the dashboard, and the footer link was labelled
 * "For restaurants", which meant the only way in for an admin was to know it
 * existed. This puts it on the landing page in plain words, and is invisible to
 * everyone else rather than sitting there as a dead link.
 */
function AdminShortcut() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';
  if (!isAdmin) return null;

  return (
    <div className="border-brand-200 bg-brand-50 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
      <p className="text-ink-700 text-sm">
        <span className="font-bold">Admin</span> — manage your restaurants, menus and orders.
      </p>
      <Link
        to="/admin"
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center rounded-lg px-4 text-sm font-bold text-white transition-colors"
      >
        Open admin panel
      </Link>
    </div>
  );
}

/* --------------------------------- grid ----------------------------------- */
function RestaurantGrid({
  restaurants,
  cuisine,
  search,
}: {
  restaurants: Restaurant[];
  cuisine: string | null;
  search: string;
}) {
  const [prompt, setPrompt] = useState(false);
  const { isFavourite, toggle } = useFavouriteToggle(() => setPrompt(true));
  const dishCovers = useDishCovers(restaurants, cuisine, search);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {restaurants.map((restaurant, index) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            isFavourite={isFavourite(restaurant.id)}
            onToggleFavourite={(id) => void toggle(id)}
            onRequireSignIn={() => setPrompt(true)}
            // Only the first two cards sit above the fold; eager-load those.
            priority={index < 2}
            imageOverride={dishCovers[restaurant.id] ?? null}
          />
        ))}
      </div>

      <Modal
        open={prompt}
        onClose={() => setPrompt(false)}
        title="Sign in to save favourites"
        size="sm"
      >
        <p className="text-ink-600 text-sm">
          Create an account to save restaurants you love and track your orders.
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            to="/login"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 flex-1 items-center justify-center rounded-xl text-sm font-semibold text-white"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="border-ink-300 text-ink-800 hover:bg-ink-50 inline-flex h-10 flex-1 items-center justify-center rounded-xl border text-sm font-semibold"
          >
            Sign up
          </Link>
        </div>
      </Modal>
    </>
  );
}

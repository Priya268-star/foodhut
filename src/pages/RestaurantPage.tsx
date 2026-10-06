import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock3,
  Heart,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatDuration, formatMoney, formatPriceLevel } from '@/lib/format';
import { useCart } from '@/context/CartContext';
import { useMenu, useRestaurant } from '@/hooks/useFirestoreData';
import { useFavouriteToggle } from '@/hooks/useFavouriteToggle';
import { groupMenuByCategory } from '@/services/menu';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SmartImage } from '@/components/ui/SmartImage';
import { StarRating } from '@/components/ui/StarRating';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/Primitives';
import { ReviewSection } from '@/components/ReviewSection';
import { fullPageSpinner } from '@/lib/ui';
import type { MenuItem, Restaurant } from '@/types/models';

/** Floating cart pill — the standard delivery-app affordance. */
function DishCountPill() {
  const { itemCount, totals } = useCart();
  if (itemCount === 0) return null;

  return (
    <Link
      to="/cart"
      className="bg-brand-600 fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 motion-reduce:transform-none lg:right-8 lg:bottom-8"
    >
      <ShoppingBag className="size-4" aria-hidden />
      {itemCount} item{itemCount === 1 ? '' : 's'}
      <span className="h-4 w-px bg-white/30" aria-hidden />
      {formatMoney(totals.total)}
    </Link>
  );
}

export function RestaurantPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { restaurant, loading, error, retry } = useRestaurant(restaurantId);
  const { data: menu, loading: menuLoading } = useMenu(restaurantId);
  const [signInPrompt, setSignInPrompt] = useState(false);
  const { isFavourite, toggle } = useFavouriteToggle(() => setSignInPrompt(true));

  if (loading) return fullPageSpinner('Loading restaurant…');

  if (error || !restaurant) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="Restaurant unavailable"
          description={error ?? 'We could not find this restaurant.'}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={retry}>
                Try again
              </Button>
              <Link to="/">
                <Button>Back to home</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const favourite = restaurantId ? isFavourite(restaurantId) : false;

  return (
    <div className="pb-24">
      {/* Cover */}
      <div className="relative h-52 overflow-hidden sm:h-72">
        <SmartImage
          src={restaurant.coverImageUrl ?? restaurant.imageUrl}
          alt=""
          loading="eager"
          className="size-full"
        />
        <div className="from-ink-900/75 via-ink-900/20 absolute inset-0 bg-gradient-to-t to-transparent" />

        <div className="absolute inset-x-0 top-0 mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <Link
            to="/"
            className="text-ink-800 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-semibold shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 text-white">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={restaurant.isOpen ? 'success' : 'danger'}>
                  {restaurant.isOpen ? 'Open now' : 'Closed'}
                </Badge>
                {restaurant.cuisines.slice(0, 3).map((cuisine) => (
                  <span
                    key={cuisine}
                    className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur"
                  >
                    {cuisine}
                  </span>
                ))}
              </div>
              <h1 className="truncate text-2xl font-black tracking-tight sm:text-4xl">
                {restaurant.name}
              </h1>
              <p className="mt-1 line-clamp-1 text-sm text-white/85">
                {formatPriceLevel(restaurant.priceLevel)} ·{' '}
                {restaurant.cuisines.join(', ') || 'Multi-cuisine'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void toggle(restaurant.id)}
              aria-pressed={favourite}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition-colors',
                favourite
                  ? 'bg-brand-600 hover:bg-brand-700 text-white'
                  : 'text-ink-800 bg-white/95 backdrop-blur hover:bg-white',
              )}
            >
              <Heart className={cn('size-4', favourite && 'fill-current')} aria-hidden />
              {favourite ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Meta strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetaTile
            icon={<Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />}
            label="Rating"
            value={
              <StarRating value={restaurant.rating} showValue count={restaurant.ratingCount} />
            }
          />
          <MetaTile
            icon={<Clock3 className="size-4" aria-hidden />}
            label="Delivery time"
            value={formatDuration(restaurant.deliveryTimeMinutes)}
          />
          <MetaTile
            icon={<MapPin className="size-4" aria-hidden />}
            label="Area"
            value={restaurant.location.area}
          />
          <MetaTile
            icon={<span className="text-sm font-bold">₹</span>}
            label="Delivery fee"
            value={restaurant.deliveryFee === 0 ? 'Free' : formatMoney(restaurant.deliveryFee)}
          />
        </div>

        {restaurant.description && (
          <p className="text-ink-600 mt-5 max-w-3xl text-sm leading-relaxed">
            {restaurant.description}
          </p>
        )}

        {!restaurant.isAcceptingOrders && restaurant.isOpen && (
          <Alert tone="warning" title="Not accepting orders right now" className="mt-5">
            This restaurant has paused online orders. You can still browse the menu.
          </Alert>
        )}

        {/* Menu */}
        <section aria-labelledby="menu-heading" className="mt-10">
          <h2 id="menu-heading" className="text-ink-900 text-lg font-bold tracking-tight">
            Menu
          </h2>

          {menuLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="rounded-card border-ink-200 flex gap-4 border bg-white p-4">
                  <Skeleton className="size-28 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : menu.length === 0 ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title="No dishes available"
              description="This restaurant has no dishes listed right now. Check back soon."
            />
          ) : (
            <div className="mt-4 space-y-8">
              {groupMenuByCategory(menu).map((group) => (
                <div key={group.category}>
                  <h3 className="text-ink-500 mb-3 text-sm font-bold tracking-wide uppercase">
                    {group.category}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <MenuRow key={item.id} item={item} restaurant={restaurant} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <ReviewSection restaurant={restaurant} />
      </div>

      <DishCountPill />

      <Modal
        open={signInPrompt}
        onClose={() => setSignInPrompt(false)}
        title="Sign in to continue"
        size="sm"
      >
        <p className="text-ink-600 text-sm">Log in to save this restaurant to your favourites.</p>
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
    </div>
  );
}

/* -------------------------------- fragments ------------------------------- */

function MetaTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-card border-ink-200/80 shadow-card border bg-white p-3.5">
      <div className="text-ink-400 mb-1.5 flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-ink-900 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

/**
 * A dish row with an inline quantity stepper.
 * The stepper only appears once the item is in the cart, keeping the list calm.
 */
function MenuRow({ item, restaurant }: { item: MenuItem; restaurant: Restaurant }) {
  const { addItem, increment, decrement, quantityOf } = useCart();
  const [expanded, setExpanded] = useState(false);

  const quantity = quantityOf(item.id);
  const inCart = quantity > 0;
  const canOrder = restaurant.isOpen && restaurant.isAcceptingOrders;

  return (
    <article
      className={cn(
        'rounded-card flex gap-4 border bg-white p-4 transition-all duration-200',
        'hover:shadow-card',
        inCart ? 'border-brand-200 ring-brand-100 ring-1' : 'border-ink-200/80 shadow-card',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span
            className={cn('diet-dot mt-0.5', item.isVeg ? 'diet-dot--veg' : 'diet-dot--nonveg')}
            aria-hidden
          >
            <span />
          </span>
          <span className="sr-only">{item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}</span>

          <div className="min-w-0 flex-1">
            <h4 className="text-ink-900 font-bold">{item.name}</h4>
            <p className="text-ink-700 mt-0.5 text-sm font-semibold">{formatMoney(item.price)}</p>

            {item.ratingCount > 0 && (
              <div className="mt-1">
                <StarRating value={item.rating} size={11} showValue count={item.ratingCount} />
              </div>
            )}

            <p
              className={cn(
                'text-ink-500 mt-1.5 text-sm leading-relaxed',
                expanded ? '' : 'line-clamp-2',
              )}
            >
              {item.description}
            </p>

            {item.description.length > 110 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-brand-600 hover:text-brand-700 mt-1 text-xs font-semibold"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        </div>

        {canOrder ? (
          <div className="mt-3 pl-6">
            {inCart ? (
              <div className="border-brand-600 inline-flex h-9 items-center overflow-hidden rounded-xl border">
                <button
                  type="button"
                  onClick={() => decrement(item.id)}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="text-brand-700 hover:bg-brand-50 flex h-full w-9 items-center justify-center transition-colors"
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <span
                  className="text-ink-900 w-8 text-center text-sm font-bold"
                  aria-live="polite"
                  aria-label={`Quantity ${quantity}`}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => increment(item.id)}
                  disabled={quantity >= 20}
                  aria-label={`Increase quantity of ${item.name}`}
                  className="text-brand-700 hover:bg-brand-50 flex h-full w-9 items-center justify-center transition-colors disabled:opacity-40"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => addItem(restaurant, item)}
                leadingIcon={<Plus className="size-3.5" />}
              >
                Add
              </Button>
            )}
          </div>
        ) : (
          !restaurant.isOpen && (
            <p className="text-ink-400 mt-3 pl-6 text-xs font-medium">
              Ordering is unavailable — the restaurant is closed.
            </p>
          )
        )}
      </div>

      <SmartImage
        src={item.imageUrl}
        alt={item.name}
        aspect="aspect-square"
        sizes="112px"
        className="size-24 shrink-0 rounded-xl sm:size-28"
      />
    </article>
  );
}

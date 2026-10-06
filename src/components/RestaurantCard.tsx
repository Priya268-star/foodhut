import { Link } from 'react-router-dom';
import { Clock3, Heart, MapPin } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatDuration, formatPriceLevel } from '@/lib/format';
import { SmartImage } from '@/components/ui/SmartImage';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/Primitives';
import type { Restaurant } from '@/types/models';

interface RestaurantCardProps {
  restaurant: Restaurant;
  isFavourite: boolean;
  onToggleFavourite: (restaurantId: string) => void;
  onRequireSignIn: () => void;
  /** Only the first row loads eagerly to speed up LCP. */
  priority?: boolean;
  /**
   * Photograph of the dish that matched the active filter, used instead of the
   * restaurant cover. Searching "biryani" should illustrate the result with a
   * biryani, not with whatever generic shot the restaurant was photographed with.
   */
  imageOverride?: string | null;
}

export function RestaurantCard({
  restaurant,
  isFavourite,
  onToggleFavourite,
  onRequireSignIn,
  priority = false,
  imageOverride = null,
}: RestaurantCardProps) {
  const closed = !restaurant.isOpen;

  return (
    <article
      className={cn(
        'group rounded-card border-ink-200/80 relative flex flex-col overflow-hidden border bg-white',
        'shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5',
        'motion-reduce:hover:translate-y-0',
      )}
    >
      <Link
        to={`/restaurants/${restaurant.id}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
        // Screen readers get the full context; the image alt is decorative.
        aria-label={`${restaurant.name}, ${restaurant.cuisines.join(', ')}`}
      >
        <div className="relative">
          <SmartImage
            src={imageOverride ?? restaurant.imageUrl}
            alt=""
            aspect="aspect-[16/10]"
            loading={priority ? 'eager' : 'lazy'}
            sizes="(min-width: 1280px) 300px, (min-width: 768px) 45vw, 90vw"
            className="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
          />

          {/* Offer / status strip */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
            {closed ? (
              <Badge tone="danger" className="shadow-sm">
                Closed
              </Badge>
            ) : restaurant.deliveryFee === 0 ? (
              <Badge tone="success" className="shadow-sm">
                Free delivery
              </Badge>
            ) : (
              <Badge tone="brand" className="shadow-sm">
                {formatPriceLevel(restaurant.priceLevel)} · {restaurant.cuisines[0] ?? 'Food'}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-ink-900 line-clamp-1 text-[0.95rem] leading-tight font-bold">
              {restaurant.name}
            </h3>
            <StarRating value={restaurant.rating} size={12} />
          </div>

          <p className="text-ink-500 text-xs">
            {formatPriceLevel(restaurant.priceLevel)} ·{' '}
            {restaurant.cuisines.slice(0, 2).join(', ') || 'Multi-cuisine'}
          </p>

          <div className="text-ink-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden />
              {formatDuration(restaurant.deliveryTimeMinutes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              <span className="line-clamp-1">{restaurant.location.area}</span>
            </span>
          </div>
        </div>
      </Link>

      {/* Favourite toggle sits above the link so it does not navigate. */}
      <button
        type="button"
        onClick={() => (isFavourite ? onToggleFavourite(restaurant.id) : onRequireSignIn())}
        aria-pressed={isFavourite}
        aria-label={
          isFavourite
            ? `Remove ${restaurant.name} from favourites`
            : `Add ${restaurant.name} to favourites`
        }
        className={cn(
          'absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full',
          'bg-white/95 shadow-sm backdrop-blur transition-all duration-150',
          'hover:scale-110 active:scale-95 motion-reduce:transform-none',
          isFavourite ? 'text-brand-600' : 'text-ink-400 hover:text-brand-500',
        )}
      >
        <Heart className={cn('size-4.5', isFavourite && 'fill-current')} aria-hidden />
      </button>
    </article>
  );
}

/* ------------------------------ grid skeleton ----------------------------- */

export function RestaurantCardSkeleton() {
  return (
    <div className="rounded-card border-ink-200/80 shadow-card overflow-hidden border bg-white">
      <div className="shimmer aspect-[16/10] w-full" />
      <div className="space-y-2 p-3.5">
        <div className="shimmer h-4 w-3/4 rounded" />
        <div className="shimmer h-3 w-1/2 rounded" />
        <div className="shimmer h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

import { Star } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Star rating display. Supports fractional averages (4.3 of 5) by using a
 * clipped overlay, and an interactive mode for the review form.
 */
interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  className?: string;
}

export function StarRating({
  value,
  max = 5,
  size = 14,
  showValue = false,
  count,
  className,
}: StarRatingProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = (clamped / max) * 100;

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      // The visual is decorative; the text below carries the real value.
      role="img"
      aria-label={`Rated ${clamped.toFixed(1)} out of ${max}${count !== undefined ? ` from ${count} reviews` : ''}`}
    >
      <span className="relative inline-flex">
        {/* Empty layer */}
        <span className="flex gap-0.5">
          {Array.from({ length: max }, (_, i) => (
            <Star key={i} size={size} className="text-ink-300" strokeWidth={1.5} aria-hidden />
          ))}
        </span>
        {/* Filled layer, clipped to the average */}
        <span
          className="absolute inset-0 flex gap-0.5 overflow-hidden"
          style={{ width: `${percent}%` }}
          aria-hidden
        >
          {Array.from({ length: max }, (_, i) => (
            <Star
              key={i}
              size={size}
              className="shrink-0 fill-amber-400 text-amber-400"
              strokeWidth={1.5}
            />
          ))}
        </span>
      </span>

      {showValue && (
        <span className="text-ink-800 text-sm font-semibold">
          {clamped.toFixed(1)}
          {count !== undefined && <span className="text-ink-500 ml-1 font-normal">({count})</span>}
        </span>
      )}
    </div>
  );
}

/* --------------------------- interactive variant -------------------------- */

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  size?: number;
  disabled?: boolean;
  className?: string;
}

export function StarInput({
  value,
  onChange,
  max = 5,
  size = 28,
  disabled,
  className,
}: StarInputProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      role="radiogroup"
      aria-label="Rating"
      onKeyDown={(event) => {
        // Arrow keys move between stars, as a radiogroup should.
        if (disabled) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          onChange(Math.min(value + 1, max));
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(Math.max(value - 1, 1));
        }
      }}
    >
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const active = starValue <= value;

        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={starValue === value}
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
            disabled={disabled}
            onClick={() => onChange(starValue)}
            className={cn(
              'rounded p-0.5 transition-transform',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            <Star
              size={size}
              aria-hidden
              className={cn(
                'transition-colors',
                active ? 'fill-amber-400 text-amber-400' : 'text-ink-300',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

import { cn } from '@/lib/cn';

interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Rendered when `src` is empty or fails to load. */
  fallback?: React.ReactNode;
  loading?: 'lazy' | 'eager';
  /** Aspect ratio utility, e.g. `aspect-[4/3]`. Keeps the grid from shifting. */
  aspect?: string;
  sizes?: string;
}

/**
 * `<img>` with graceful degradation: shows a neutral placeholder when the URL
 * is missing or 404s, and switches to eager loading above the fold.
 */
export function SmartImage({
  src,
  alt,
  className,
  fallback,
  loading = 'lazy',
  aspect,
  sizes,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  const showFallback = !src || failed;

  return (
    <div className={cn('bg-ink-100 relative overflow-hidden', aspect, className)}>
      {showFallback ? (
        (fallback ?? (
          <div className="text-ink-300 flex size-full items-center justify-center">
            <ImageOff className="size-8" aria-hidden />
          </div>
        ))
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          sizes={sizes}
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </div>
  );
}

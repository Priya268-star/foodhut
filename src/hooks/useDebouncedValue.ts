import { useEffect, useState } from 'react';

/**
 * Debounce a rapidly-changing value (search boxes, filters).
 *
 * The delay is cleared on unmount and whenever the value changes, so a fast
 * typist typing "pizza" issues one query, not four.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

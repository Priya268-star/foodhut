/**
 * Firebase value converters.
 *
 * Centralising conversion keeps the rest of the codebase free of
 * `instanceof Timestamp` checks and makes the mappers in `mappers.ts` total
 * (they always return a valid value, even for legacy documents).
 */
import { Timestamp } from 'firebase/firestore';

/** Always yields a `Timestamp` — for fields we generate ourselves. */
export function now(): Timestamp {
  return Timestamp.now();
}

/**
 * Yields a `Timestamp` from whatever is stored: a real `Timestamp`, a raw
 * millisecond number (common after JSON serialisation), an ISO string, or
 * nothing at all. Falls back to `Timestamp.now()`.
 */
export function toMillis(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return Timestamp.fromMillis(value);
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Timestamp.fromMillis(parsed);
  }
  return Timestamp.now();
}

/** Server-authoritative time, stamped on the client before write. */
export function serverTimestampField() {
  return { createdAt: now(), updatedAt: now() };
}

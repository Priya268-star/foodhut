import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { ClassValue };

/**
 * Merge Tailwind class names with conflict resolution.
 *
 * `clsx` handles conditionals and arrays, `tailwind-merge` resolves conflicting
 * Tailwind utilities so caller-supplied classes reliably win over defaults
 * (e.g. `cn('p-2', 'p-4')` -> `'p-4'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

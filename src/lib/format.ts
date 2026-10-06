/** Formatting helpers. Money is stored in the smallest unit; we format here. */

/*
 * Whole rupees, with no fraction digits.
 *
 * `calculateTotals` rounds tax to a whole rupee precisely so that this stays
 * truthful: an earlier version formatted with two fraction digits and a
 * `maximumFractionDigits: 0` variant had both appeared over the project's life -
 * the first truncated ₹929.40 to ₹929, hiding 40 paise from the total that was
 * actually stored. Now that every money value is a whole number of rupees, plain
 * integers are accurate rather than convenient, and the reader sees exactly the
 * figure in the database.
 */
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** `45000` -> `"₹45,000"` (rupees). Input is in paise. */
export function formatMoney(paise: number): string {
  return currencyFormatter.format(paise / 100);
}

/** Rupees from paise, no currency symbol — used inside inputs. */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Rupees (possibly a decimal string) to paise, rounded to the nearest paisa. */
export function rupeesToPaise(rupees: number | string): number {
  const value = typeof rupees === 'string' ? Number.parseFloat(rupees) : rupees;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** `"1,250"` -> `125000` paise. */
export function parseRupeesToPaise(input: string): number {
  const digits = input.replace(/[^\d.]/g, '');
  return rupeesToPaise(digits);
}

const TAX_RATE = 0.05; // 5% GST
export const DELIVERY_FEE_FALLBACK = 4000; // ₹40

export interface CartTotalsInput {
  deliveryFee: number;
}

/**
 * Single source of truth for checkout maths — the cart summary, the checkout
 * summary and the stored order all derive from this one function, so the three
 * can never disagree.
 */
export function calculateTotals(
  lines: ReadonlyArray<{ unitPrice: number; quantity: number }>,
  { deliveryFee }: CartTotalsInput,
) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  /*
   * Tax is rounded to a whole rupee, not to a whole paisa.
   *
   * Prices are whole rupees, so 5% of ₹978 is ₹48.90 - a figure that made the
   * summary read "To pay ₹1,075.90" and forced the currency formatter to show
   * paise everywhere just to stay consistent. Rounding at the source means the
   * subtotal, tax and total are all whole rupees, so the amount stored in the
   * order is exactly the amount the customer was shown, and the formatter can go
   * back to plain rupees.
   *
   * Math.round(x / 100) * 100 is used rather than Math.round(x) because `x` is in
   * paise: rounding to the nearest paisa would leave ₹48.90 untouched.
   */
  const tax = Math.round((subtotal * TAX_RATE) / 100) * 100;
  const total = subtotal + deliveryFee + tax;

  return { subtotal, deliveryFee, tax, total };
}

/** `"45 min"` from minutes. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Price level (1–4) rendered as currency symbols, e.g. `₹₹`. */
export function formatPriceLevel(level: number): string {
  return '₹'.repeat(Math.min(Math.max(level, 1), 4));
}

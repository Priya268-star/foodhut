import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';

import { formatMoney } from '@/lib/format';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { EmptyState } from '@/components/ui/Primitives';

export function CartPage() {
  const { cart, totals, itemCount, setQuantity, decrement, removeItem, clearCart, isEmpty } =
    useCart();
  const navigate = useNavigate();

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShoppingBag className="size-6" />}
          title="Your cart is empty"
          description="Hungry? Add a few dishes from a restaurant near you to get started."
          action={
            <Link to="/">
              <Button>Browse restaurants</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-xl font-bold tracking-tight sm:text-2xl">Your cart</h1>
          <p className="text-ink-500 mt-1 text-sm">
            {itemCount} item{itemCount === 1 ? '' : 's'} from{' '}
            <span className="text-ink-700 font-semibold">{cart.restaurantName}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearCart}
          leadingIcon={<Trash2 className="size-3.5" />}
        >
          Clear cart
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Lines */}
        <ul className="space-y-3">
          {cart.lines.map((line) => (
            <li
              key={line.menuItemId}
              className="rounded-card border-ink-200/80 shadow-card flex gap-4 border bg-white p-4"
            >
              <SmartImage
                src={line.imageUrl}
                alt=""
                aspect="aspect-square"
                className="size-20 shrink-0 rounded-xl sm:size-24"
              />

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <h3 className="text-ink-900 font-bold">{line.name}</h3>
                  <p className="text-ink-500 mt-0.5 text-sm">{formatMoney(line.unitPrice)} each</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="border-ink-300 inline-flex h-9 items-center overflow-hidden rounded-xl border">
                    <button
                      type="button"
                      onClick={() => decrement(line.menuItemId)}
                      aria-label={`Decrease quantity of ${line.name}`}
                      className="text-ink-600 hover:bg-ink-100 flex h-full w-9 items-center justify-center transition-colors"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="w-8 text-center text-sm font-bold" aria-live="polite">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.menuItemId, line.quantity + 1)}
                      disabled={line.quantity >= 20}
                      aria-label={`Increase quantity of ${line.name}`}
                      className="text-ink-600 hover:bg-ink-100 flex h-full w-9 items-center justify-center transition-colors disabled:opacity-40"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>

                  <p className="text-ink-900 w-20 text-right text-sm font-bold">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </p>

                  <button
                    type="button"
                    onClick={() => removeItem(line.menuItemId)}
                    aria-label={`Remove ${line.name} from cart`}
                    className="text-ink-400 rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}

          <li className="pt-1">
            <Link
              to="/"
              className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              <UtensilsCrossed className="size-4" aria-hidden />
              Add more items
            </Link>
          </li>
        </ul>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border-ink-200/80 shadow-card border bg-white p-5">
            <h2 className="text-ink-900 text-base font-bold">Bill details</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Item total</dt>
                <dd className="text-ink-900 font-medium">{formatMoney(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Delivery fee</dt>
                <dd className="text-ink-900 font-medium">
                  {totals.deliveryFee === 0 ? (
                    <span className="text-emerald-600">Free</span>
                  ) : (
                    formatMoney(totals.deliveryFee)
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Taxes and charges</dt>
                <dd className="text-ink-900 font-medium">{formatMoney(totals.tax)}</dd>
              </div>

              <div className="border-ink-200 flex justify-between border-t border-dashed pt-3 text-base">
                <dt className="text-ink-900 font-bold">To pay</dt>
                <dd className="text-ink-900 font-bold">{formatMoney(totals.total)}</dd>
              </div>
            </dl>

            <Button fullWidth size="lg" className="mt-5" onClick={() => navigate('/checkout')}>
              Proceed to checkout
            </Button>

            <p className="text-ink-400 mt-3 text-center text-xs">
              You won't be charged until you place the order.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

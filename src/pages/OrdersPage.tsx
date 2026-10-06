import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Package, ShoppingBag, Truck, XCircle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { useMyOrders } from '@/hooks/useFirestoreData';
import { Button } from '@/components/ui/Button';
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui/Primitives';
import { CancelOrderButton } from '@/components/CancelOrderButton';
import { ACTIVE_ORDER_STATUSES, type Order, type OrderStatus } from '@/types/models';

const STATUS_STYLE: Record<OrderStatus, { icon: typeof Package; tone: string; label: string }> = {
  placed: { icon: CheckCircle2, tone: 'text-sky-600 bg-sky-50', label: 'Order placed' },
  confirmed: { icon: CheckCircle2, tone: 'text-sky-600 bg-sky-50', label: 'Confirmed' },
  preparing: { icon: Package, tone: 'text-amber-600 bg-amber-50', label: 'Preparing' },
  out_for_delivery: { icon: Truck, tone: 'text-violet-600 bg-violet-50', label: 'On the way' },
  delivered: { icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50', label: 'Delivered' },
  cancelled: { icon: XCircle, tone: 'text-red-600 bg-red-50', label: 'Cancelled' },
};

export function OrdersPage() {
  const { data: orders, loading, error, refresh } = useMyOrders();

  const [params] = useSearchParams();
  const justPlaced = params.get('placed');

  const active = useMemo(
    () => orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)),
    [orders],
  );
  const past = useMemo(
    () => orders.filter((order) => !ACTIVE_ORDER_STATUSES.includes(order.status)),
    [orders],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-ink-900 mb-6 text-xl font-bold tracking-tight sm:text-2xl">My orders</h1>

      {justPlaced && (
        <Alert
          tone="success"
          title="Order placed successfully"
          className="mb-5"
          icon={<CheckCircle2 className="size-5" />}
        >
          We've sent it to the restaurant. You can track it below.
        </Alert>
      )}

      {error && (
        <Alert tone="danger" title="Could not load your orders" className="mb-5">
          {error}
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={refresh}>
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="rounded-card h-32 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-6" />}
          title="No orders yet"
          description="When you place an order it will show up here so you can track it."
          action={
            <Link to="/">
              <Button>Start ordering</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section aria-labelledby="active-orders">
              <h2 id="active-orders" className="text-ink-500 mb-3 text-sm font-bold uppercase">
                Ongoing ({active.length})
              </h2>
              <ul className="space-y-3">
                {active.map((order) => (
                  <OrderCard key={order.id} order={order} highlight={order.id === justPlaced} />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section aria-labelledby="past-orders">
              <h2 id="past-orders" className="text-ink-500 mb-3 text-sm font-bold uppercase">
                Past orders ({past.length})
              </h2>
              <ul className="space-y-3">
                {past.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- order card ------------------------------ */

function OrderCard({ order, highlight }: { order: Order; highlight?: boolean }) {
  const style = STATUS_STYLE[order.status];
  const Icon = style.icon;
  const isCancellable = ACTIVE_ORDER_STATUSES.includes(order.status);

  return (
    <li>
      <Card className={cn('overflow-hidden', highlight && 'ring-2 ring-emerald-500/40')}>
        <div className="border-ink-100 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-sm font-bold">{order.restaurantName}</p>
            <p className="text-ink-500 text-xs">
              Order #{order.id.slice(0, 8).toUpperCase()} ·{' '}
              {order.createdAt.toDate().toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
              style.tone,
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {style.label}
          </div>
        </div>

        <div className="px-4 py-3.5">
          <ul className="space-y-1.5">
            {order.items.map((item) => (
              <li
                key={item.menuItemId}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-ink-700 min-w-0">
                  <span className="text-ink-900 font-semibold">{item.quantity}×</span>{' '}
                  <span className="line-clamp-1">{item.name}</span>
                </span>
                <span className="text-ink-500 shrink-0">
                  {formatMoney(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-ink-200 mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-3">
            <p className="text-ink-500 text-xs">
              Delivering to <span className="text-ink-700 font-medium">{order.address.label}</span>{' '}
              · {order.address.line1}, {order.address.city} {order.address.postalCode}
            </p>
            <p className="text-ink-900 text-sm font-bold">{formatMoney(order.total)}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to={`/restaurants/${order.restaurantId}`}
              className="text-brand-600 hover:text-brand-700 text-xs font-semibold"
            >
              Order again
            </Link>

            {isCancellable && <CancelOrderButton orderId={order.id} />}
          </div>
        </div>
      </Card>
    </li>
  );
}

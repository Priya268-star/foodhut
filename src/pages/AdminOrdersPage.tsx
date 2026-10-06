import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Phone, Receipt } from 'lucide-react';

import { formatMoney } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { subscribeToManagedRestaurants } from '@/services/admin';
import { subscribeToRestaurantOrders, updateOrderStatus } from '@/services/orders';
import { Button } from '@/components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '@/components/ui/Primitives';
import { StatusPill } from '@/components/StatusPill';
import type { Order, OrderStatus, Restaurant } from '@/types/models';

/** The one action an owner may take from each state — keeps illegal moves impossible. */
const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  placed: { status: 'confirmed', label: 'Accept order' },
  confirmed: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'out_for_delivery', label: 'Out for delivery' },
  out_for_delivery: { status: 'delivered', label: 'Mark delivered' },
};

export function AdminOrdersPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { user, isAdmin } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    return subscribeToManagedRestaurants(user.uid, isAdmin, {
      onChange: (next) => {
        setRestaurants(next);
        setLoading(false);
      },
      onError: () => setLoading(false),
    });
  }, [user, isAdmin]);

  const activeId = restaurantId ?? restaurants[0]?.id;

  useEffect(() => {
    if (!activeId) return;

    setLoading(true);
    return subscribeToRestaurantOrders(activeId, {
      onChange: (next) => {
        setOrders(next);
        setLoading(false);
      },
      onError: (message) => {
        setError(message);
        setLoading(false);
      },
    });
  }, [activeId]);

  const advance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;

    setUpdatingId(order.id);
    setError(null);
    try {
      await updateOrderStatus(order.id, next.status);
    } catch (err) {
      console.error('[admin] status update failed', err);
      setError('Could not update this order. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6" label="Loading orders" />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          title="No restaurants yet"
          description="Add a restaurant first — orders will appear here once you do."
          action={
            <Link to="/admin">
              <Button>Go to dashboard</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="text-ink-500 mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link to="/admin" className="hover:text-brand-600">
          Dashboard
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-ink-800 font-semibold">Orders</span>
      </div>

      <h1 className="text-ink-900 mb-1 text-xl font-bold tracking-tight sm:text-2xl">Orders</h1>
      <p className="text-ink-500 mb-5 text-sm">
        {orders.length} order{orders.length === 1 ? '' : 's'} · updates in real time
      </p>

      {restaurants.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {restaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              to={`/admin/restaurants/${restaurant.id}/orders`}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                restaurant.id === activeId
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              {restaurant.name}
            </Link>
          ))}
        </div>
      )}

      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="No orders yet"
            description="New orders will appear here the moment a customer checks out."
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const next = NEXT_STATUS[order.status];

            return (
              <li key={order.id}>
                <Card className="overflow-hidden">
                  <div className="border-ink-100 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-ink-900 text-sm font-bold">{order.userName}</p>
                      <p className="text-ink-500 text-xs">
                        #{order.id.slice(0, 8).toUpperCase()} ·{' '}
                        {order.createdAt.toDate().toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </div>

                  <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
                    <div>
                      <h3 className="text-ink-500 mb-2 text-xs font-bold uppercase">Items</h3>
                      <ul className="space-y-1.5">
                        {order.items.map((item) => (
                          <li key={item.menuItemId} className="flex justify-between gap-3 text-sm">
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

                      <dl className="border-ink-200 mt-3 space-y-1 border-t border-dashed pt-3 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-ink-600">Delivery</dt>
                          <dd>{formatMoney(order.deliveryFee)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-600">Tax</dt>
                          <dd>{formatMoney(order.tax)}</dd>
                        </div>
                        <div className="flex justify-between font-bold">
                          <dt>Total</dt>
                          <dd>{formatMoney(order.total)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <h3 className="text-ink-500 mb-2 text-xs font-bold uppercase">Deliver to</h3>
                      <p className="text-ink-700 text-sm">
                        <span className="text-ink-900 font-semibold">{order.address.label}</span>
                        <br />
                        {order.address.line1}
                        {order.address.line2 && <>, {order.address.line2}</>}
                        <br />
                        {order.address.city} {order.address.postalCode}
                      </p>

                      <a
                        href={`tel:${order.address.phone.replace(/\s/g, '')}`}
                        className="text-brand-600 hover:text-brand-700 mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold"
                      >
                        <Phone className="size-3.5" aria-hidden />
                        {order.address.phone}
                      </a>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge tone={order.paymentMethod === 'cod' ? 'info' : 'brand'}>
                          {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Prepaid (demo)'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {next && (
                    <div className="border-ink-100 bg-ink-50/50 flex justify-end gap-2 border-t px-4 py-3">
                      <Button
                        size="sm"
                        loading={updatingId === order.id}
                        onClick={() => void advance(order)}
                      >
                        {next.label}
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ChefHat,
  IndianRupee,
  Plus,
  Star,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';

import { formatMoney } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { subscribeToManagedRestaurants } from '@/services/admin';
import { subscribeToRestaurantOrders } from '@/services/orders';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, Spinner } from '@/components/ui/Primitives';
import { StatusPill } from '@/components/StatusPill';
import type { Order, Restaurant } from '@/types/models';

export function AdminDashboardPage() {
  const { user, profile, isAdmin } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [ordersByRestaurant, setOrdersByRestaurant] = useState<Record<string, Order[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToManagedRestaurants(user.uid, isAdmin, {
      onChange: (next) => {
        setRestaurants(next);
        setLoading(false);
      },
      onError: () => setLoading(false),
    });

    return unsubscribe;
  }, [user, isAdmin]);

  // Subscribe to the live order feed for each restaurant the owner manages.
  useEffect(() => {
    if (restaurants.length === 0) return;

    const unsubscribes = restaurants.map((restaurant) =>
      subscribeToRestaurantOrders(restaurant.id, {
        onChange: (orders) =>
          setOrdersByRestaurant((current) => ({ ...current, [restaurant.id]: orders })),
        onError: () => undefined,
      }),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [restaurants]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6" label="Loading dashboard" />
      </div>
    );
  }

  const allOrders = Object.values(ordersByRestaurant).flat();
  const pending = allOrders.filter(
    (order) => order.status === 'placed' || order.status === 'confirmed',
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-7">
        <p className="text-brand-600 text-sm font-semibold">
          {profile?.role === 'admin' ? 'Admin' : 'Restaurant owner'}
        </p>
        <h1 className="text-ink-900 mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
          Welcome back, {profile?.displayName?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-ink-500 mt-1 text-sm">
          Manage your restaurants, menus and incoming orders.
        </p>
      </header>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Building2 className="size-5" aria-hidden />}
          label="Restaurants"
          value={String(restaurants.length)}
          tone="brand"
        />
        <StatCard
          icon={<TrendingUp className="size-5" aria-hidden />}
          label="Total orders"
          value={String(allOrders.length)}
          tone="info"
        />
        <StatCard
          icon={<UtensilsCrossed className="size-5" aria-hidden />}
          label="New orders"
          value={String(pending.length)}
          tone="warning"
        />
        <StatCard
          icon={<IndianRupee className="size-5" aria-hidden />}
          label="Revenue"
          value={formatMoney(
            allOrders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0),
          )}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Restaurants */}
        <section className="lg:col-span-2" aria-labelledby="your-restaurants">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="your-restaurants" className="text-ink-900 text-base font-bold">
              Your restaurants
            </h2>
            <Link
              to="/admin/new"
              className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-sm font-semibold"
            >
              <Plus className="size-4" aria-hidden />
              Add restaurant
            </Link>
          </div>

          {restaurants.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ChefHat className="size-6" />}
                title="No restaurants yet"
                description="Add your first restaurant to start taking orders on Foodhut."
                action={
                  <Link to="/admin/new">
                    <Button leadingIcon={<Plus className="size-4" />}>Add restaurant</Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {restaurants.map((restaurant) => {
                const orders = ordersByRestaurant[restaurant.id] ?? [];
                const revenue = orders
                  .filter((order) => order.status === 'delivered')
                  .reduce((sum, order) => sum + order.total, 0);

                return (
                  <li key={restaurant.id}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-ink-900 font-bold">{restaurant.name}</h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                                restaurant.isOpen
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {restaurant.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>

                          <p className="text-ink-500 mt-1 text-xs">
                            {restaurant.cuisines.join(', ') || 'Multi-cuisine'} ·{' '}
                            {restaurant.location.area}
                          </p>

                          <div className="text-ink-600 mt-2.5 flex flex-wrap items-center gap-4 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <Star
                                className="size-3.5 fill-amber-400 text-amber-400"
                                aria-hidden
                              />
                              {restaurant.rating.toFixed(1)} ({restaurant.ratingCount})
                            </span>
                            <span>{orders.length} orders</span>
                            <span className="font-semibold">{formatMoney(revenue)} earned</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Link to={`/admin/restaurants/${restaurant.id}/menu`}>
                            <Button
                              size="sm"
                              variant="outline"
                              leadingIcon={<UtensilsCrossed className="size-3.5" />}
                            >
                              Menu
                            </Button>
                          </Link>
                          <Link to={`/admin/restaurants/${restaurant.id}/orders`}>
                            <Button size="sm" trailingIcon={<ArrowRight className="size-3.5" />}>
                              Orders
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent orders */}
        <section aria-labelledby="recent-orders">
          <h2 id="recent-orders" className="text-ink-900 mb-3 text-base font-bold">
            Recent orders
          </h2>

          {allOrders.length === 0 ? (
            <Card className="p-5">
              <p className="text-ink-500 text-sm">
                Orders from your restaurants will appear here in real time.
              </p>
            </Card>
          ) : (
            <ul className="space-y-2.5">
              {allOrders
                .slice()
                .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
                .slice(0, 6)
                .map((order) => (
                  <li key={order.id}>
                    <Card className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-ink-900 truncate text-sm font-semibold">
                            {order.userName}
                          </p>
                          <p className="text-ink-500 text-xs">{order.restaurantName}</p>
                        </div>
                        <p className="text-ink-900 shrink-0 text-sm font-bold">
                          {formatMoney(order.total)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <StatusPill status={order.status} />
                        <span className="text-ink-400 text-[0.65rem]">
                          {order.createdAt.toDate().toLocaleTimeString('en-IN', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </Card>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------- fragments ------------------------------- */

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'brand' | 'info' | 'warning' | 'success';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    info: 'bg-sky-50 text-sky-600',
    warning: 'bg-amber-50 text-amber-600',
    success: 'bg-emerald-50 text-emerald-600',
  } as const;

  return (
    <Card className="p-4">
      <div className={`flex size-9 items-center justify-center rounded-xl ${tones[tone]}`}>
        {icon}
      </div>
      <p className="text-ink-900 mt-3 text-2xl font-black tracking-tight">{value}</p>
      <p className="text-ink-500 text-xs font-medium">{label}</p>
    </Card>
  );
}

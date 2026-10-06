import { lazy } from 'react';
import { Navigate, createBrowserRouter, useParams } from 'react-router-dom';

import { AppLayout } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { HomePage } from '@/pages/HomePage';
import { RestaurantPage } from '@/pages/RestaurantPage';
import { CartPage } from '@/pages/CartPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Route-level code splitting.
 *
 * Auth and admin pages pull in forms, image upload and heavy UI, so they load
 * only when actually visited. The public shell stays in the main chunk.
 */
const AuthPage = lazy(() =>
  import('@/pages/AuthPage').then((m) => ({
    default: ({ mode }: { mode: 'login' | 'signup' }) => <m.AuthPage mode={mode} />,
  })),
);
const CheckoutPage = lazy(() =>
  import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
);
const OrdersPage = lazy(() =>
  import('@/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })),
);
const CreditsPage = lazy(() =>
  import('@/pages/CreditsPage').then((m) => ({ default: m.CreditsPage })),
);
const FavouritesPage = lazy(() =>
  import('@/pages/FavouritesPage').then((m) => ({ default: m.FavouritesPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const AdminDashboardPage = lazy(() =>
  import('@/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminMenuPage = lazy(() =>
  import('@/pages/AdminMenuPage').then((m) => ({ default: m.AdminMenuPage })),
);
const AdminOrdersPage = lazy(() =>
  import('@/pages/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })),
);
const AdminNewRestaurantPage = lazy(() =>
  import('@/pages/AdminNewRestaurantPage').then((m) => ({ default: m.AdminNewRestaurantPage })),
);

const routes = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'restaurants/:restaurantId', element: <RestaurantPage /> },

      { path: 'login', element: <AuthPage mode="login" /> },
      { path: 'signup', element: <AuthPage mode="signup" /> },

      { path: 'cart', element: <CartPage /> },

      {
        // Everything below requires a session.
        element: <ProtectedRoute />,
        children: [
          { path: 'checkout', element: <CheckoutPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'favourites', element: <FavouritesPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },

      {
        // Owner/admin only.
        element: <ProtectedRoute requireRole="owner" />,
        children: [
          { path: 'admin', element: <AdminDashboardPage /> },
          { path: 'admin/new', element: <AdminNewRestaurantPage /> },
          { path: 'admin/restaurants/:restaurantId/menu', element: <AdminMenuPage /> },
          { path: 'admin/restaurants/:restaurantId/orders', element: <AdminOrdersPage /> },
        ],
      },

      { path: 'restaurant/:restaurantId', element: <LegacyRestaurantRedirect /> },
      { path: 'credits', element: <CreditsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

/** Keeps older `/restaurant/:id` links working after the plural rename. */
function LegacyRestaurantRedirect() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  return <Navigate to={`/restaurants/${restaurantId ?? ''}`} replace />;
}

/**
 * One router instance, created once. `createBrowserRouter` owns the history
 * listener, so it must not be called during render.
 */
export const router = createBrowserRouter(routes);

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '@/context/AuthContext';
import { fullPageSpinner } from '@/lib/ui';

interface ProtectedRouteProps {
  /** Render a different flow (e.g. an owner-only view) when signed in. */
  requireRole?: 'owner' | 'admin';
  children?: ReactNode;
}

/**
 * Route guard. Three states matter and are all handled:
 *  1. auth still resolving -> wait (never redirect, or we bounce signed-in users to /login)
 *  2. signed out          -> redirect to /login, remembering where they were going
 *  3. signed in but wrong role -> redirect to a safe landing page
 */
export function ProtectedRoute({ requireRole, children }: ProtectedRouteProps) {
  const { isSignedIn, initialising, profile, isOwner, isAdmin } = useAuth();
  const location = useLocation();

  if (initialising) {
    return fullPageSpinner('Checking your session…');
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // The profile loads slightly after the auth state; wait before judging the role.
  if (!profile) {
    return fullPageSpinner('Loading your account…');
  }

  const roleAllowed = !requireRole || (requireRole === 'admin' ? isAdmin : isOwner || isAdmin);

  if (!roleAllowed) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

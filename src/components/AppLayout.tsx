import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  User as UserIcon,
  X,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Primitives';

const NAV_LINK = 'rounded-lg px-3 py-2 text-sm font-medium transition-colors';
const NAV_LINK_IDLE = 'text-ink-600 hover:bg-ink-100 hover:text-ink-900';
const NAV_LINK_ACTIVE = 'bg-brand-50 text-brand-700';

/**
 * App shell: sticky header, outlet, footer.
 * Search lives in the header but is lifted into the URL so results are
 * shareable and survive a refresh.
 */
export function AppLayout() {
  const { isSignedIn, user, profile, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchDraft, setSearchDraft] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') ?? '';
  });
  const debouncedSearch = useDebouncedValue(searchDraft, 400);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Keep the input in sync when the URL changes from elsewhere (back button, chips).
  const urlSearch = new URLSearchParams(location.search).get('q') ?? '';
  useEffect(() => {
    setSearchDraft(urlSearch);
  }, [urlSearch]);

  // Write the debounced term back into the URL so results are shareable.
  // `replace` keeps the back button useful — typing should not fill history.
  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    const params = new URLSearchParams(location.search);
    if (debouncedSearch) params.set('q', debouncedSearch);
    else params.delete('q');
    const query = params.toString();
    navigate(query ? `/?${query}` : '/', { replace: true });
    // `location.search` is intentionally excluded: it changes as a result of
    // this very effect, and depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, navigate]);

  const pushSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(location.search);
      if (term) params.set('q', term);
      else params.delete('q');
      const query = params.toString();
      navigate(query ? `/?${query}` : '/', { replace: true });
    },
    [location.search, navigate],
  );

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="focus:bg-brand-600 sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <header className="border-ink-200/70 sticky top-0 z-40 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            className="text-ink-600 hover:bg-ink-100 -ml-1 rounded-lg p-2 transition-colors lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-1.5" aria-label="Foodhut home">
            <span className="bg-brand-600 flex size-9 items-center justify-center rounded-xl text-lg font-black text-white">
              F
            </span>
            <span className="text-ink-900 hidden text-lg font-black tracking-tight sm:block">
              Food<span className="text-brand-600">hut</span>
            </span>
          </Link>

          {/* Location selector (visual affordance only in v1) */}
          <button
            type="button"
            className="hover:bg-ink-100 ml-1 hidden items-center gap-1 rounded-lg px-2 py-1.5 text-left transition-colors md:flex"
          >
            <span className="flex flex-col leading-tight">
              <span className="text-brand-600 text-[0.65rem] font-bold tracking-wider uppercase">
                Deliver to
              </span>
              <span className="text-ink-800 text-sm font-semibold">Bengaluru</span>
            </span>
            <ChevronDown className="text-ink-400 size-4" aria-hidden />
          </button>

          {/* Search */}
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              pushSearch(searchDraft);
            }}
            className="ml-auto min-w-0 flex-1 md:ml-4 md:max-w-xl"
          >
            <label htmlFor="global-search" className="sr-only">
              Search restaurants, cuisines or areas
            </label>
            <div className="relative">
              <Search
                className="text-ink-400 pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2"
                aria-hidden
              />
              <input
                id="global-search"
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search for restaurants, cuisines…"
                className={cn(
                  'border-ink-200 bg-ink-50 h-10 w-full rounded-xl border pr-9 pl-11 text-sm',
                  'placeholder:text-ink-400 transition-colors',
                  'focus:border-brand-400 focus:ring-brand-500/15 focus:bg-white focus:ring-2 focus:outline-none',
                  '[&::-webkit-search-cancel-button]:appearance-none',
                )}
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft('');
                    pushSearch('');
                  }}
                  aria-label="Clear search"
                  className="text-ink-400 hover:bg-ink-200 hover:text-ink-700 absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 transition-colors"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          </form>

          {/* Desktop nav */}
          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
            {isSignedIn ? (
              <>
                <NavLink
                  to="/orders"
                  className={({ isActive }) =>
                    cn(NAV_LINK, isActive ? NAV_LINK_ACTIVE : NAV_LINK_IDLE)
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <Package className="size-4" aria-hidden />
                    Orders
                  </span>
                </NavLink>

                {(profile?.role === 'owner' || profile?.role === 'admin') && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      cn(NAV_LINK, isActive ? NAV_LINK_ACTIVE : 'text-brand-700 hover:bg-brand-50')
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <LayoutDashboard className="size-4" aria-hidden />
                      Dashboard
                    </span>
                  </NavLink>
                )}

                <UserMenu
                  name={profile?.displayName ?? user?.displayName ?? 'Account'}
                  photoURL={profile?.photoURL ?? user?.photoURL ?? null}
                  email={profile?.email ?? user?.email ?? ''}
                  onSignOut={() => {
                    void signOut().then(() => navigate('/'));
                  }}
                />
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-ink-700 hover:bg-ink-100 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                >
                  Log in
                </Link>
                <Button size="sm" onClick={() => navigate('/signup')}>
                  Sign up
                </Button>
              </>
            )}

            <Link
              to="/cart"
              className="text-ink-600 hover:bg-ink-100 relative ml-1 rounded-lg p-2 transition-colors"
              aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
            >
              <ShoppingBag className="size-5" aria-hidden />
              {itemCount > 0 && (
                <span className="bg-brand-600 absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full text-[0.65rem] font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile drawer */}
      <Modal open={mobileNavOpen} onClose={closeMobileNav} title="Menu" size="sm">
        <nav className="space-y-1" aria-label="Mobile">
          <Link
            to="/"
            onClick={closeMobileNav}
            className="hover:bg-ink-100 block rounded-lg px-3 py-2.5 font-medium"
          >
            Home
          </Link>
          <Link
            to="/cart"
            onClick={closeMobileNav}
            className="hover:bg-ink-100 block rounded-lg px-3 py-2.5 font-medium"
          >
            Cart {itemCount > 0 && <span className="text-brand-600">({itemCount})</span>}
          </Link>
          {isSignedIn ? (
            <>
              <Link
                to="/orders"
                onClick={closeMobileNav}
                className="hover:bg-ink-100 block rounded-lg px-3 py-2.5 font-medium"
              >
                My orders
              </Link>
              <Link
                to="/favourites"
                onClick={closeMobileNav}
                className="hover:bg-ink-100 block rounded-lg px-3 py-2.5 font-medium"
              >
                Favourites
              </Link>
              {(profile?.role === 'owner' || profile?.role === 'admin') && (
                <Link
                  to="/admin"
                  onClick={closeMobileNav}
                  className="text-brand-700 hover:bg-brand-50 block rounded-lg px-3 py-2.5 font-medium"
                >
                  Owner dashboard
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  closeMobileNav();
                  void signOut().then(() => navigate('/'));
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="size-4" aria-hidden />
                Log out
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-2">
              <Button
                fullWidth
                onClick={() => {
                  closeMobileNav();
                  navigate('/login');
                }}
              >
                Log in
              </Button>
              <Button
                fullWidth
                variant="outline"
                onClick={() => {
                  closeMobileNav();
                  navigate('/signup');
                }}
              >
                Sign up
              </Button>
            </div>
          )}
        </nav>
      </Modal>

      <main id="main-content" className="flex-1">
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-ink-200 mt-16 border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs space-y-2">
              <Link to="/" className="flex items-center gap-1.5">
                <span className="bg-brand-600 flex size-7 items-center justify-center rounded-lg text-sm font-black text-white">
                  F
                </span>
                <span className="text-ink-900 text-base font-black tracking-tight">
                  Food<span className="text-brand-600">hut</span>
                </span>
              </Link>
              <p className="text-ink-500 text-sm">
                Order delicious food online from the best restaurants near you. Built with React and
                Firebase.
              </p>
            </div>

            <nav
              className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3"
              aria-label="Footer"
            >
              <div className="space-y-2">
                <p className="text-ink-900 font-semibold">Company</p>
                <Link to="/" className="text-ink-500 hover:text-brand-600 block">
                  About us
                </Link>
                <Link to="/" className="text-ink-500 hover:text-brand-600 block">
                  Careers
                </Link>
                <Link to="/" className="text-ink-500 hover:text-brand-600 block">
                  Contact
                </Link>
              </div>
              <div className="space-y-2">
                <p className="text-ink-900 font-semibold">Legal</p>
                <Link to="/" className="text-ink-500 hover:text-brand-600 block">
                  Privacy
                </Link>
                <Link to="/" className="text-ink-500 hover:text-brand-600 block">
                  Terms
                </Link>
                <Link to="/" className="text-ink-500 hover:text-brand-600 block">
                  Cookies
                </Link>
              </div>
              <div className="space-y-2">
                <p className="text-ink-900 font-semibold">Account</p>
                <Link to="/orders" className="text-ink-500 hover:text-brand-600 block">
                  My orders
                </Link>
                <Link to="/favourites" className="text-ink-500 hover:text-brand-600 block">
                  Favourites
                </Link>
                <Link to="/admin" className="text-ink-500 hover:text-brand-600 block">
                  {/* Named for who it is for. "For restaurants" hid the word
                      admin entirely, so the one person who needed to find this
                      screen fastest was the person least able to search for it. */}
                  {profile?.role === 'admin' || profile?.role === 'owner'
                    ? 'Admin dashboard'
                    : 'For restaurants'}
                </Link>
              </div>
            </nav>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-6 text-xs text-ink-400">
            <p>
              © {new Date().getFullYear()} Foodhut. A demo project — not affiliated with any real
              delivery service.
            </p>
            {/*
              Many of the seeded photos are CC BY / CC BY-SA, which require
              attribution to be *provided to the user*, not merely recorded in a
              file in the repository. So the credits are reachable from the app.
            */}
            <a
              href="/credits"
              className="underline decoration-ink-300 underline-offset-2 transition-colors hover:text-ink-700"
            >
              Photo credits
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------- user menu -------------------------------- */

function UserMenu({
  name,
  photoURL,
  email,
  onSignOut,
}: {
  name: string;
  photoURL: string | null;
  email: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="hover:bg-ink-100 ml-1 flex items-center gap-1.5 rounded-lg p-1 transition-colors"
      >
        <span className="bg-ink-200 text-ink-600 flex size-8 items-center justify-center overflow-hidden rounded-full text-xs font-bold">
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon className="size-4" aria-hidden />
          )}
        </span>
        <ChevronDown className="text-ink-400 size-3.5" aria-hidden />
      </button>

      {open && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="animate-fade-in border-ink-200 absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border bg-white shadow-lg"
          >
            <div className="border-ink-100 border-b px-4 py-3">
              <p className="text-ink-900 truncate text-sm font-semibold">{name}</p>
              <p className="text-ink-500 truncate text-xs">{email}</p>
            </div>
            <div className="p-1.5">
              <Link
                to="/favourites"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-ink-700 hover:bg-ink-100 block rounded-lg px-3 py-2 text-sm"
              >
                Favourites
              </Link>
              <Link
                to="/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-ink-700 hover:bg-ink-100 block rounded-lg px-3 py-2 text-sm"
              >
                Profile & addresses
              </Link>
              <button
                type="button"
                role="menuitem"
                disabled={signingOut}
                onClick={() => {
                  setSigningOut(true);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {signingOut ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <LogOut className="size-4" aria-hidden />
                )}
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

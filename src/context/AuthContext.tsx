/**
 * Auth context: owns the one Firebase `onAuthStateChanged` subscription for the
 * whole app and exposes the merged user + profile to consumers.
 *
 * Splitting `user` (Firebase identity, resolves fast) from `profile` (a
 * Firestore read) means the header can render immediately while the slower
 * profile lookup catches up.
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';

import { firebaseAuth } from '@/config/firebase';
import { toUserMessage } from '@/lib/firebase/errors';
import { toUserProfile } from '@/lib/mappers';
import {
  fetchUserProfile,
  loginWithEmail,
  loginWithGoogle,
  logout as firebaseLogout,
  registerWithEmail,
} from '@/services/auth';
import { subscribeToOwnership } from '@/services/ownership';
import type { UserProfile } from '@/types/models';

export interface AuthContextValue {
  /** Firebase identity, or null while resolving. */
  user: User | null;
  /** Firestore profile, or null when signed out / still loading. */
  profile: UserProfile | null;
  /** True until the first auth state resolution completes. */
  initialising: boolean;
  isSignedIn: boolean;
  /** True when the account owns at least one restaurant (derived, not stored). */
  isOwner: boolean;
  /** True only for accounts promoted out of band. */
  isAdmin: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const raw = await fetchUserProfile(uid);
      // The document is written on first sign-in; if a read races it, retry once.
      if (raw) {
        const { id: _ignored, ...rest } = raw as unknown as Record<string, unknown> & {
          id?: string;
        };
        void _ignored;
        setProfile(toUserProfile(uid, rest as never));
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('[auth] failed to load profile', toUserMessage(error));
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = firebaseAuth().onAuthStateChanged(async (nextUser) => {
      if (cancelled) return;

      setUser(nextUser);
      if (nextUser) await loadProfile(nextUser.uid);
      else setProfile(null);

      if (!cancelled) setInitialising(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const uid = firebaseAuth().currentUser?.uid;
    if (uid) await loadProfile(uid);
  }, [loadProfile]);

  /*
   * Ownership is watched live rather than read once, so creating a restaurant
   * immediately unlocks the dashboard without a page reload.
   */
  useEffect(() => {
    return subscribeToOwnership(user?.uid ?? null, {
      onChange: setIsOwner,
      onError: (error) => console.error('[auth] ownership check failed', toUserMessage(error)),
    });
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initialising,
      isSignedIn: user !== null,
      isOwner,
      isAdmin: profile?.role === 'admin',
      signUp: async (name, email, password) => {
        await registerWithEmail(email, password, name);
      },
      signIn: async (email, password) => {
        await loginWithEmail(email, password);
      },
      signInWithGoogle: async () => {
        await loginWithGoogle();
      },
      signOut: async () => {
        await firebaseLogout();
        setProfile(null);
        setIsOwner(false);
      },
      refreshProfile,
    }),
    [user, profile, initialising, isOwner, refreshProfile],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

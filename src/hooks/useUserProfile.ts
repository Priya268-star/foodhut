/**
 * Subscribe to the signed-in user's profile document.
 * Returns a live profile plus role helpers, used by the admin routes and header.
 */
import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { firestore } from '@/config/firebase';
import { toUserProfile } from '@/lib/mappers';
import { userDoc } from '@/lib/paths';
import { useAuth } from '@/context/AuthContext';
import type { UserProfile } from '@/types/models';

export interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useUserProfile(): UseUserProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe: Unsubscribe = onSnapshot(
      doc(firestore(), userDoc(user.uid)),
      (snap) => {
        setProfile(snap.exists() ? toUserProfile(snap.id, snap.data()) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user, nonce]);

  return { profile, loading, error, refresh };
}

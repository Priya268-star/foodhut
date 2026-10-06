/**
 * Live list of the signed-in user's saved delivery addresses.
 *
 * Backed by a Firestore listener rather than a fetch, so saving an address in
 * the profile immediately updates the checkout screen too.
 */
import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { subscribeToAddresses } from '@/services/auth';
import type { Address } from '@/types/models';

export interface UseAddressesResult {
  addresses: Address[];
  loading: boolean;
  error: string | null;
  defaultAddress: Address | null;
}

export function useAddresses(): UseAddressesResult {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setAddresses([]);
      return;
    }

    setLoading(true);
    const unsubscribe: Unsubscribe = subscribeToAddresses(user.uid, {
      onChange: (next) => {
        setAddresses(next);
        setLoading(false);
        setError(null);
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });

    return unsubscribe;
  }, [user]);

  return {
    addresses,
    loading,
    error,
    // The service already sorts defaults first, but being explicit here keeps
    // the fallback behaviour obvious to a reader.
    defaultAddress: addresses.find((address) => address.isDefault) ?? addresses[0] ?? null,
  };
}

/**
 * Auth writes and the `users/{uid}` profile document.
 *
 * The Firebase `User` object is the identity; the profile document holds app
 * data (role, addresses, owned restaurants) that rules can read. It is created
 * lazily on first sign-in so it exists before any rule needs to look it up.
 */
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { authEnv } from '@/config/env';
import { firebaseAuth, firestore } from '@/config/firebase';
import { toUserMessage } from '@/lib/firebase/errors';
import { toAddress } from '@/lib/mappers';
import { userAddressDoc, userAddressesCollection, userDoc } from '@/lib/paths';
import type { Address, UserProfile } from '@/types/models';

/* --------------------------------- reads ---------------------------------- */

export function subscribeToAuthState(handler: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth(), handler);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(firestore(), userDoc(uid)));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/* -------------------------------- writes ---------------------------------- */

async function ensureProfile(user: User): Promise<void> {
  const ref = doc(firestore(), userDoc(user.uid));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Keep the display name/avatar fresh after a Google sign-in.
    await updateDoc(ref, {
      displayName: user.displayName ?? snap.data()['displayName'] ?? 'Foodhut user',
      photoURL: user.photoURL ?? snap.data()['photoURL'] ?? null,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    ref,
    {
      uid: user.uid,
      displayName: user.displayName ?? 'Foodhut user',
      email: user.email ?? '',
      photoURL: user.photoURL ?? null,
      phone: user.phoneNumber ?? null,
      role: 'customer',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const credential = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
  await updateProfile(credential.user, { displayName });
  await ensureProfile(credential.user);
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  const credential = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  await ensureProfile(credential.user);
}

export async function loginWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (authEnv.googleProviderId !== 'google.com') {
    provider.setCustomParameters({ providerId: authEnv.googleProviderId });
  }

  const credential = await signInWithPopup(firebaseAuth(), provider);
  await ensureProfile(credential.user);
}

export async function logout(): Promise<void> {
  await fbSignOut(firebaseAuth());
}

/* -------------------------------- profile --------------------------------- */

export async function updateUserProfile(
  uid: string,
  changes: Partial<Pick<UserProfile, 'displayName' | 'phone'>>,
): Promise<void> {
  await updateDoc(doc(firestore(), userDoc(uid)), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Addresses live in the `users/{uid}/addresses` subcollection.
 *
 * The rules language cannot iterate a list, so an array on the profile document
 * could never be shape-validated entry by entry. As separate documents each
 * write is checked in full (see `firestore.rules`).
 */
export function subscribeToAddresses(
  uid: string | null,
  handlers: { onChange: (addresses: Address[]) => void; onError?: (error: Error) => void },
): Unsubscribe {
  if (!uid) {
    handlers.onChange([]);
    return () => {};
  }

  return onSnapshot(
    collection(firestore(), userAddressesCollection(uid)),
    (snap) =>
      handlers.onChange(
        snap.docs
          .map((entry) => toAddress(entry.id, entry.data()))
          .filter((address): address is Address => address !== null)
          // Default first, then alphabetical — the order the UI wants anyway.
          .sort(
            (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label),
          ),
      ),
    (error) => handlers.onError?.(error),
  );
}

/**
 * Creates or updates one address.
 *
 * "Exactly one default" is maintained by the client via a single batch: if
 * this address becomes the default, the previous default is cleared in the same
 * commit. The rules cannot express that invariant across documents, so it is
 * enforced here and the UI simply renders whatever is stored.
 */
export async function saveAddress(uid: string, address: Address): Promise<void> {
  const db = firestore();
  const payload = {
    id: address.id,
    label: address.label,
    line1: address.line1,
    city: address.city,
    postalCode: address.postalCode,
    phone: address.phone,
    isDefault: address.isDefault,
    // Firestore drops `undefined`, which would break the rules' `hasOnly` check.
    ...(address.line2 ? { line2: address.line2 } : {}),
  };

  if (!address.isDefault) {
    await setDoc(doc(db, userAddressDoc(uid, address.id)), payload, { merge: true });
    return;
  }

  const existing = await getDocs(collection(db, userAddressesCollection(uid)));
  const batch = writeBatch(db);

  for (const entry of existing.docs) {
    if (entry.id !== address.id && entry.data()['isDefault'] === true) {
      batch.update(doc(db, userAddressDoc(uid, entry.id)), { isDefault: false });
    }
  }
  batch.set(doc(db, userAddressDoc(uid, address.id)), payload, { merge: true });

  await batch.commit();
}

export async function deleteAddress(uid: string, addressId: string): Promise<void> {
  await deleteDoc(doc(firestore(), userAddressDoc(uid, addressId)));
}

/* ------------------------------ role helpers ------------------------------ */

export async function setUserRole(uid: string, role: UserProfile['role']): Promise<void> {
  await updateDoc(doc(firestore(), userDoc(uid)), { role, updatedAt: serverTimestamp() });
}

export { toUserMessage };

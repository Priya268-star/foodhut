/**
 * Human-readable messages for Firebase error codes.
 *
 * Firebase errors are thrown as `FirebaseError` with a stable `code` like
 * `auth/invalid-credential`. Mapping them here keeps error text out of the UI
 * components and gives users actionable messages.
 */
import { FirebaseError } from 'firebase/app';

const AUTH_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before completing.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and retry.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/operation-not-allowed': 'That sign-in method is disabled for this project.',
  'auth/unauthorized-domain': 'This domain is not authorised in Firebase Authentication settings.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
};

const FIRESTORE_MESSAGES: Record<string, string> = {
  'permission-denied': 'You do not have permission to perform this action.',
  unavailable: 'The service is temporarily unreachable. Please try again.',
  'deadline-exceeded': 'The request timed out. Please try again.',
  'not-found': 'That item no longer exists.',
  'failed-precondition': 'That action is not possible right now.',
  'resource-exhausted': 'Too many requests — please slow down.',
};

const STORAGE_MESSAGES: Record<string, string> = {
  'storage/unauthorized': 'You are not allowed to upload this file.',
  'storage/canceled': 'Upload cancelled.',
  'storage/quota-exceeded': 'Storage quota exceeded.',
  'storage/retry-limit-exceeded': 'Upload failed after retries. Check your connection.',
  'storage/object-not-found': 'That file no longer exists.',
};

const ALL_MESSAGES: Record<string, string> = {
  ...AUTH_MESSAGES,
  ...FIRESTORE_MESSAGES,
  ...STORAGE_MESSAGES,
};

export function isFirebaseError(error: unknown, code?: string): error is FirebaseError {
  return error instanceof FirebaseError && (code === undefined || error.code === code);
}

/** Never throws — always returns a string safe to render. */
export function toUserMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof FirebaseError) {
    return ALL_MESSAGES[error.code] ?? fallback;
  }
  if (error instanceof Error && error.message) {
    // Surface our own already-human messages (e.g. config errors).
    return error.message.startsWith('[') ? error.message : fallback;
  }
  return fallback;
}

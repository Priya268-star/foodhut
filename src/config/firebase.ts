/**
 * Single, lazily-initialised Firebase app instance.
 *
 * Everything else in the app imports the SDK instances from here so there is
 * exactly one place that knows how Firebase is wired up. Initialisation is
 * exported as an `initializeApp()` function (not a side effect) so the config
 * is only read when the app actually needs it.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { emulatorEnv, firebaseEnv } from '@/config/env';

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

let services: FirebaseServices | null = null;

function emulatorsConnected() {
  return (
    emulatorEnv.useEmulators &&
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  );
}

function createServices(): FirebaseServices {
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({ ...firebaseEnv, storageBucket: firebaseEnv.storageBucket });

  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  if (emulatorsConnected()) {
    // Guard against double-connection when React StrictMode mounts twice.
    const alreadyConnected = (auth.emulatorConfig as { host?: string } | null) !== null;
    if (!alreadyConnected) {
      const host = window.location.hostname;
      connectAuthEmulator(auth, `http://${host}:${emulatorEnv.authPort}`, {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, host, emulatorEnv.firestorePort);
      connectStorageEmulator(storage, host, emulatorEnv.storagePort);
    }
  }

  return { app, auth, db, storage };
}

export function getFirebase(): FirebaseServices {
  if (services === null) {
    services = createServices();
  }
  return services;
}

/** Convenience accessors so callers never destructure a possibly-null value. */
export const firebaseAuth = (): Auth => getFirebase().auth;
export const firestore = (): Firestore => getFirebase().db;
export const firebaseStorage = (): FirebaseStorage => getFirebase().storage;

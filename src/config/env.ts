/**
 * Environment configuration.
 *
 * IMPORTANT: Vite replaces `import.meta.env.VITE_FOO` at build time with a
 * literal, but it cannot do that for a *dynamic* access like
 * `import.meta.env[name]`. In a production build the whole `import.meta.env`
 * object collapses to only the keys that were referenced literally, so anything
 * read by name is silently `undefined`.
 *
 * That means every variable below must be read with a full literal property
 * access. The `name` parameters exist only so error messages and the
 * `RequiredEnvVar` type stay useful.
 */

const REQUIRED_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const satisfies readonly string[];

export type RequiredEnvVar = (typeof REQUIRED_VARS)[number];

// Referenced so the list above is a runtime value, not a type-only one.
void REQUIRED_VARS;

const PLACEHOLDER = /^(your_|xxx|changeme)/i;

const CONFIG_HINT =
  'Find them at: Firebase console > Project settings > Your apps > SDK setup and configuration';

/**
 * Validates one required variable.
 *
 * Takes the name (for the error message) and the *already-resolved* value, so
 * the value is inlined at build time while the name stays available.
 */
function requireVar(name: RequiredEnvVar, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      [
        `[env] Missing required environment variable "${name}".`,
        'Copy .env.example to .env.local and fill in your Firebase project values.',
        CONFIG_HINT,
      ].join('\n'),
    );
  }

  if (PLACEHOLDER.test(value)) {
    throw new Error(
      `[env] Environment variable "${name}" still contains a placeholder value. ` +
        `Replace it with the real value from your Firebase project settings.`,
    );
  }

  return value.trim();
}

function optionalVar(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function booleanVar(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

/** Shape of the Firebase Web SDK config, as validated from the environment. */
export const firebaseEnv = {
  apiKey: requireVar('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: requireVar('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: requireVar('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: requireVar(
    'VITE_FIREBASE_STORAGE_BUCKET',
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  ),
  messagingSenderId: requireVar(
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: requireVar('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
} as const;

/**
 * Google OAuth needs the authorised redirect origin. Keeping it in env means a
 * staging build can point at a different OAuth client.
 */
export const authEnv = {
  googleProviderId: optionalVar(import.meta.env.VITE_FIREBASE_GOOGLE_PROVIDER_ID, 'google.com'),
} as const;

/** Points SDKs at the local emulator suite when `VITE_USE_EMULATORS=true`. */
export const emulatorEnv = {
  useEmulators: booleanVar(import.meta.env.VITE_USE_EMULATORS, false),
  authPort: Number(optionalVar(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT, '9099')),
  firestorePort: Number(optionalVar(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT, '8080')),
  storagePort: Number(optionalVar(import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_PORT, '9199')),
} as const;

export const appEnv = {
  mode: optionalVar(import.meta.env.MODE, import.meta.env.PROD ? 'production' : 'development'),
} as const;

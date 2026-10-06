# Foodhut

A Zomato-style food delivery marketplace built with **React 19 + TypeScript + Vite**, backed entirely by **Firebase** (Authentication, Firestore, Cloud Storage, Hosting).

Browse restaurants, build a cart, check out, track orders, save favourites and leave reviews. Restaurant owners get a dashboard to manage menus (with image uploads) and move orders through their lifecycle — live, via Firestore listeners.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Firebase console setup](#firebase-console-setup)
- [Seeding demo data](#seeding-demo-data)
- [Running with emulators](#running-with-emulators)
- [Building and deploying](#building-and-deploying)
- [Security model](#security-model)
- [Hardening before production](#hardening-before-production)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)

---

## Features

### Customer

| Feature          | Notes                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Browse & search  | Search by name/cuisine/area, filter by cuisine, price level, open-now; sort by rating, delivery time or fee          |
| Restaurant pages | Cover, rating, delivery info, menu grouped by category, veg/non-veg markers                                          |
| Cart             | Single-restaurant basket, quantity steppers, live bill, persisted to `localStorage` across reloads                   |
| Checkout         | Saved addresses, delivery address form, simulated payment, re-validates the restaurant is still open before charging |
| Orders           | Ongoing vs past split, live status timeline, cancel while active, "order again"                                      |
| Favourites       | Heart toggle on every card, dedicated page, syncs across tabs via Firestore listeners                                |
| Reviews          | Star ratings with live average, one review per user per restaurant, deletable by the author                          |
| Auth             | Email/password + Google sign-in, route protection with return-to redirect                                            |

### Restaurant owner / admin

| Feature             | Notes                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Dashboard           | Revenue, order counts, live recent-orders feed                              |
| Restaurant creation | Logo + cover upload, cuisine tags, delivery settings                        |
| Menu management     | Full CRUD, per-dish image upload with progress, one-tap availability toggle |
| Order management    | Live order feed, one valid next action per status, customer contact details |

---

## Tech stack

| Concern    | Choice                                               | Why                                                        |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Framework  | React 19 + Vite 8                                    | Fast dev server, first-class TS, tiny config               |
| Language   | TypeScript 6 (`strict` + `noUncheckedIndexedAccess`) | Catches real bugs; indexed access returns `T \| undefined` |
| Routing    | React Router 7 (data router)                         | Route-level code splitting, nested layouts, error elements |
| Styling    | Tailwind CSS 4                                       | Design tokens in CSS, no runtime, purges automatically     |
| Forms      | React Hook Form + Zod 4                              | Single schema drives validation _and_ types                |
| Backend    | Firebase v12 (Web SDK)                               | Auth, Firestore, Storage, Hosting — no server to run       |
| Validation | ESLint 9 flat config + Prettier                      | `typescript-eslint`, `react-hooks`                         |
| Icons      | lucide-react                                         | Tree-shakeable                                             |

---

## Project structure

```
foodhut/
├── firebase.json              # Hosting rewrites, cache headers, emulator ports
├── firestore.rules            # Firestore security rules (the real security boundary)
├── firestore.indexes.json     # Composite indexes required by the queries
├── storage.rules              # Cloud Storage rules (path-scoped, size/type limited)
├── scripts/seed.ts            # Admin-SDK seed script (never shipped to the browser)
├── src/
│   ├── app/router.tsx         # Route table + lazy loading
│   ├── components/            # Reusable UI (ui/, layout pieces, feature widgets)
│   ├── config/                # env.ts (validated) + firebase.ts (lazy singleton)
│   ├── context/               # AuthContext, CartContext
│   ├── hooks/                 # Data hooks, favourites, debounce
│   ├── lib/                   # cn, format, mappers, paths, validation, firebase utils
│   ├── pages/                 # One file per route
│   ├── services/              # ALL Firestore/Storage/Auth calls live here
│   ├── styles/index.css       # Tailwind entry + design tokens
│   └── types/models.ts        # Domain model
└── src/data/seed-data.ts      # Demo dataset (imported only by the seed script)
```

**The layering rule:** `pages → hooks → services → lib → config`. Components never import the Firebase SDK directly, and services never import React. That boundary is what makes the data layer testable and swappable.

---

## Getting started

### Prerequisites

- **Node.js 20+** (developed on 24)
- A Firebase project (free Spark plan is enough)

### 1. Install

```bash
npm install
```

### 2. Create a Firebase project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Sign-in method**:
   - enable **Email/Password**
   - enable **Google**
3. **Build → Firestore Database → Create database**:
   - pick a region close to your users
   - start in **production mode** (the rules in this repo are then deployed by you)
4. **Build → Storage → Get started**:
   - same region as Firestore
5. **Project settings (gear icon) → Your apps → Web (`</>`)**:
   - register an app, name it `foodhut`
   - copy the `firebaseConfig` values

### 3. Configure the environment

```bash
# Windows
copy .env.example .env.local

# macOS / Linux
cp .env.example .env.local
```

Then fill in `.env.local`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

> `.env.local` is gitignored. Only `VITE_`-prefixed vars reach the browser, and the Firebase Web config is designed to be public — access is controlled by the rules, not by hiding keys. Never put service-account keys here.

### 4. Deploy the rules and indexes

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project
npm run deploy:rules
```

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:5173>.

You should see the app shell with an empty restaurant grid (there is no data yet).

---

## Seeding demo data

Six restaurants with menus, images and ratings — enough to exercise every screen. The dataset lives in `src/data/seed-data.ts` and is shared by both seeding paths.

### Against a real project (Admin SDK)

```bash
# 1. A service account key (Project settings > Service accounts > Generate key)
#    Save it as ./service-account.json — it is gitignored.
# 2. Tell the script which project:
$env:FIREBASE_PROJECT_ID = "your-project-id"   # PowerShell
# export FIREBASE_PROJECT_ID="your-project-id"  # bash/zsh

# 3. Run it
npm run seed
```

The script uses the **Admin SDK**, which bypasses your rules — which is exactly why it is a Node script and not a page. The browser never receives those credentials.

After seeding, the restaurants exist but are owned by a placeholder uid. To manage them from the UI, create your own restaurant from **Dashboard → Add restaurant** (which sets `ownerId` to you correctly), or promote an existing account with the Admin SDK:

```ts
// scripts/promote.ts — ownership is derived from restaurants.ownerId, so there
// is nothing to promote. The seed uid already owns every seeded restaurant.
```

### Against the emulators (no credentials)

```bash
npm run seed:emulator
```

Writes `emulator-data/firestore-seed.json` in the emulator's export format, which `firebase.json` already points at. No Admin SDK, no service account, works offline. See [Running with emulators](#running-with-emulators).

---

## Running with emulators

The fastest way to see the app fully working — no Firebase project, no credentials, no quota.

```bash
# 1. Generate the emulator seed data (6 restaurants, 25 dishes, 1 owner)
npm run seed:emulator

# 2. Point the app at the emulators
#    copy .env.example .env.local, then set VITE_USE_EMULATORS=true
#    (any syntactically valid Firebase values will do)

# 3. Start them
npm run emulators      # terminal 1
npm run dev            # terminal 2
```

Open <http://localhost:5173> (app) and <http://localhost:4000> (Emulator UI).

> **The Firestore emulator requires a Java runtime (11+) on your PATH.** The Auth and
> Storage emulators do not, but Firestore does, so you need it for the full suite.
>
> ```bash
> # Windows (winget)
> winget install --id EclipseAdoptium.Temurin.21.JRE --source winget
>
> # macOS
> brew install --cask temurin
>
> # Debian / Ubuntu
> sudo apt install default-jre
> ```
>
> Verify with `java -version`, then **restart your terminal** so `PATH` is reloaded.
> A JRE is enough — you do not need the full JDK.

> **If the CLI cannot download the emulator itself** (you see
> `Failed to make request to storage.googleapis.com/firebase-preview-drop/...`),
> your network is blocking the CLI's downloader. The jar is just a file, so fetch
> it into the CLI's cache by hand:
>
> ```powershell
> $cache = "$env:LOCALAPPDATA\firebase\emulators"
> New-Item -ItemType Directory -Force -Path $cache | Out-Null
> curl.exe -L --fail -o "$cache\cloud-firestore-emulator-v1.22.0.jar" `
>   "https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar"
> ```
>
> Use the exact version the CLI says it wants, then re-run `npm run emulators` —
> it skips the download when the file is already in the cache.

The Auth emulator lets you create test accounts without email verification, and the Storage emulator serves uploads locally.

### Testing the owner dashboard

The seed data writes six restaurants owned by uid `seed-owner-uid`. Ownership is **derived** from `restaurants.ownerId`, so to act as that owner in the Auth emulator:

1. Emulator UI → **Authentication → Add user**
2. Set **User UID** to exactly `seed-owner-uid`, email `owner@foodhut.test`, any password
3. Log in with those credentials in the app

The dashboard link appears immediately — `AuthContext` watches the ownership query live.

Alternatively, sign up normally and add your own restaurant from **Dashboard → Add restaurant**. That is the path a real user takes, and it is the honest end-to-end test of the create → own → manage flow.

### Testing the security rules

`tests/firestore.rules.test.ts` runs **42 assertions** against the emulator, each written as a **specific attack** rather than a feature check:

| Attack                                                | Blocked by                                  |
| ----------------------------------------------------- | ------------------------------------------- |
| Restaurant created with someone else's `ownerId`      | `ownsNewRestaurant()`                       |
| `role: 'admin'` written onto your own profile         | `hasOnly(...)` on the update diff           |
| Inventing an `ownedRestaurantIds` / `addresses` field | not in the writable allow-list              |
| `ownerId` reassigned after creation                   | `ownerUnchanged()`                          |
| Rewriting `rating` / `ratingCount`                    | `protectedRestaurantFieldsUnchanged()`      |
| Writing to another restaurant's menu                  | `isOwnerOf()` via `get()` on the parent doc |
| Review posted as another user                         | `userId == request.auth.uid`                |
| Rating of `99`                                        | `is int` + range check                      |
| Order with a tampered `total`                         | `total == subtotal + deliveryFee + tax`     |
| Order placed on behalf of someone else                | `userId == request.auth.uid`                |
| Order created already `delivered`                     | `status == 'placed'`                        |
| Status skipping a step, or moving backwards           | `isForwardStep()`                           |
| `total` changed after placement                       | `orderFinancialsUnchanged()`                |
| Reviving a cancelled order                            | both transition paths reject it             |
| Order deletion (destroys history)                     | `allow delete: if false`                    |
| Address with a bad PIN / missing field / extra field  | `isValidAddress()`                          |
| Address `id` not matching its document id             | `request.resource.data.id == addressId`     |
| Favourite pointing at a non-existent restaurant       | `exists()` on the parent                    |
| Anonymous writes                                      | `isSignedIn()`                              |

```bash
npm run emulators    # terminal 1
npm run test:rules   # terminal 2
```

Two things worth knowing about this suite:

- **It proves the rules file compiles.** A rules syntax error otherwise only surfaces at `firebase deploy`, when it is most expensive. This caught a real one: the rules language has **no iteration construct** — `for`/`forEach` do not exist — so an array of addresses could never be validated entry by entry. That is why addresses live in a subcollection rather than on the profile.
- **It clears the database first.** The emulator is long-lived and persistent; without `clearFirestore()` a re-run's `setDoc` becomes an _update_, and the order tests fail for the wrong reason.

---

## Building and deploying

```bash
npm run deploy
```

That is `npm run build && firebase deploy` — it publishes the Vite build to Firebase Hosting along with Firestore rules, indexes and Storage rules.

Deploying only the backend:

```bash
npm run deploy:rules     # firestore.rules + firestore.indexes.json + storage.rules
npm run deploy:hosting   # dist/ only
```

Or wire up CI:

```bash
npm install -g firebase-tools
firebase login --no-localhost          # stores a token
firebase deploy --only hosting         # add --token $FIREBASE_TOKEN in CI
```

> **First deploy note:** Hosting needs the Firebase CLI logged into a project that has Hosting enabled (`firebase init hosting`, or tick it in the console).

### Hosting behaviour

`firebase.json` handles three things worth knowing about:

- **SPA rewrite** — `**` → `/index.html`, so deep links like `/restaurants/truffle-affairs` work on refresh.
- **Immutable assets** — `/assets/**` gets `max-age=31536000, immutable` because filenames are content-hashed.
- **Never-cache `index.html`** — otherwise users keep requesting stale asset URLs after a deploy.
- **Baseline security headers** — `nosniff`, `frame-options`, `referrer-policy`, `permissions-policy`.

---

## Security model

**`firestore.rules` and `storage.rules` are the only security boundary.** Every check in the UI is for user experience, not protection.

Key properties:

| Rule              | Enforced                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| New profiles      | Must be `role: 'customer'` — no self-promotion                                                                               |
| User updates      | Only `displayName`, `phone`, `photoURL`, `updatedAt` are writable by the user                                                |
| Addresses         | One document per address, fully shape-validated; id must match the document key                                              |
| Restaurant create | `ownerId` must equal the caller's uid                                                                                        |
| Restaurant update | `ownerId` and rating aggregates are immutable; only an allow-listed set of fields may change                                 |
| Menu writes       | Owner of _that_ restaurant (verified via `get()` on the parent doc) or an admin                                              |
| Reviews           | Author must match `request.auth.uid`; rating constrained to an int 1–5                                                       |
| Order create      | `userId` must be the caller; `total` must equal `subtotal + deliveryFee + tax`; must start at `placed`                       |
| Order update      | Totals, items, address and ids are immutable; status may only move **forward** along the chain, or be cancelled while active |
| Order delete      | Never — cancellation is the only exit, so history is preserved                                                               |
| Storage writes    | Path segment must match the uploader's uid; `image/*` only; under 5 MB                                                       |

### Three rules-language constraints worth knowing

These are not opinions — each one broke something, and the emulator is how it was found.

1. **There is no loop.** `for` and `forEach` do not exist in the rules language. Any list you want validated element-by-element has to be a subcollection. That is why addresses are separate documents rather than an array on the profile — and it happens to be better Firestore modelling anyway, since editing one address no longer rewrites all of them.

2. **`resource.data` is null on create.** A `setDoc` evaluates both the `create` and the `update` rule, so an update rule that reads `resource.data` throws while checking a _create_. Every update rule here is therefore gated on an `exists()` check. The denial is fail-closed either way, but an explicit denial is readable; a crash is not.

3. **`get(...).data.x` on a missing document throws.** An `exists()` guard before the read turns an accidental crash into an intentional `false`.

### Ownership is derived, not stored

There is deliberately **no** `ownedRestaurantIds` array on the user profile. Being an owner is computed from `restaurants/{id}.ownerId` — the same field the rules authorise against — via one `limit(1)` query held open by `AuthContext`.

This matters more than it looks. A denormalised "restaurants I own" list is a convenience, but any rule that lets a user write it is a privilege-escalation surface: the user is asserting a fact about ownership, and the rules would have to trust that assertion. Deriving it instead means:

- there is nothing to keep in sync across two writes, so `createRestaurant()` is a **single atomic write**;
- creating a restaurant immediately unlocks the dashboard, because the query is live;
- and the profile has no writable field that implies authority.

`role` exists only to hold `admin`, which is granted out of band (Admin SDK or console) and is never writable from the client.

---

## Hardening before production

This is a complete, working application — but a few things are deliberately simplified. Do these before real money or real users:

1. **Move totals to a Cloud Function.** The client currently computes `subtotal`/`tax`/`total` and the rules check they are _internally consistent_. That prevents a corrupted total being stored, but it does not make the total _authoritative_. Recompute from the menu in a `before`-triggered function and reject mismatches.

2. **Recompute rating aggregates.** `rating` and `ratingCount` on restaurants are denormalised and read-only from the client. Update them in a Firestore trigger whenever a review is written, and mirror the trigger logic into the rules as a `getAfter()` check so a bad aggregate can never be stored.

3. **Add real search.** The search box filters the current page client-side, which is fine for six restaurants. Above a few hundred, move to Algolia, Typesense, or Firestore + a search extension.

4. **Integrate a payment gateway.** `card_simulated` never touches money by design. For real payments, create the order from a Cloud Function that confirms with the provider, and only then mark the order `placed`.

5. **Enforce admin promotion server-side.** `role: 'admin'` is currently only reachable with the Admin SDK, which is correct — just keep it that way, and add an audit log for who gets promoted.

6. **Add rate limiting.** Abuse `App Check` (reCAPTCHA Enterprise) plus any provider-level limits before launch.

7. **Add monitoring.** Wire `ErrorBoundary` to Sentry and turn on Firebase Crashlytics.

---

## Scripts

| Script                   | What it does                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `npm run dev`            | Vite dev server on :5173                                        |
| `npm run build`          | Typecheck, then build to `dist/`                                |
| `npm run preview`        | Serve the production build locally                              |
| `npm run typecheck`      | `tsc -b` across app + node configs                              |
| `npm run lint`           | ESLint over the repo                                            |
| `npm run lint:fix`       | ESLint with `--fix`                                             |
| `npm run format`         | Prettier write                                                  |
| `npm run format:check`   | Prettier check (CI-friendly)                                    |
| `npm run emulators`      | Full emulator suite + Emulator UI (needs Java 11+)              |
| `npm run test:rules`     | Security-rules tests against the Firestore emulator             |
| `npm run seed:emulator`  | Write `emulator-data/firestore-seed.json` (no credentials)      |
| `npm run seed`           | Seed a real project via the Admin SDK (needs a service account) |
| `npm run deploy`         | Build, then deploy everything                                   |
| `npm run deploy:rules`   | Rules + indexes only                                            |
| `npm run deploy:hosting` | Hosting only                                                    |

---

## Troubleshooting

**"Missing required environment variable VITE_FIREBASE_API_KEY"**
`.env.local` is missing or incomplete. Copy `.env.example` and fill it in. Remember to **restart** the dev server — Vite only reads env files at startup.

**"unauthorized-domain" when using Google sign-in**
Add your domain under **Authentication → Settings → Authorised domains**. `localhost` is allowed by default; deployed domains are not.

**Sign-in works, but no restaurants appear**
The database is empty. Run `npm run seed`, or create a restaurant from the owner dashboard.

**"The query requires an index"**
Deploy the indexes and wait for them to build (usually < 1 min):

```bash
npm run deploy:rules
```

**Uploads fail with `storage/unauthorized`**
The path is scoped to the uploader. If you seeded restaurants under a different `ownerId` than your account, you will not be able to edit their menus. Create your own restaurant from the dashboard instead.

**Deep links 404 on refresh**
The SPA rewrite is missing. Confirm `firebase.json` has the `**` → `/index.html` rewrite, and that you deployed Hosting (not just rules).

**Emulator: "Could not reach the backend"**
The emulators are not running, or `VITE_USE_EMULATORS` is not set to the string `true`. Emulator ports must match the `emulators` block in `firebase.json`.

---

## Licence

MIT. A portfolio/demo project — not affiliated with any real food delivery service. Restaurant names, imagery and prices are fictional placeholders.

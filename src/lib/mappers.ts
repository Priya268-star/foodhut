/**
 * Firestore -> domain model mappers.
 *
 * Keeping every `fromFirestore` conversion in one place means a schema change
 * only needs fixing once, and components never touch raw documents. Each mapper
 * is defensive: a malformed document is skipped rather than crashing a list.
 */
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

import { firebaseAuth } from '@/config/firebase';
import type {
  Cart,
  CartLine,
  Favourite,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  PriceLevel,
  Restaurant,
  Review,
  UserProfile,
  UserRole,
  Address,
} from '@/types/models';
import { ORDER_STATUSES } from '@/types/models';
import { toMillis } from '@/lib/firebase/converters';

export * from '@/lib/firebase/converters';

export { toMillis };

/* ------------------------------- primitives ------------------------------ */

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/* --------------------------------- users ---------------------------------- */

/**
 * Reads an address stored as its own subcollection document. The document id
 * is authoritative, so a tampered `id` field cannot escape.
 */
export function toAddress(id: string, data: DocumentData): Address | null {
  return toEmbeddedAddress(id, data);
}

/**
 * Reads an address embedded inside an order.
 *
 * An order keeps a *snapshot* of where it was delivered to, so a later edit to
 * the address book never rewrites delivery history. That snapshot is written by
 * the checkout flow and is deliberately not the address subcollection, so it is
 * parsed separately.
 */
export function toEmbeddedAddress(id: string, data: DocumentData): Address | null {
  const line1 = str(data['line1']).trim();
  const city = str(data['city']).trim();
  if (!line1 || !city) return null;

  const line2 = str(data['line2']).trim();

  return {
    id,
    label: str(data['label'], 'Home'),
    line1,
    line2: line2 === '' ? undefined : line2,
    city,
    postalCode: str(data['postalCode']),
    phone: str(data['phone']),
    isDefault: bool(data['isDefault']),
  };
}

function toRole(value: unknown): UserRole {
  // Only `admin` is meaningful in storage; `owner` is derived at runtime.
  return value === 'admin' ? 'admin' : 'customer';
}

export function toUserProfile(id: string, data: DocumentData): UserProfile {
  return {
    uid: id,
    displayName: str(data['displayName'], 'Foodhut user'),
    email: str(data['email']),
    photoURL: strOrNull(data['photoURL']),
    phone: strOrNull(data['phone']),
    role: toRole(data['role']),
    createdAt: toMillis(data['createdAt']),
    updatedAt: toMillis(data['updatedAt']),
  };
}

/* ------------------------------ restaurants ------------------------------- */

function toPriceLevel(value: unknown): PriceLevel {
  const level = num(value, 1);
  return (level >= 1 && level <= 4 ? Math.round(level) : 1) as PriceLevel;
}

export function toRestaurant(snap: QueryDocumentSnapshot<DocumentData>): Restaurant {
  const data = snap.data();
  const loc = (data['location'] ?? {}) as Record<string, unknown>;

  return {
    id: snap.id,
    name: str(data['name'], 'Unnamed restaurant'),
    description: str(data['description']),
    cuisines: strArray(data['cuisines']),
    imageUrl: str(data['imageUrl']),
    coverImageUrl: strOrNull(data['coverImageUrl']),
    rating: num(data['rating'], 0),
    ratingCount: num(data['ratingCount'], 0),
    deliveryTimeMinutes: num(data['deliveryTimeMinutes'], 30),
    deliveryFee: num(data['deliveryFee']),
    priceLevel: toPriceLevel(data['priceLevel']),
    location: {
      area: str(loc['area']),
      city: str(loc['city']),
      landmark: strOrNull(loc['landmark']) ?? undefined,
    },
    ownerId: str(data['ownerId']),
    isOpen: bool(data['isOpen'], true),
    isAcceptingOrders: bool(data['isAcceptingOrders'], true),
    isFeatured: bool(data['isFeatured']),
    createdAt: toMillis(data['createdAt']),
    updatedAt: toMillis(data['updatedAt']),
  };
}

/* ---------------------------------- menu ---------------------------------- */

export function toMenuItem(snap: QueryDocumentSnapshot<DocumentData>): MenuItem {
  const data = snap.data();

  return {
    id: snap.id,
    restaurantId: str(data['restaurantId'], snap.ref.parent.parent?.id ?? ''),
    name: str(data['name'], 'Item'),
    description: str(data['description']),
    price: num(data['price']),
    imageUrl: str(data['imageUrl']),
    category: str(data['category'], 'General'),
    isVeg: bool(data['isVeg'], false),
    isAvailable: bool(data['isAvailable'], true),
    rating: num(data['rating'], 0),
    ratingCount: num(data['ratingCount'], 0),
    sortOrder: num(data['sortOrder'], 0),
    createdAt: toMillis(data['createdAt']),
    updatedAt: toMillis(data['updatedAt']),
  };
}

/* --------------------------------- orders --------------------------------- */

function toOrderItem(value: unknown): OrderItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const menuItemId = str(raw['menuItemId']);
  if (!menuItemId) return null;

  return {
    menuItemId,
    name: str(raw['name']),
    unitPrice: num(raw['unitPrice']),
    quantity: Math.max(1, Math.round(num(raw['quantity'], 1))),
    isVeg: bool(raw['isVeg']),
    imageUrl: str(raw['imageUrl']),
  };
}

function toOrderStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : 'placed';
}

export function toOrder(snap: QueryDocumentSnapshot<DocumentData>): Order {
  const data = snap.data();
  const items = Array.isArray(data['items'])
    ? data['items'].map(toOrderItem).filter((item): item is OrderItem => item !== null)
    : [];
  const address = toEmbeddedAddress('snapshot', data['address'] as DocumentData);
  const history = Array.isArray(data['statusHistory'])
    ? (data['statusHistory'] as Array<Record<string, unknown>>)
        .map((entry) => ({ status: toOrderStatus(entry['status']), at: toMillis(entry['at']) }))
        .filter((entry) => entry.status !== undefined)
    : [];

  return {
    id: snap.id,
    userId: str(data['userId']),
    userName: str(data['userName'], 'Guest'),
    userEmail: str(data['email'] ?? data['userEmail']),
    restaurantId: str(data['restaurantId']),
    restaurantName: str(data['restaurantName'], 'Restaurant'),
    items,
    address: address ?? {
      id: 'snapshot',
      label: 'Delivery address',
      line1: '',
      city: '',
      postalCode: '',
      phone: '',
      isDefault: true,
    },
    status: toOrderStatus(data['status']),
    paymentMethod: data['paymentMethod'] === 'card_simulated' ? 'card_simulated' : 'cod',
    subtotal: num(data['subtotal']),
    deliveryFee: num(data['deliveryFee']),
    tax: num(data['tax']),
    total: num(data['total']),
    statusHistory: history,
    createdAt: toMillis(data['createdAt']),
    updatedAt: toMillis(data['updatedAt']),
  };
}

/* --------------------------- reviews/favourites --------------------------- */

export function toReview(snap: QueryDocumentSnapshot<DocumentData>): Review {
  const data = snap.data();
  return {
    id: snap.id,
    userId: str(data['userId']),
    userName: str(data['userName'], 'Foodhut user'),
    userPhotoURL: strOrNull(data['userPhotoURL']),
    restaurantId: str(data['restaurantId']),
    menuItemId: strOrNull(data['menuItemId']),
    rating: Math.min(5, Math.max(1, Math.round(num(data['rating'], 5)))),
    comment: str(data['comment']),
    createdAt: toMillis(data['createdAt']),
  };
}

export function toFavourite(snap: QueryDocumentSnapshot<DocumentData>): Favourite {
  const data = snap.data();
  return {
    id: snap.id,
    userId: str(data['userId']),
    restaurantId: str(data['restaurantId']),
    createdAt: toMillis(data['createdAt']),
  };
}

/* --------------------------------- cart ---------------------------------- */

/** Rehydrates the persisted cart, dropping any line that no longer parses. */
export function toCart(raw: unknown): Cart {
  if (typeof raw !== 'object' || raw === null) return emptyCart();
  const data = raw as Record<string, unknown>;

  const lines = Array.isArray(data['lines'])
    ? data['lines'].flatMap((value): CartLine[] => {
        if (typeof value !== 'object' || value === null) return [];
        const line = value as Record<string, unknown>;
        const menuItemId = str(line['menuItemId']);
        const quantity = Math.round(num(line['quantity'], 0));
        if (!menuItemId || quantity < 1) return [];
        return [
          {
            menuItemId,
            restaurantId: str(line['restaurantId']),
            restaurantName: str(line['restaurantName']),
            name: str(line['name']),
            unitPrice: num(line['unitPrice']),
            quantity,
            isVeg: bool(line['isVeg']),
            imageUrl: str(line['imageUrl']),
          },
        ];
      })
    : [];

  return {
    restaurantId: strOrNull(data['restaurantId']),
    restaurantName: strOrNull(data['restaurantName']),
    deliveryFee: num(data['deliveryFee']),
    lines,
  };
}

export function emptyCart(): Cart {
  return { restaurantId: null, restaurantName: null, deliveryFee: 0, lines: [] };
}

/* -------------------------- current-user convenience --------------------- */

export function currentUserId(): string | null {
  return firebaseAuth().currentUser?.uid ?? null;
}

/**
 * Domain models.
 *
 * These types describe documents as they are *stored* in Firestore. Note the
 * deliberate choice to use `Timestamp` (not `Date`) for server-generated times,
 * and to keep the model flat where Firestore rules need to read it.
 */
import type { Timestamp } from 'firebase/firestore';

/* -------------------------------------------------------------------------- */
/*                                   Users                                    */
/* -------------------------------------------------------------------------- */

export const USER_ROLES = ['customer', 'owner', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * A delivery address.
 *
 * Stored as its own document under `users/{uid}/addresses/{addressId}` rather
 * than as an array on the profile. That is partly a rules-language constraint:
 * there is no iteration construct, so an array of addresses could never be
 * validated entry by entry. It is also better modelling — updating one address
 * does not rewrite every other one, and the profile document stays small.
 */
export interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  phone: string;
  isDefault: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  phone: string | null;
  /**
   * `admin` is the only role that can be granted outside the app (via a script
   * or the console). Being an `owner` is *derived* from `restaurants.ownerId`
   * rather than stored, so there is no client-writable ownership field to abuse.
   */
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** The subset of a profile safe to read before the document resolves. */
export type UserProfileDraft = Pick<UserProfile, 'uid' | 'displayName' | 'email' | 'role'> & {
  photoURL: string | null;
};

/* -------------------------------------------------------------------------- */
/*                                Restaurants                                 */
/* -------------------------------------------------------------------------- */

export const PRICE_LEVELS = [1, 2, 3, 4] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

export interface RestaurantLocation {
  area: string;
  city: string;
  /** Not geocoded — a free-text pin the user reads on the card. */
  landmark?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  cuisines: string[];
  imageUrl: string;
  coverImageUrl: string | null;
  /** Denormalised aggregates, recomputed by Cloud Functions in production. */
  rating: number;
  ratingCount: number;
  deliveryTimeMinutes: number;
  deliveryFee: number;
  priceLevel: PriceLevel;
  location: RestaurantLocation;
  ownerId: string;
  isOpen: boolean;
  isAcceptingOrders: boolean;
  isFeatured: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/*                                  Menu                                      */
/* -------------------------------------------------------------------------- */

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  /** Stored in the smallest currency unit (paise/cents) to avoid float drift. */
  price: number;
  imageUrl: string;
  category: string;
  isVeg: boolean;
  isAvailable: boolean;
  rating: number;
  ratingCount: number;
  /** Manual sort key so owners control menu order. */
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MenuItemDraft = Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>;

/* -------------------------------------------------------------------------- */
/*                                  Orders                                    */
/* -------------------------------------------------------------------------- */

export const ORDER_STATUSES = [
  'placed',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses that still represent work in progress. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'placed',
  'confirmed',
  'preparing',
  'out_for_delivery',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order placed',
  confirmed: 'Restaurant confirmed',
  preparing: 'Preparing your food',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_METHODS = ['cod', 'card_simulated'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface OrderItem {
  menuItemId: string;
  name: string;
  /** Price captured at checkout, so later menu edits never rewrite history. */
  unitPrice: number;
  quantity: number;
  isVeg: boolean;
  imageUrl: string;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
}

export interface Order extends OrderTotals {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  address: Address;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  statusHistory: Array<{ status: OrderStatus; at: Timestamp }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/*                            Reviews & favourites                            */
/* -------------------------------------------------------------------------- */

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL: string | null;
  restaurantId: string;
  menuItemId: string | null;
  rating: number;
  comment: string;
  createdAt: Timestamp;
}

export interface Favourite {
  id: string;
  userId: string;
  restaurantId: string;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/*                               Cart (local)                                 */
/* -------------------------------------------------------------------------- */

/**
 * The cart lives in the browser only, so it uses plain primitives — no
 * `Timestamp`, no Firestore references. This keeps it trivially serialisable
 * to `localStorage` and rehydratable on reload.
 */
export interface CartLine {
  menuItemId: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isVeg: boolean;
  imageUrl: string;
}

/** Cart is single-restaurant, like most real delivery apps. */
export interface Cart {
  restaurantId: string | null;
  restaurantName: string | null;
  deliveryFee: number;
  lines: CartLine[];
}

/**
 * Order lifecycle.
 *
 * Totals are computed server-side in production (Cloud Function + payment
 * provider). Here the client computes them from a price snapshot embedded in
 * the order — which is the part that actually matters for correctness: the
 * price shown at checkout is preserved forever, even if the restaurant later
 * edits its menu.
 */
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy as fbOrderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { firestore } from '@/config/firebase';
import { toOrder } from '@/lib/mappers';
import { orderDoc, ordersCollection } from '@/lib/paths';
import { calculateTotals } from '@/lib/format';
import { now } from '@/lib/firebase/converters';
import { toUserMessage } from '@/lib/firebase/errors';
import type {
  Address,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Restaurant,
} from '@/types/models';

export interface PlaceOrderInput {
  userId: string;
  userName: string;
  userEmail: string;
  restaurant: Pick<Restaurant, 'id' | 'name' | 'deliveryFee'>;
  lines: OrderItem[];
  address: Address;
  paymentMethod: PaymentMethod;
}

export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  const db = firestore();
  const { subtotal, deliveryFee, tax, total } = calculateTotals(input.lines, {
    deliveryFee: input.restaurant.deliveryFee,
  });

  const ref = await addDoc(collection(db, ordersCollection()), {
    userId: input.userId,
    userName: input.userName,
    email: input.userEmail,
    restaurantId: input.restaurant.id,
    restaurantName: input.restaurant.name,
    items: input.lines.map((line) => ({ ...line })),
    address: { ...input.address },
    subtotal,
    deliveryFee,
    tax,
    total,
    status: 'placed' as OrderStatus,
    paymentMethod: input.paymentMethod,
    // Client-side clock: `serverTimestamp()` cannot be used inside `arrayUnion`.
    statusHistory: [{ status: 'placed' as OrderStatus, at: now() }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function fetchMyOrders(userId: string, max = 20): Promise<Order[]> {
  const snap = await getDocs(
    query(
      collection(firestore(), ordersCollection()),
      where('userId', '==', userId),
      fbOrderBy('createdAt', 'desc'),
      fbLimit(max),
    ),
  );
  return snap.docs.map(toOrder);
}

/** Live feed for the owner dashboard. Always returns an unsubscribe function. */
export function subscribeToRestaurantOrders(
  restaurantId: string,
  handlers: { onChange: (orders: Order[]) => void; onError?: (message: string) => void },
  max = 50,
): Unsubscribe {
  const q = query(
    collection(firestore(), ordersCollection()),
    where('restaurantId', '==', restaurantId),
    fbOrderBy('createdAt', 'desc'),
    fbLimit(max),
  );

  return onSnapshot(
    q,
    (snap) => handlers.onChange(snap.docs.map(toOrder)),
    (error) => handlers.onError?.(toUserMessage(error)),
  );
}

/**
 * Advances an order. Rules only permit the owning restaurant (or an admin) to
 * move an order forward, and the customer to cancel it — the client is not the
 * security boundary, the rules file is.
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await updateDoc(doc(firestore(), orderDoc(orderId)), {
    status,
    updatedAt: serverTimestamp(),
    statusHistory: arrayUnion({ status, at: now() }),
  });
}

export async function cancelOrder(orderId: string): Promise<void> {
  await updateDoc(doc(firestore(), orderDoc(orderId)), {
    status: 'cancelled' as OrderStatus,
    updatedAt: serverTimestamp(),
    statusHistory: arrayUnion({ status: 'cancelled' as OrderStatus, at: now() }),
  });
}

/**
 * Local cart store, persisted to `localStorage`.
 *
 * The cart is intentionally *local only*: a user may browse and build a basket
 * before signing in, and a Cloud Function (or an `orders` write trigger) is what
 * turns it into a real order. Persistence is defensive — a corrupted payload is
 * discarded rather than crashing the app.
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import { DELIVERY_FEE_FALLBACK, calculateTotals } from '@/lib/format';
import { emptyCart, toCart } from '@/lib/mappers';
import type { Cart, CartLine, MenuItem, Restaurant } from '@/types/models';

const STORAGE_KEY = 'foodhut:cart:v1';

export interface CartContextValue {
  cart: Cart;
  totals: { subtotal: number; deliveryFee: number; tax: number; total: number };
  itemCount: number;
  isEmpty: boolean;
  quantityOf: (menuItemId: string) => number;
  addItem: (restaurant: Restaurant, item: MenuItem, quantity?: number) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  increment: (menuItemId: string) => void;
  decrement: (menuItemId: string) => void;
  removeItem: (menuItemId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/* -------------------------------- reducer --------------------------------- */

type CartAction =
  | { type: 'add'; restaurant: Restaurant; item: MenuItem; quantity: number }
  | { type: 'setQuantity'; menuItemId: string; quantity: number }
  | { type: 'increment'; menuItemId: string }
  | { type: 'decrement'; menuItemId: string }
  | { type: 'remove'; menuItemId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; cart: Cart };

const MAX_QTY_PER_LINE = 20;

function lineFrom(item: MenuItem, restaurant: Restaurant, quantity: number): CartLine {
  return {
    menuItemId: item.id,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    name: item.name,
    unitPrice: item.price,
    quantity,
    isVeg: item.isVeg,
    imageUrl: item.imageUrl,
  };
}

/**
 * A cart may only contain items from one restaurant. Adding from a different
 * restaurant replaces the basket (after the caller confirms) — matching how
 * real delivery apps behave, since a single order maps to one kitchen.
 */
function add(cart: Cart, restaurant: Restaurant, item: MenuItem, quantity: number): Cart {
  const isSameRestaurant = cart.restaurantId === restaurant.id;
  const base: Cart = isSameRestaurant
    ? cart
    : {
        ...emptyCart(),
        deliveryFee: restaurant.deliveryFee,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
      };

  const existing = base.lines.find((line) => line.menuItemId === item.id);

  if (existing) {
    return {
      ...base,
      lines: base.lines.map((line) =>
        line.menuItemId === item.id
          ? { ...line, quantity: Math.min(line.quantity + quantity, MAX_QTY_PER_LINE) }
          : line,
      ),
    };
  }

  return {
    ...base,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    deliveryFee: restaurant.deliveryFee,
    lines: [...base.lines, lineFrom(item, restaurant, Math.min(quantity, MAX_QTY_PER_LINE))],
  };
}

function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case 'add':
      return add(cart, action.restaurant, action.item, action.quantity);

    case 'setQuantity': {
      if (action.quantity <= 0) return withoutLine(cart, action.menuItemId);
      return {
        ...cart,
        lines: cart.lines.map((line) =>
          line.menuItemId === action.menuItemId
            ? { ...line, quantity: Math.min(action.quantity, MAX_QTY_PER_LINE) }
            : line,
        ),
      };
    }

    case 'increment':
      return {
        ...cart,
        lines: cart.lines.map((line) =>
          line.menuItemId === action.menuItemId
            ? { ...line, quantity: Math.min(line.quantity + 1, MAX_QTY_PER_LINE) }
            : line,
        ),
      };

    case 'decrement': {
      const target = cart.lines.find((l) => l.menuItemId === action.menuItemId);
      if (!target) return cart;
      // Decrementing the last unit removes the line — standard cart behaviour.
      if (target.quantity <= 1) return withoutLine(cart, action.menuItemId);
      return {
        ...cart,
        lines: cart.lines.map((line) =>
          line.menuItemId === action.menuItemId ? { ...line, quantity: line.quantity - 1 } : line,
        ),
      };
    }

    case 'remove':
      return withoutLine(cart, action.menuItemId);

    case 'clear':
      return emptyCart();

    case 'hydrate':
      return action.cart;

    default:
      return cart;
  }
}

function withoutLine(cart: Cart, menuItemId: string): Cart {
  const lines = cart.lines.filter((line) => line.menuItemId !== menuItemId);
  return lines.length === 0 ? emptyCart() : { ...cart, lines };
}

/* -------------------------------- provider -------------------------------- */

function readStoredCart(): Cart {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? toCart(JSON.parse(raw)) : emptyCart();
  } catch {
    // Private-mode or corrupted JSON: fall back to an empty cart.
    return emptyCart();
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Hydration happens in an effect (never during render) so SSR and the first
  // client paint always agree — no hydration mismatch.
  const [cart, dispatch] = useReducer(cartReducer, emptyCart());

  useEffect(() => {
    const stored = readStoredCart();
    if (stored.lines.length > 0) dispatch({ type: 'hydrate', cart: stored });
  }, []);

  useEffect(() => {
    try {
      if (cart.lines.length === 0) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Quota or private mode — the cart still works for this session.
    }
  }, [cart]);

  const quantityOf = useCallback(
    (menuItemId: string) =>
      cart.lines.find((line) => line.menuItemId === menuItemId)?.quantity ?? 0,
    [cart.lines],
  );

  const value = useMemo<CartContextValue>(() => {
    const deliveryFee = cart.restaurantId ? cart.deliveryFee || DELIVERY_FEE_FALLBACK : 0;
    return {
      cart,
      totals: calculateTotals(cart.lines, { deliveryFee }),
      itemCount: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
      isEmpty: cart.lines.length === 0,
      quantityOf,
      addItem: (restaurant, item, quantity = 1) =>
        dispatch({ type: 'add', restaurant, item, quantity }),
      setQuantity: (menuItemId, quantity) =>
        dispatch({ type: 'setQuantity', menuItemId, quantity }),
      increment: (menuItemId) => dispatch({ type: 'increment', menuItemId }),
      decrement: (menuItemId) => dispatch({ type: 'decrement', menuItemId }),
      removeItem: (menuItemId) => dispatch({ type: 'remove', menuItemId }),
      clearCart: () => dispatch({ type: 'clear' }),
    };
  }, [cart, quantityOf]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const context = use(CartContext);
  if (context === null) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return context;
}

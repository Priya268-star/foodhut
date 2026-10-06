/**
 * Menu reads for a single restaurant.
 *
 * Menu items live in the `restaurants/{id}/menu` subcollection: it keeps the
 * restaurant document small, scopes security rules naturally, and avoids a
 * growing top-level collection.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { firestore } from '@/config/firebase';
import { toMenuItem } from '@/lib/mappers';
import { menuItemDoc, restaurantMenuCollection } from '@/lib/paths';
import type { MenuItem } from '@/types/models';

export async function fetchMenu(restaurantId: string): Promise<MenuItem[]> {
  const snap = await getDocs(
    query(
      collection(firestore(), restaurantMenuCollection(restaurantId)),
      where('isAvailable', '==', true),
    ),
  );

  return snap.docs
    .map(toMenuItem)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function fetchAllMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const snap = await getDocs(collection(firestore(), restaurantMenuCollection(restaurantId)));
  return snap.docs
    .map(toMenuItem)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function fetchMenuItem(
  restaurantId: string,
  itemId: string,
): Promise<MenuItem | null> {
  const snap = await getDoc(doc(firestore(), menuItemDoc(restaurantId, itemId)));
  if (!snap.exists()) return null;
  return toMenuItem({ id: snap.id, data: () => snap.data() } as never);
}

/** Group items by category, preserving the sort order, for the menu page. */
export function groupMenuByCategory(
  items: MenuItem[],
): Array<{ category: string; items: MenuItem[] }> {
  const groups = new Map<string, MenuItem[]>();

  for (const item of items) {
    const bucket = groups.get(item.category);
    if (bucket) bucket.push(item);
    else groups.set(item.category, [item]);
  }

  return [...groups.entries()].map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }));
}

import { useEffect, useState } from 'react';

import { fetchAllMenuItems } from '@/services/menu';
import type { MenuItem, Restaurant } from '@/types/models';

/**
 * Picks the photograph that best illustrates why a restaurant matched the current
 * filter, keyed by restaurant id.
 *
 * Why this is needed
 * ------------------
 * Every card used to show the restaurant's cover photo, so searching "biryani"
 * returned a restaurant illustrated with a generic thali. The filter said biryani
 * and the picture said "some North Indian food", which reads as a mistake even
 * though the cover is a perfectly good photo - it is simply of a different thing
 * than the one that was searched for.
 *
 * So when a cuisine filter or a search term is active, the card shows the photo of
 * an actual matching dish. With no filter it returns nothing and the card keeps
 * its cover, which is the right default: unfiltered, the cover is what identifies
 * the restaurant.
 *
 * Menus are fetched only while a filter is active, and only for the restaurants
 * currently on screen, so the unfiltered first paint makes no extra queries.
 */
export function useDishCovers(
  restaurants: Restaurant[],
  cuisine: string | null,
  search: string,
): Record<string, string> {
  const [covers, setCovers] = useState<Record<string, string>>({});

  const term = (cuisine ?? search).trim();
  const ids = restaurants.map((r) => r.id).join(',');

  useEffect(() => {
    // Nothing to look up while unfiltered: the restaurant cover is correct then.
    // Deliberately does not `setCovers({})` - clearing state inside the effect
    // body forces an extra render on every filter reset, and the value returned
    // below is already derived from `term`, so a stale map cannot leak out.
    if (!term || restaurants.length === 0) return;

    let cancelled = false;
    const needle = term.toLowerCase();

    async function resolve() {
      const entries = await Promise.all(
        restaurants.map(async (restaurant) => {
          try {
            const menu = await fetchAllMenuItems(restaurant.id);
            const dish = bestDish(menu, needle) ?? signatureDish(restaurant, menu, needle);
            return [restaurant.id, dish?.imageUrl ?? null] as const;
          } catch {
            // A missing menu must not empty the grid; the card falls back to the
            // restaurant cover, which is the previous behaviour.
            return [restaurant.id, null] as const;
          }
        }),
      );

      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of entries) if (url) next[id] = url;
      setCovers(next);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
    // `restaurants` is derived from a paged query, so it changes identity on every
    // page load; the id list is the stable signal that the visible set changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, ids]);

  // Derived rather than stored: with no filter active there is nothing to show, and
  // the empty object is what makes the card fall back to the restaurant cover.
  return term && restaurants.length > 0 ? covers : EMPTY;
}

const EMPTY: Record<string, string> = {};

/**
 * The best dish for a search term, preferring the strongest evidence in order:
 * the dish name, then its category, then its description. Description is last
 * because it is prose - "hyderabadi dum biryani with long-grain basmati" matches
 * a search for "basmati" on a dish that is not what was searched for.
 */
function bestDish(menu: MenuItem[], needle: string): MenuItem | null {
  if (menu.length === 0) return null;

  const score = (dish: MenuItem) => {
    const name = dish.name.toLowerCase();
    if (name.includes(needle)) return 3;
    if (dish.category.toLowerCase().includes(needle)) return 2;
    if (dish.description.toLowerCase().includes(needle)) return 1;
    return 0;
  };

  const scored = menu
    .map((dish) => ({ dish, rank: score(dish) }))
    .filter((entry) => entry.rank > 0)
    // Stable and meaningful: the higher-ranked dish wins, and ties go to the dish
    // the kitchen lists first, which is the one they consider the signature.
    .sort((a, b) => b.rank - a.rank || a.dish.sortOrder - b.dish.sortOrder);

  return scored[0]?.dish ?? null;
}

/**
 * Fallback for filters that name a cuisine rather than a dish: "South Indian"
 * matches no dish name or category, so the dish photo search finds nothing and
 * the card would fall back to the restaurant cover - which is often a generic
 * shot of the place and does not read as the cuisine at all.
 *
 * When the filter matches one of the restaurant's own cuisines, its signature
 * dish is a better illustration than the cover: a dosa rather than a leaf bowl of
 * chutney that could be mistaken for anything. Restricted to that case on
 * purpose - without it, every filter would flatten to the first dish.
 */
function signatureDish(
  restaurant: Restaurant,
  menu: MenuItem[],
  needle: string,
): MenuItem | null {
  const isOwnCuisine = restaurant.cuisines.some((c) => c.toLowerCase().includes(needle));
  if (!isOwnCuisine || menu.length === 0) return null;

  return (
    [...menu].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))[0] ?? null
  );
}
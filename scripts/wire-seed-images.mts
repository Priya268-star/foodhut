/**
 * Rewrites every `imageUrl` in `src/data/seed-data.ts` to point at a local
 * asset in `public/dishes/`, using the manifest built by
 * `scripts/fetch-dish-images.mts` + `scripts/generate-image-placeholders.mts`.
 *
 *   run: npm run images:wire
 *
 * Why local paths
 * ---------------
 * The original seed data carried hand-written Unsplash photo ids that were never
 * checked. They were wrong: a pizza shot sat under "Tiramisu", and Butter
 * Chicken and Chicken 65 shared the same image. Serving everything from our own
 * origin removes both the mismatch and the runtime dependency on a third-party
 * CDN.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const SEED_FILE = resolve(ROOT, 'src', 'data', 'seed-data.ts');
const MANIFEST = resolve(ROOT, 'emulator-data', 'images.json');

interface Entry {
  file: string;
  placeholder?: boolean;
  title?: string;
  source?: string;
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
  dishes: Record<string, Entry>;
  covers: Record<string, Entry>;
};

/** "Spicy Arrabbiata" -> "spicy-arrabbiata", with the few manual aliases. */
const ALIASES: Record<string, string> = {
  'hyderabadi-dum-biryani': 'hyderabadi-dum-biryani',
  'idli-vada-combo': 'idli-vada-combo',
  'classic-smash-burger': 'classic-smash-burger',
};

function slugFor(name: string): string {
  if (ALIASES[name]) return ALIASES[name];
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

let source = readFileSync(SEED_FILE, 'utf8');
let photos = 0;
let placeholders = 0;
const unresolved: string[] = [];

/** Rewrites the `imageUrl: '...'` line inside the block for `name`. */
function replaceImageFor(name: string, kind: 'dish' | 'cover'): void {
  const slug = slugFor(name);
  const entry = kind === 'dish' ? manifest.dishes[slug] : manifest.covers[slug];

  if (!entry) {
    unresolved.push(`${kind}: ${name} (slug "${slug}")`);
    return;
  }

  // Anchor on the `name: '<name>'` line and replace the next imageUrl within it.
  const nameIndex = source.indexOf(`name: '${name}'`);
  if (nameIndex === -1) {
    unresolved.push(`seed name not found: ${name}`);
    return;
  }

  const imageIndex = source.indexOf('imageUrl:', nameIndex);
  if (imageIndex === -1) {
    unresolved.push(`no imageUrl after: ${name}`);
    return;
  }

  const lineEnd = source.indexOf('\n', imageIndex);
  const replacement = `imageUrl: '/${entry.file}',`;

  source = source.slice(0, imageIndex) + replacement + source.slice(lineEnd);
  if (entry.placeholder) placeholders += 1;
  else photos += 1;
}

/* ------------------------------ dish names ------------------------------- */

const DISH_NAMES = [
  'Truffle Mushroom Pizza',
  'Spicy Arrabbiata',
  'Chicken Pesto Penne',
  'Alfredo Fettuccine',
  'Tiramisu',
  'Butter Chicken',
  'Paneer Butter Masala',
  'Dal Makhani',
  'Hyderabadi Dum Biryani',
  'Garlic Naan',
  'Burnt Garlic Noodles',
  'Chicken 65',
  'Chilli Garlic Paneer',
  'Veg Manchurian',
  'Classic Smash Burger',
  'Crispy Chicken Burger',
  'Mushroom Swiss Burger',
  'Loaded Cheese Fries',
  'Masala Dosa',
  'Ghee Roast Dosa',
  'Idli Vada Combo',
  'Filter Coffee',
  'Quinoa Rainbow Bowl',
  'Grilled Chicken Caesar',
  'Cold-Press Green Juice',
];

/* --------------------------- restaurant names --------------------------- */

const RESTAURANT_NAMES = [
  'Truffle Affairs',
  'Saffron Junction',
  'Wok Theory',
  'Smoke & Salt',
  'Kadak Cafe',
  'Green Bowl',
];

const COVER_SLUG: Record<string, string> = {
  'Truffle Affairs': 'cover-pizza-pasta',
  'Saffron Junction': 'cover-north-indian',
  'Wok Theory': 'cover-chinese',
  'Smoke & Salt': 'cover-burgers',
  'Kadak Cafe': 'cover-south-indian',
  'Green Bowl': 'cover-healthy-bowl',
};

for (const name of DISH_NAMES) replaceImageFor(name, 'dish');

for (const name of RESTAURANT_NAMES) {
  const slug = COVER_SLUG[name];
  const entry = manifest.covers[slug];
  if (!entry) {
    unresolved.push(`cover: ${name}`);
    continue;
  }
  const anchor = source.indexOf(`name: '${name}'`);
  const imgIndex = source.indexOf('imageUrl:', anchor);
  const lineEnd = source.indexOf('\n', imgIndex);
  source = source.slice(0, imgIndex) + `imageUrl: '/${entry.file}',` + source.slice(lineEnd);
  const coverIdx = source.indexOf('coverImageUrl:', anchor);
  if (coverIdx !== -1 && coverIdx < anchor + 900) {
    const clEnd = source.indexOf('\n', coverIdx);
    source = source.slice(0, coverIdx) + `coverImageUrl: '/${entry.file}',` + source.slice(clEnd);
  }
  photos += 1;
}

writeFileSync(SEED_FILE, source, 'utf8');

console.log(`dishes/photos rewired : ${photos}`);
console.log(`placeholders wired    : ${placeholders}`);
if (unresolved.length > 0) {
  console.log(`\nUNRESOLVED (${unresolved.length}):`);
  for (const u of unresolved) console.log(`  ${u}`);
  process.exitCode = 1;
} else {
  console.log('\nall image URLs now point at local assets');
}

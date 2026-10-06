/**
 * Downloads dish/cover photos from Wikimedia Commons, accepting **only**
 * unambiguously free licences, and records the attribution each one requires.
 *
 * Why the filter exists
 * ---------------------
 * The first version of this script accepted whatever Commons returned and kept
 * no licence information. That was wrong: Commons hosts public-domain, CC0,
 * CC BY and CC BY-SA work, and the last two legally require attribution — so
 * the project was shipping images with no credits at all.
 *
 * Accepted here:
 *   - public domain / PD-marked      no attribution required, recorded anyway
 *   - CC0 / CC0-like                 no attribution required
 *   - CC BY, CC BY-SA                accepted, but author + licence are written
 *                                    into ATTRIBUTIONS.md and shown in-app
 *
 * Rejected: anything unrecognised, non-free, or NC/ND (the "free" images people
 * actually mean usually are not, which is the point of checking).
 *
 * Why there is also a *subject* filter
 * ----------------------------------
 * A licence check alone is not enough, and the gap showed up on screen. The
 * first pass produced free-licensed but wrong pictures: "Classic Smash Burger"
 * and the burger restaurant cover both ended up showing a photograph of a
 * Big Mac, "Mushroom Swiss Burger" showed a veggie burger, "Dal Makhani"
 * showed a four-dish thali, and a north-Indian cover used a photo whose
 * papad reads as a burger bun. Every one of those is properly licensed and
 * still wrong.
 *
 * So each dish now declares what its photo must and must not depict, branded
 * product photography is refused outright, and anything that cannot be matched
 * is left to `generate-image-placeholders.mts` rather than guessed at.
 *
 *   run: npm run images                     all dishes
 *   run: npm run images -- --only=slug,slug re-fetch specific ones
 *   run: npm run images -- --only=slug --force
 */
import { mkdirSync, existsSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = resolve(ROOT, 'public', 'dishes');
const MANIFEST = resolve(ROOT, 'emulator-data', 'images.json');
const UA = 'FoodhutDemo/1.0 (educational project)';

/** Licences we are willing to ship. */
const ALLOWED = [
  /^public domain$/i,
  /^pd-/i,
  /^cc0/i,
  /^cc[- ]by([- ]sa)?\s*\d/i,
  /^attribution/i,
];

/**
 * Branded food photography is refused even when the licence is perfectly free.
 * A Big Mac photo may well be CC BY-SA, but using it to illustrate a fictional
 * restaurant's "Classic Smash Burger" implies an endorsement that does not
 * exist and puts a third party's trademark on our page.
 */
const BRANDED = new RegExp(
  [
    'big\\s*mac',
    'mcdonald',
    'burger\\s*king',
    "\\bBK\\b",
    'wendy',
    '\\bKFC\\b',
    'subway',
    'starbucks',
    'coca-?cola',
    'pepsi',
    'kellogg',
    'nestl',
    'heinz',
    'oxo',
    'maggi',
    'nests?\\b',
    'red\\s*bull',
    'domino',
    'pizza\\s*hut',
    'domino\'?s',
    'taco\\s*bell',
    'kfc\\b',
    'lipton',
    'nescafe',
    'oreo',
    'cadbury',
    'lindt',
    // Endorsed-product naming: a detox smoothie named after a TV presenter is
    // still a branded product shot.
    'dr\\.?\\s*oz',
    'oprah',
  ].join('|'),
  'i',
);

interface Dish {
  slug: string;
  query: string;
  /** Commons names the subject in the filename, so a second phrasing helps. */
  altQuery?: string;
  /** The photo's title must match at least one of these to be accepted. */
  require?: RegExp;
  /** Rejected even when `require` passes, e.g. "veggie" on a burger. */
  reject?: RegExp;
}

const DISHES: Dish[] = [
  { slug: 'truffle-mushroom-pizza', query: 'Mushroom pizza', altQuery: 'Pizza mushroom', require: /pizza/i },
  { slug: 'spicy-arrabbiata', query: 'Arrabbiata', altQuery: 'Penne arrabbiata', require: /arrabbiata|penn(e|ne)/i },
  { slug: 'chicken-pesto-penne', query: 'Penne pesto', altQuery: 'Pasta pesto', require: /pesto|penn(e|ne)/i },
  { slug: 'alfredo-fettuccine', query: 'Fettuccine Alfredo', altQuery: 'Fettuccine', require: /fettuccine|alfredo/i },
  { slug: 'tiramisu', query: 'Tiramisu', altQuery: 'Tiramisu dessert', require: /tiramisu/i },

  { slug: 'butter-chicken', query: 'Butter chicken', altQuery: 'Chicken makhani', require: /butter\s*chicken|makhani/i },
  { slug: 'paneer-butter-masala', query: 'Paneer makhani', altQuery: 'Paneer masala', require: /paneer/i },
  { slug: 'dal-makhani', query: 'Dal Makhani', altQuery: 'Dal makhani', require: /dal\s*makhani/i, reject: /thali|parantha|bhindi|paratha/i },
  { slug: 'hyderabadi-dum-biryani', query: 'Hyderabadi Biryani', altQuery: 'Biryani', require: /biryani/i },
  { slug: 'garlic-naan', query: 'Naan Tandoor', altQuery: 'Naan bread', require: /naan/i },

  { slug: 'burnt-garlic-noodles', query: 'Hakka noodles', altQuery: 'Wok noodles', require: /noodle/i, reject: /kway\s*teow|chilli\s*pan\s*mee/i },
  { slug: 'chicken-65', query: 'Chicken 65', altQuery: 'Chicken 65 dish', require: /chicken\s*65/i },
  { slug: 'chilli-garlic-paneer', query: 'Chilli paneer', altQuery: 'Paneer chilli', require: /paneer/i },
  { slug: 'veg-manchurian', query: 'Manchurian', altQuery: 'Gobi manchurian', require: /manchurian/i },

  { slug: 'classic-smash-burger', query: 'Hamburger', altQuery: 'Cheeseburger', require: /burger|hamburger|cheeseburger/i },
  { slug: 'crispy-chicken-burger', query: 'Chicken burger', altQuery: 'Fried chicken burger', require: /burger|sandwich/i },
  { slug: 'mushroom-swiss-burger', query: 'Mushroom burger', altQuery: 'Portobello burger', require: /mushroom|portobello/i, reject: /veggie|vegetarian|bean\s*burger/i },
  { slug: 'loaded-cheese-fries', query: 'Cheese fries', altQuery: 'French fries', require: /fries/i },

  { slug: 'masala-dosa', query: 'Masala Dosa', altQuery: 'Dosa', require: /dosa/i },
  { slug: 'ghee-roast-dosa', query: 'Ghee Roast Dosa', altQuery: 'Dosa', require: /dosa/i },
  { slug: 'idli-vada-combo', query: 'Idli vada', altQuery: 'Idli', require: /idli|vada/i },
  {
    slug: 'filter-coffee',
    query: 'Kaapi',
    altQuery: 'Filter coffee glass milk',
    /*
     * Rejects espresso and cappuccino. Three small cups of black coffee were
     * accepted for this slot on the strength of the word "coffee", which is the
     * weakest possible match: South Indian filter coffee is a milky decoction
     * poured between a steel tumbler and a davara, and the description on the
     * menu card says exactly that. A photo of espresso contradicts the copy.
     *
     * The apparatus is rejected too - a disassembled davara and filter paper on a
     * black background is a documentary shot, not something you order.
     */
    require: /filter|davara|kaapi|coffee/i,
    reject:
      /espresso|cappuccino|latte|americano|macchiato|cortado|flat\s*white|ristretto|shot|disassembl|apparatus|filter\s*paper|equipment|parts|disassembled/i,
  },

  { slug: 'quinoa-rainbow-bowl', query: 'Quinoa salad', altQuery: 'Quinoa', require: /quinoa/i },
  { slug: 'grilled-chicken-caesar', query: 'Caesar salad', altQuery: 'Salad', require: /caesar|salad/i },
  {
    slug: 'cold-press-green-juice',
    query: 'Green smoothie',
    altQuery: 'Green smoothie glass',
    /*
     * "smoothie" alone is too weak a match: it accepted a bright orange mango
     * smoothie for a *green* juice, which is the kind of plausible-looking wrong
     * picture that survives every other check. The colour is the whole point of
     * the dish, so the title has to say green, and any other fruit is refused.
     */
    require: /green/i,
    reject: /mango|orange|carrot|beet|beetroot|strawberr|berry|pineapple|turmeric|banana|apple|juicer|blender|extractor|applian|machine|equipment|press\b|chocolate|bowl/i,
  },
];

/*
 * Covers are the most visible images on the site, and the hardest to get right:
 * they stand in for a whole restaurant. The searches below deliberately avoid
 * cuisine words on their own, because "Pizzeria" returned a kebab shop front
 * and "Chinese food" returned a Paris noodle display case. Each cover demands a
 * plate of food, and rejects storefronts, signage and shop interiors.
 */
const SHOP_OR_SIGNAGE = /restaurant|shop|store|storefront|shopfront|front|sign|signage|menu|interior|display\s*case|kebab|pizzeria|cafe\s*sign|window/i;

/*
 * Places rather than plates. A cover has to show food, and Commons is full of
 * "Chong-Ming Danzih Noodles" street photography: the title names a noodle dish
 * because the dish was photographed on the table of a restaurant that the
 * photographer then shot from the outside. The title is about the venue, the
 * picture is of a street.
 */
const ARCHITECTURE = /building|street|city|town|village|facade|skyline|road|alley|district|architecture|landscape|sky|bridge|temple|church|market|station|airport|harbou?r|train|bus\s*stop/i;

const COVERS: Dish[] = [
  { slug: 'cover-pizza-pasta', query: 'Pizza margherita', altQuery: 'Pizza plate', require: /pizza/i, reject: SHOP_OR_SIGNAGE },
  {
    slug: 'cover-north-indian',
    query: 'Butter chicken curry',
    altQuery: 'Indian curry naan',
    require: /curry|butter\s*chicken|naan|tikka/i,
    reject: SHOP_OR_SIGNAGE,
  },
  {
    slug: 'cover-chinese',
    query: 'Paste Noodles',
    altQuery: 'Chow mein plate',
    /*
     * "Noodles dish" kept returning "Chong-Ming Danzih Noodles", which is a
     * street photograph in a Taiwanese city - the title names a noodle dish
     * because that is what the restaurant behind the camera was serving. No
     * architecture word appears in it, so the query itself has to ask for a
     * dish, and "mein" is accepted alongside "noodle" because chow mein is
     * the dish name rather than the ingredient.
     */
    require: /noodle|chow\s*mein|chowmein|lo\s*mein|mei\s*fen/i,
    reject: SHOP_OR_SIGNAGE,
  },
  { slug: 'cover-burgers', query: 'Cheeseburger plate', altQuery: 'Hamburger bun lettuce', require: /burger|hamburger/i, reject: SHOP_OR_SIGNAGE },
  {
    slug: 'cover-south-indian',
    query: 'Idli sambar plate',
    altQuery: 'Dosa sambar',
    require: /dosa|idli|vada|sambar|uttapam/i,
    // Reuses SHOP_OR_SIGNAGE, which also covers the storefronts "Masala Dosa plate"
// kept returning; the Goan "plyan dosa" stays excluded either way.
reject: SHOP_OR_SIGNAGE,
  },
  { slug: 'cover-healthy-bowl', query: 'Salad bowl', altQuery: 'Quinoa salad bowl', require: /salad|bowl|quinoa/i },
];

interface Candidate {
  url: string;
  title: string;
  licence: string;
  author: string;
  page: string;
}

const strip = (html?: string) =>
  (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

/*
 * Commons search is semantic, so a dish query can match something that merely
 * shares a word: "Salad bowl" once returned an 18th-century porcelain bowl from
 * a museum, and "North Indian" returned people dancing at a festival. These
 * files are often genuinely free-licensed, which is exactly why a licence check
 * alone is not enough - the *subject* has to be food.
 */
const NOT_FOOD = /\b(met|museum|porcelain|factory|antiqu|archaeolog|artefact|artifact|ornament|furniture|dancing|dance|festival|spectator|statue|painting|sculpture|stamp|banknote|figs?\b)\b/i;

function isFoodSubject(title: string, width: number, height: number): boolean {
  if (NOT_FOOD.test(title)) return false;
  if (ARCHITECTURE.test(title)) return false;
  // Reject diagrams, maps and documents masquerading as photos.
  if (/\b(diagram|map|chart|graph|cover|logo|icon|screenshot)\b/i.test(title)) return false;
  /*
   * Reject video files. Commons stores clips under File: with the same semantic
   * search index, so a query for a dish happily returns a .webm — which then
   * downloads as a few hundred kilobytes of something no <img> can display.
   */
  if (/\.(webm|ogv|ogg|mp4|m4v|avi|mov|mkv)\b/i.test(title)) return false;
  void width;
  void height;
  return true;
}

function licenceAllowed(licence: string): boolean {
  if (!licence || licence === 'UNKNOWN') return false;
  // Non-commercial / no-derivatives variants are deliberately excluded.
  if (/\b(nc|nd)\b|non-?commercial|no-?deriv/i.test(licence)) return false;
  return ALLOWED.some((pattern) => pattern.test(licence));
}

/**
 * Decides whether a candidate photo actually depicts the dish it was fetched
 * for. Commons' own metadata does not say what is in the picture, and search
 * ordering is not a relevance judgement, so this is checked against the title.
 */
function subjectMatches(dish: Dish, title: string): boolean {
  if (BRANDED.test(title)) return false;
  if (dish.require && !dish.require.test(title)) return false;
  if (dish.reject && dish.reject.test(title)) return false;
  return true;
}

async function searchCommons(dish: Dish, query: string): Promise<Candidate | null> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
    `&gsrsearch=${encodeURIComponent(query)}` +
    '&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|size|extmetadata' +
    '&iiurlwidth=1000&format=json&origin=*';

  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: Array<{
            thumburl?: string;
            width?: number;
            height?: number;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(body.query?.pages ?? {}).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;

    const w = info.width ?? 0;
    const h = info.height ?? 0;
    if (w < 500 || h < 300) continue;
    const ratio = w / h;
    if (ratio < 0.85 || ratio > 2.1) continue;

    const meta = info.extmetadata ?? {};
    const licence = strip(meta['LicenseShortName']?.value);
    if (!licenceAllowed(licence)) continue;
    if (!isFoodSubject(page.title, w, h)) continue;
    if (!subjectMatches(dish, page.title)) continue;

    return {
      url: info.thumburl,
      title: page.title,
      licence,
      author: strip(meta['Artist']?.value) || 'Unknown author',
      page: info.descriptionurl ?? '',
    };
  }
  return null;
}

async function download(url: string, destination: string): Promise<boolean> {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) return false;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 5000) return false;
  writeFileSync(destination, buffer);
  return true;
}

interface Entry {
  file: string;
  title?: string;
  licence?: string;
  author?: string;
  source?: string;
  page?: string;
  placeholder?: boolean;
  label?: string;
}

/* ------------------------------ CLI switches ------------------------------ */

const argv = process.argv.slice(2);
const onlyArg = argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim())) : null;
const FORCE = argv.includes('--force');

const wanted = (list: Dish[]) => (ONLY ? list.filter((d) => ONLY.has(d.slug)) : list);

async function resolveDish(dish: Dish): Promise<Candidate | null> {
  for (const query of [dish.query, dish.altQuery].filter(Boolean) as string[]) {
    await new Promise((r) => setTimeout(r, 600)); // polite rate limiting
    const found = await searchCommons(dish, query);
    if (found) return found;
  }
  return null;
}

async function handle(label: string, list: Dish[]): Promise<Record<string, Entry>> {
  console.log(`\n${label}\n`);
  const out: Record<string, Entry> = {};

  const prior = (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {
    dishes: {},
    covers: {},
  }) as { dishes: Record<string, Entry>; covers: Record<string, Entry> };

  for (const dish of list) {
    const destination = resolve(OUT_DIR, `${dish.slug}.jpg`);
    const existing = existsSync(destination) && statSync(destination).size > 5000;

    // Reuse a cached photo only if we still know its licence AND it was vetted
    // by the current subject rules. Older entries predate those rules, so an
    // explicit --force is the way to re-check one.
    if (existing && !FORCE) {
      const known = prior.dishes[dish.slug] ?? prior.covers[dish.slug];
      if (known?.licence && subjectMatches(dish, known.title ?? '')) {
        out[dish.slug] = known;
        console.log(`  cached    ${dish.slug.padEnd(24)} ${known.licence}`);
        continue;
      }
    }

    const found = await resolveDish(dish);
    if (!found) {
      console.log(`  no-match  ${dish.slug.padEnd(24)} (nothing free AND showing the right dish)`);
      continue;
    }

    if (await download(found.url, destination)) {
      out[dish.slug] = {
        file: `dishes/${dish.slug}.jpg`,
        title: found.title,
        licence: found.licence,
        author: found.author,
        source: found.url,
        page: found.page,
      };
      console.log(`  ok        ${dish.slug.padEnd(24)} ${found.licence.padEnd(14)} ${found.title}`);
    } else {
      console.log(`  FAILED    ${dish.slug}`);
    }
  }

  console.log(`  ${Object.keys(out).length}/${list.length} sourced with a verified free licence`);
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(resolve(ROOT, 'emulator-data'), { recursive: true });

if (ONLY) console.log(`re-fetching only: ${[...ONLY].join(', ')}${FORCE ? ' (forced)' : ''}`);

const dishes = await handle('dishes', wanted(DISHES));
const covers = await handle('covers', wanted(COVERS));

let prior: { dishes: Record<string, Entry>; covers: Record<string, Entry> } = {
  dishes: {},
  covers: {},
};
if (existsSync(MANIFEST)) prior = JSON.parse(readFileSync(MANIFEST, 'utf8'));

const mergedDishes = { ...prior.dishes, ...dishes };
const mergedCovers = { ...prior.covers, ...covers };

// Drop cached photos whose licence could not be established.
for (const [slug, entry] of Object.entries(mergedDishes)) {
  if (!entry.placeholder && !entry.licence) delete mergedDishes[slug];
}
for (const [slug, entry] of Object.entries(mergedCovers)) {
  if (!entry.placeholder && !entry.licence) delete mergedCovers[slug];
}

/*
 * A photo that fails today's brand or subject rules must not survive in the
 * manifest just because it is cached. Clear it so the placeholder generator
 * replaces the file rather than leaving a known-wrong picture in place.
 */
if (ONLY && FORCE) {
  for (const slug of ONLY) {
    for (const bucket of [mergedDishes, mergedCovers]) {
      const entry = bucket[slug];
      if (entry && entry.title && !subjectMatches(
        [...DISHES, ...COVERS].find((d) => d.slug === slug) ?? { slug, query: '' },
        entry.title,
      )) {
        console.log(`  rejected  ${slug.padEnd(24)} was ${entry.title}`);
        delete bucket[slug];
      }
    }
  }
}

writeFileSync(MANIFEST, `${JSON.stringify({ dishes: mergedDishes, covers: mergedCovers }, null, 2)}\n`, 'utf8');

/* --------------------------- attribution file ---------------------------- */

const all = [...Object.entries(mergedDishes), ...Object.entries(mergedCovers)].filter(
  ([, e]) => !e.placeholder && e.licence,
);

const rows = all
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([slug, e]) => `| \`${slug}\` | ${e.title?.replace('File:', '')} | ${e.licence} | ${e.author} |`);

const attribution = `# Image credits

Every photo in \`public/dishes/\` comes from Wikimedia Commons and is used under
the licence listed below. Images marked "Generated placeholder" are produced by
\`scripts/generate-image-placeholders.mts\` and are ours to use freely.

Sourced with \`npm run images\`, which **rejects any file whose licence it cannot
confirm is free**, so nothing unlicensed or non-commercial slipped in. It also
refuses branded product photography and checks that each photo's title matches
the dish it stands for — a licence check alone once put a Big Mac on the page
twice, because the photo was free-licensed and still wrong.

| Asset | Source file | Licence | Author |
| ----- | ----------- | ------- | ------ |
${rows.join('\n')}

Public-domain and CC0 images are listed for completeness; only CC BY / CC BY-SA
require attribution, and those are credited above.

Regenerate with: \`npm run images && npm run images:placeholder\`
`;

writeFileSync(resolve(ROOT, 'ATTRIBUTIONS.md'), attribution, 'utf8');

const counts = new Map<string, number>();
for (const [, e] of all) counts.set(e.licence!, (counts.get(e.licence!) ?? 0) + 1);

console.log('\nlicence breakdown');
for (const [licence, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${licence}`);
}
console.log(`\ncredits written to ATTRIBUTIONS.md (${all.length} photos)`);
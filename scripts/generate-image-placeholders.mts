/**
 * Generates a branded placeholder card for any dish or cover that
 * `scripts/fetch-dish-images.mts` could not source a trustworthy photo for.
 *
 * This is a deliberate fallback, not a shortcut. Automated image search is
 * unreliable — it matched a pasta photo to "Grilled Chicken Caesar" and a
 * drinking glass to "Cold-Press Green Juice" — and a confidently wrong photo is
 * worse than no photo at all. Where the match cannot be verified, the app shows
 * a clean gradient card with the dish name instead. It never lies about the
 * food, and an owner can replace it with a real photo from the dashboard.
 *
 * Glyphs are drawn as SVG paths rather than emoji on purpose: emoji survive
 * neither a stray `Set-Content` nor a font that lacks them, and an earlier
 * revision of this file shipped mojibake (`ðŸ¥`) because of exactly that.
 *
 *   run: npm run images:placeholder
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DISH_DIR = resolve(ROOT, 'public', 'dishes');
const MANIFEST = resolve(ROOT, 'emulator-data', 'images.json');

type Glyph = 'pizza' | 'curry' | 'bowl' | 'drink' | 'bread' | 'cup' | 'noodles';

/**
 * Simple line-art glyphs, drawn in a 100x100 box and scaled by the caller.
 * Strokes only, so they read at card size and need no external font.
 */
const GLYPHS: Record<Glyph, string> = {
  pizza: `
    <path d="M50 12 L88 74 A44 44 0 0 1 12 74 Z" />
    <path d="M12 74 H88" />
    <circle cx="44" cy="46" r="5" />
    <circle cx="62" cy="60" r="5" />
    <circle cx="36" cy="64" r="4" />`,
  curry: `
    <path d="M18 44 H82 A32 32 0 0 1 18 44 Z" />
    <path d="M14 40 H86 A6 6 0 0 1 86 52 H14 A6 6 0 0 1 14 40 Z" />
    <path d="M40 30 C44 24 56 24 60 30" />`,
  bowl: `
    <path d="M16 48 H84 A34 34 0 0 1 16 48 Z" />
    <path d="M12 44 H88 A6 6 0 0 1 88 56 H12 A6 6 0 0 1 12 44 Z" />
    <path d="M36 32 A16 16 0 0 1 64 32" />
    <circle cx="40" cy="64" r="4" />
    <circle cx="58" cy="68" r="4" />`,
  drink: `
    <path d="M38 14 H62 L58 86 H42 Z" />
    <path d="M38 44 H62" />
    <path d="M62 30 L76 22" />`,
  bread: `
    <ellipse cx="50" cy="50" rx="32" ry="36" />
    <path d="M32 40 q8 6 0 12" />
    <path d="M50 36 q8 6 0 12" />
    <path d="M66 44 q6 5 0 10" />`,
  cup: `
    <path d="M30 30 H66 V72 A10 10 0 0 1 56 82 H40 A10 10 0 0 1 30 72 Z" />
    <path d="M66 42 H76 A10 10 0 0 1 76 62 H66" />
    <path d="M40 22 C44 16 54 16 58 22" />`,
  noodles: `
    <path d="M20 56 H80 A30 30 0 0 1 20 56 Z" />
    <path d="M16 52 H84 A6 6 0 0 1 84 64 H16 A6 6 0 0 1 16 52 Z" />
    <path d="M36 20 C30 30 44 36 38 46" />
    <path d="M54 18 C48 28 62 34 56 44" />`,
};

interface Entry {
  label: string;
  glyph: Glyph;
  from: string;
  to: string;
}

const LABELS: Record<string, Entry> = {
  'spicy-arrabbiata': { label: 'Spicy Arrabbiata', glyph: 'pizza', from: '#e23744', to: '#7f1d1d' },
  'paneer-butter-masala': { label: 'Paneer Butter Masala', glyph: 'curry', from: '#f59e0b', to: '#92400e' },
  'masala-dosa': { label: 'Masala Dosa', glyph: 'bread', from: '#d97706', to: '#78350f' },
  'ghee-roast-dosa': { label: 'Ghee Roast Dosa', glyph: 'bread', from: '#d97706', to: '#78350f' },
  'idli-vada-combo': { label: 'Idli Vada Combo', glyph: 'bowl', from: '#ca8a04', to: '#713f12' },
  'filter-coffee': { label: 'Filter Coffee', glyph: 'cup', from: '#a16207', to: '#451a03' },
  'quinoa-rainbow-bowl': { label: 'Quinoa Rainbow Bowl', glyph: 'bowl', from: '#10b981', to: '#065f46' },
  'grilled-chicken-caesar': { label: 'Grilled Chicken Caesar', glyph: 'bowl', from: '#84cc16', to: '#3f6212' },
  'cold-press-green-juice': { label: 'Cold-Press Green Juice', glyph: 'drink', from: '#22c55e', to: '#14532d' },
  'cover-north-indian': { label: 'North Indian', glyph: 'curry', from: '#e23744', to: '#7f1d1d' },
  'cover-south-indian': { label: 'South Indian', glyph: 'bread', from: '#f59e0b', to: '#92400e' },
  'cover-healthy-bowl': { label: 'Healthy Bowls', glyph: 'bowl', from: '#10b981', to: '#065f46' },
  'cover-pizza-pasta': { label: 'Pizza & Pasta', glyph: 'pizza', from: '#e23744', to: '#7f1d1d' },
  'cover-chinese': { label: 'Chinese', glyph: 'noodles', from: '#dc2626', to: '#7f1d1d' },
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

function placeholderSvg(label: string, glyph: Glyph, from: string, to: string, wide: boolean): string {
  const w = wide ? 1200 : 900;
  const h = wide ? 520 : 900;
  /*
   * Scale from the smaller dimension. Scaling from the width looked fine on
   * the square dish cards but overflowed on the wide cover cards, drawing the
   * glyph straight through the label.
   */
  const glyphSize = Math.min(w, h) * 0.4;
  const gx = (w - glyphSize) / 2;
  const gy = h * 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.84}" cy="${h * 0.16}" r="${w * 0.24}" fill="#ffffff" opacity="0.06"/>
  <circle cx="${w * 0.12}" cy="${h * 0.88}" r="${w * 0.28}" fill="#ffffff" opacity="0.05"/>
  <g transform="translate(${gx} ${gy}) scale(${glyphSize / 100})"
     fill="none" stroke="#ffffff" stroke-width="3.5"
     stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
${GLYPHS[glyph]}
  </g>
  <text x="50%" y="${h * 0.74}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="${Math.min(w, h) * 0.08}" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(label)}</text>
  <text x="50%" y="${h * 0.84}" font-family="ui-sans-serif, system-ui, sans-serif"
        font-size="${Math.min(w, h) * 0.042}" font-weight="500" fill="#ffffff" opacity="0.7" text-anchor="middle">Foodhut</text>
</svg>
`;
}

mkdirSync(DISH_DIR, { recursive: true });
mkdirSync(resolve(ROOT, 'emulator-data'), { recursive: true });

let manifest: { dishes: Record<string, unknown>; covers: Record<string, unknown> } = {
  dishes: {},
  covers: {},
};
if (existsSync(MANIFEST)) {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as typeof manifest;
}

let created = 0;

for (const [slug, meta] of Object.entries(LABELS)) {
  const isCover = slug.startsWith('cover-');
  const bucket = (isCover ? manifest.covers : manifest.dishes) as Record<string, unknown>;

  // A real photo already exists — never overwrite it with a placeholder.
  const existing = bucket[slug] as { placeholder?: boolean } | undefined;
  if (existing && !existing.placeholder) {
    console.log(`  photo        ${slug}`);
    continue;
  }

  const file = `dishes/${slug}.svg`;
  writeFileSync(
    resolve(DISH_DIR, `${slug}.svg`),
    placeholderSvg(meta.label, meta.glyph, meta.from, meta.to, isCover),
    'utf8',
  );

  bucket[slug] = { file, placeholder: true, label: meta.label, glyph: meta.glyph };
  created += 1;
  console.log(`  placeholder  ${slug.padEnd(24)} ${meta.glyph}`);
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`\nplaceholders written: ${created}`);
/**
 * Verifies that every image path referenced by the seed actually resolves, and
 * that the file it resolves to matches what the image manifest says it should
 * be (a photograph, or a generated placeholder).
 *
 * This exists because the two can drift: the fetcher rewrites the manifest, the
 * wire script rewrites the seed, and a slug that falls back to a placeholder
 * leaves a `.jpg` on disk that nothing references while Firestore is told to
 * serve an `.svg`. A mismatch here is an invisible broken image in production.
 *
 *   run: npm run images:verify
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const SEED = resolve(ROOT, 'src', 'data', 'seed-data.ts');
const MANIFEST = resolve(ROOT, 'emulator-data', 'images.json');
const PUBLIC = resolve(ROOT, 'public');

interface Entry {
  file: string;
  placeholder?: boolean;
  /** True for photographs supplied through drop-photos/ - ours, no licence. */
  own?: boolean;
  licence?: string;
  title?: string;
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
  dishes: Record<string, Entry>;
  covers: Record<string, Entry>;
};
const seed = readFileSync(SEED, 'utf8');

/** Every `imageUrl: '/dishes/...'` in the seed, in file order. */
const refs = [...seed.matchAll(/imageUrl:\s*'(\/dishes\/[^']+)'/g)].map((m) => m[1] as string);

const problems: string[] = [];
const seen = new Set(refs);

for (const ref of seen) {
  const onDisk = resolve(PUBLIC, ref.replace(/^\//, ''));

  if (!existsSync(onDisk)) {
    problems.push(`${ref} -> referenced by the seed but MISSING from public/`);
    continue;
  }
  if (statSync(onDisk).size < 200) {
    problems.push(`${ref} -> present but only ${statSync(onDisk).size} bytes (truncated?)`);
  }

  const slug = ref.split('/').pop()!.replace(/\.(jpg|svg)$/, '');
  const entry = manifest.dishes[slug] ?? manifest.covers[slug];

  if (!entry) {
    problems.push(`${ref} -> has no entry in images.json, so it gets no licence or credit`);
    continue;
  }

  const isPlaceholder = entry.placeholder === true;
  const refIsSvg = ref.endsWith('.svg');

  if (isPlaceholder && !refIsSvg) {
    problems.push(`${ref} -> manifest says "generated placeholder" but the seed points at a photo`);
  }
  if (!isPlaceholder && refIsSvg) {
    problems.push(`${ref} -> manifest has a real licensed photo but the seed points at a placeholder`);
  }
  if (entry.file && entry.file !== ref.replace(/^\//, '')) {
    problems.push(`${ref} -> manifest records a different file (${entry.file})`);
  }
}

/* Photos sitting on disk that nothing uses: dead weight in every deploy. */
const DISH_DIR = resolve(ROOT, 'public', 'dishes');
const orphans = (existsSync(DISH_DIR) ? readdirSync(DISH_DIR) : [])
  .filter((f) => /\.(jpg|svg|png|webp)$/i.test(f))
  .map((f) => `/dishes/${f}`)
  .filter((f) => !seen.has(f));

console.log(`seed image references : ${refs.length} (${seen.size} unique)`);
console.log(`manifest photos       : ${Object.entries({ ...manifest.dishes, ...manifest.covers }).filter(([, e]) => !e.placeholder).length}`);
console.log(`manifest placeholders : ${Object.entries({ ...manifest.dishes, ...manifest.covers }).filter(([, e]) => e.placeholder).length}`);
console.log(`own photographs       : ${Object.entries({ ...manifest.dishes, ...manifest.covers }).filter(([, e]) => e.own === true).length}`);
console.log(`orphaned files        : ${orphans.length}${orphans.length ? ` -> ${orphans.join(', ')}` : ''}`);

if (orphans.length) problems.push(`${orphans.length} file(s) in public/dishes are referenced by nothing`);

/* Licence coverage: nothing ships without a recorded licence. */
const unlicensed = Object.entries({ ...manifest.dishes, ...manifest.covers }).filter(
  ([, e]) => !e.placeholder && !e.own && !e.licence,
);
if (unlicensed.length) {
  problems.push(`${unlicensed.length} image(s) have no recorded licence: ${unlicensed.map(([s]) => s).join(', ')}`);
}

console.log('');
if (problems.length === 0) {
  console.log('OK - every seeded image resolves, matches the manifest, and carries a licence');
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
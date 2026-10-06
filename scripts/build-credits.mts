/**
 * Turns `emulator-data/images.json` into `src/data/credits.json`, which is
 * imported by the in-app credits page.
 *
 * Kept as a build-time step so the app needs no network call (and no server) to
 * show attribution, and so the data has exactly one source: the manifest the
 * fetch script produces.
 *
 *   run: npm run images:credits
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const manifest = JSON.parse(
  readFileSync(resolve(ROOT, 'emulator-data', 'images.json'), 'utf8'),
) as {
  dishes: Record<string, Record<string, unknown>>;
  covers: Record<string, Record<string, unknown>>;
};

const all = [...Object.entries(manifest.dishes), ...Object.entries(manifest.covers)];

/*
 * Photographs supplied through `drop-photos/` are the project's own and carry
 * no third-party licence. They are counted separately instead of being listed as
 * Creative Commons downloads: attributing someone else's licence to your own
 * photograph is wrong, and listing it among them would imply a source that does
 * not exist. Only `own` images are exempt - the fetcher never sets that flag.
 */
const own = all
  .filter(([, entry]) => entry['own'] === true)
  .map(([slug]) => slug)
  .sort((a, b) => a.localeCompare(b));

const credited = all.filter(([, entry]) => entry['own'] !== true);

const photos = credited
  .filter(([, entry]) => !entry['placeholder'])
  .map(([slug, entry]) => ({
    slug,
    title: entry['title'] as string | undefined,
    licence: entry['licence'] as string | undefined,
    author: entry['author'] as string | undefined,
    page: entry['page'] as string | undefined,
  }))
  .sort((a, b) => a.slug.localeCompare(b));

const placeholders = credited
  .filter(([, entry]) => entry['placeholder'])
  .map(([slug, entry]) => ({
    slug,
    label: (entry['label'] as string | undefined) ?? slug,
    placeholder: true,
  }))
  .sort((a, b) => a.slug.localeCompare(b));

const unlicensed = photos.filter((p) => !p.licence);

const out = resolve(ROOT, 'src', 'data', 'credits.json');
writeFileSync(out, `${JSON.stringify({ photos, placeholders, own }, null, 2)}\n`, 'utf8');

console.log(`wrote src/data/credits.json`);
console.log(`  photographs           : ${photos.length}`);
console.log(`  generated placeholders: ${placeholders.length}`);
console.log(`  own photographs       : ${own.length}${own.length ? ` (${own.join(', ')})` : ''}`);
console.log(`  missing a licence     : ${unlicensed.length}`);
if (unlicensed.length > 0) {
  console.log('\nthese would ship without attribution:');
  for (const p of unlicensed) console.log(`  ${p.slug}`);
  process.exitCode = 1;
}

/* ---------------------------- ATTRIBUTIONS.md ---------------------------- */

/*
 * Written here rather than in the fetcher so the markdown table and the in-app
 * credits page can never disagree: both are generated from the one manifest, in
 * the same pass. The fetcher no longer writes this file, or a re-run of
 * `npm run images` for a single dish would leave a file that has never heard of
 * a hand-picked photo.
 */
const listed = [
  ...(own.length > 0
    ? own.map((slug) => [slug, { file: `dishes/${slug}.jpg`, own: true } as Record<string, unknown>])
    : []),
  ...credited.map(([slug, entry]) => [slug, entry] as [string, Record<string, unknown>]),
];

const rows = listed
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([slug, entry]) => {
    if (entry['own'] === true) return `| \`${slug}\` | Project photograph | n/a - our own | Foodhut |`;
    const licence = String(entry['licence'] ?? 'UNKNOWN');
    const author = String(entry['author'] ?? 'Unknown');
    const title = String(entry['title'] ?? '').replace(/^File:/, '');
    const page = entry['page'] ? ` ([source](${entry['page']}))` : '';
    return `| \`${slug}\` | ${title}${page} | ${licence} | ${author} |`;
  });

const attribution = `# Image credits

Every photograph in \`public/dishes/\` is used under the licence listed below.

| Asset | Source | Licence | Author |
| ----- | ------ | ------- | ------ |
${rows.join('\n')}

## How these were obtained

* **\`.jpg\` photographs from Wikimedia Commons** are sourced by
  \`npm run images\`, which refuses any file whose licence it cannot confirm is
  free and refuses branded product photography outright. Only public-domain,
  CC0, CC BY and CC BY-SA are accepted; NC and ND variants are rejected.
* **Hand-picked photographs** were downloaded from Unsplash, whose licence
  permits free commercial use and does not require attribution. They are
  attributed anyway, because crediting a photographer costs nothing.
* Anything that could not be matched to the right dish is a **generated
  placeholder** produced by \`scripts/generate-image-placeholders.mts\` — a
  deliberately wrong-looking card is better than a plausible wrong photograph.

A licence check alone is not enough. Every image here is freely licensed, and
several were still wrong: a Big Mac photograph illustrated "Classic Smash
Burger", a photo of a Taiwanese street illustrated the Chinese restaurant, and an
orange mango smoothie illustrated a *green* juice. So the fetcher also checks
each photograph's subject, and \`npm run images:verify\` fails the build if any
image is missing, uncredited, or unreferenced.

Regenerate with:

\`\`\`
npm run images && npm run images:placeholder && npm run images:wire && npm run images:credits
\`\`\`
`;

writeFileSync(resolve(ROOT, 'ATTRIBUTIONS.md'), attribution, 'utf8');
console.log(`wrote ATTRIBUTIONS.md (${listed.length} photographs)`);
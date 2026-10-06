/**
 * Screenshots the exact card for a named dish, so a claim like "the biryani shows
 * North Indian food" can be checked against what is actually being served rather
 * than argued about.
 *
 *   playwright-cli run-code --filename=tests/e2e/shoot-dishes.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const targets = [
    { slug: 'saffron-junction', dish: 'Hyderabadi Dum Biryani', out: 'shots/d-biryani.png' },
    { slug: 'kadak-cafe', dish: 'Filter Coffee', out: 'shots/d-coffee.png' },
    { slug: 'truffle-affairs', dish: 'Chocolate Cherry Cake', out: 'shots/d-dessert.png' },
    { slug: 'kadak-cafe', dish: 'Masala Dosa', out: 'shots/d-dosa.png' },
  ];

  const done = [];

  for (const t of targets) {
    await page.goto(`${base}/restaurants/${t.slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('article h4', { timeout: 20000 });

    const card = page
      .locator('article')
      .filter({ has: page.locator(`h4:text-is("${t.dish}")`) })
      .first();

    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    await card.screenshot({ path: t.out });

    const photo = await card.locator('img').first().getAttribute('src');
    done.push({ dish: t.dish, restaurant: t.slug, photo, saved: t.out });
  }

  return JSON.stringify(done, null, 1);
}
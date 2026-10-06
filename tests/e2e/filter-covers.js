/**
 * Reproduces the exact report: with the Biryani filter on, does the Saffron
 * Junction card illustrate itself with biryani?
 *
 * Every card photograph is captured under each cuisine filter so a mismatch
 * between "what was asked for" and "what is shown" cannot pass unnoticed again.
 *
 *   playwright-cli run-code --filename=tests/e2e/filter-covers.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const WAIT = { waitUntil: 'domcontentloaded' };
  const out = [];

  // The complaint, verbatim: filter by Biryani.
  for (const cuisine of ['Biryani', 'Desserts', 'Salads', 'South Indian', 'Pizza']) {
    await page.goto(`${base}/?cuisine=${encodeURIComponent(cuisine)}`, WAIT);
    await page.waitForSelector('article h3', { timeout: 20000 });
    // Menus are fetched only while filtered, so give the swap time to land.
    await page.waitForTimeout(3000);

    const cards = await page.evaluate(() =>
      [...document.querySelectorAll('article')].map((li) => ({
        restaurant: li.querySelector('h3')?.textContent?.trim() ?? '',
        photo: (li.querySelector('img')?.getAttribute('src') ?? '').split('/').pop() ?? '',
      })),
    );

    out.push({ filter: cuisine, cards });
  }

  return JSON.stringify(out, null, 1);
}
/**
 * Reads the live Firestore data straight from the deployed app and prints the
 * image URL each dish actually points at.
 *
 * The files in public/dishes can all be correct while the database still points
 * somewhere else — that mismatch is what "the biryani shows a burger" would
 * actually mean, so it is checked at the source rather than by eye.
 *
 *   playwright-cli open https://foodhut-zomato-clone.web.app --browser=chrome
 *   playwright-cli run-code --filename=tests/e2e/probe-images.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article', { timeout: 20000 });

  /*
   * Walk each restaurant's menu page and pair the dish name shown on screen
   * with the image the browser actually requested for it. If the database is
   * correct this pairing will always agree.
   */
  const names = await page.locator('article h3').allTextContents();
  const report = [];

  for (const name of names) {
    const slug = await page.evaluate((n) => {
      const link = [...document.querySelectorAll('a')].find((a) =>
        a.textContent?.trim().startsWith(n),
      );
      return link?.getAttribute('href') ?? null;
    }, name);

    if (!slug) {
      report.push({ restaurant: name, error: 'no link found' });
      continue;
    }

    await page.goto(`${base}${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('article h4', { timeout: 20000 });
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(2200);

    const dishes = await page.locator('article').evaluateAll((els) =>
      els
        .map((el) => {
          const img = el.querySelector('img');
          const nameEl = el.querySelector('h4');
          if (!img || !nameEl) return null;
          return {
            dish: nameEl.textContent?.trim(),
            file: (img.getAttribute('src') ?? '').split('/').pop(),
            loaded: img.naturalWidth > 0,
          };
        })
        .filter(Boolean),
    );

    const cover = await page.evaluate(() => {
      const el = document.querySelector('img[src*="/dishes/"]');
      return el ? (el.getAttribute('src') ?? '').split('/').pop() : null;
    });

    report.push({ restaurant: name, cover, dishes });
  }

  return JSON.stringify(report, null, 1);
}
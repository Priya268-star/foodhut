/**
 * Pairs each dish's name with the photograph rendered next to it, in DOM order.
 *
 * A licence-clean, topically-correct photo is not the same as a photo attached to
 * the right dish: if the menu renders images from one collection and names from
 * another, every card shows its neighbour's picture while each individual image
 * is perfectly correct. Checking "does this photo look like biryani?" would never
 * catch that, because the biryani photo *is* a biryani photo - it is just on the
 * wrong card.
 *
 *   playwright-cli run-code --filename=tests/e2e/probe-menu-alignment.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const restaurants = [
    'truffle-affairs',
    'saffron-junction',
    'smoke-and-salt',
    'green-bowl',
    'wok-theory',
    'kadak-cafe',
  ];

  const report = {};
  for (const slug of restaurants) {
    await page.goto(`${base}/restaurants/${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('article h4', { timeout: 20000 });
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(2200);

    report[slug] = await page.evaluate(() =>
      [...document.querySelectorAll('article')].map((li) => {
        const name = li.querySelector('h4')?.textContent?.trim() ?? '(no name)';
        const img = li.querySelector('img');
        return {
          dish: name,
          photo: (img?.getAttribute('src') ?? '(none)').split('/').pop() ?? '(none)',
          loaded: img ? img.naturalWidth > 0 : false,
        };
      }),
    );
  }

  return JSON.stringify(report, null, 1);
}
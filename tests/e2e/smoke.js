/**
 * End-to-end smoke test against the deployed site, driven through Playwright.
 *
 * Covers every flow that does not need an authenticated session, because the
 * Firebase Auth providers are switched on by hand in the console:
 *   load, images, search, cuisine filter, price filter, sort, restaurant page,
 *   menu, add to cart, cart arithmetic, persistence across reload, route guards,
 *   credits page, 404, SPA deep-link refresh, mobile layout.
 *
 *   npm run test:e2e
 *
 * or, to drive an already-open browser:
 *
 *   playwright-cli run-code --filename=tests/e2e/smoke.js --raw
 *
 * Note on text: the rupee sign is matched as a regex escape rather than a
 * literal, because shell-based file editing kept mangling the UTF-8 sequence.
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const results = [];
  const problems = [];

  /*
   * Firestore keeps a WebSocket open, so 'networkidle' never fires on this app.
   * Every navigation waits on 'domcontentloaded' plus an explicit selector.
   */
  const WAIT = { waitUntil: 'domcontentloaded' };
  const RUPEE = /\u20B9/;

  const check = (name, pass, detail = '') => {
    results.push({ name, pass, detail });
    if (!pass) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
  };

  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 140)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 140)}`));

  /* ------------------------------- home load ------------------------------ */
  await page.goto(base, WAIT);
  await page.waitForSelector('article', { timeout: 20000 });

  const cards = await page.locator('article h3').allTextContents();
  check('home lists 6 restaurants', cards.length === 6, `got ${cards.length}: ${cards.join(', ')}`);

  /*
   * Restaurant cards are lazy-loaded, so the second row has not fetched until it
   * scrolls into view. Checking before scrolling reports those images as broken,
   * which is what happened here — three of six "failed" purely because the
   * browser had not asked for them yet.
   */
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(2600);

  const cardImages = await page.locator('article img').evaluateAll((els) =>
    els.map((e) => ({ ok: e.naturalWidth > 0, src: (e.getAttribute('src') ?? '').split('/').pop() })),
  );
  check(
    'all restaurant card images load',
    cardImages.length > 0 && cardImages.every((i) => i.ok),
    cardImages.filter((i) => !i.ok).map((i) => i.src).join(', '),
  );
  check(
    'no broken images',
    cardImages.every((i) => i.ok),
    `${cardImages.filter((i) => !i.ok).length} broken`,
  );

  /* --------------------------------- search -------------------------------- */
  await page.fill('#global-search', 'pizza');
  await page.waitForTimeout(1000);
  check('search syncs to URL', page.url().includes('q=pizza'), page.url());
  const searchHeading = (await page.locator('h2').first().textContent()) ?? '';
  check('search heading updates', /pizza/i.test(searchHeading), searchHeading);

  await page.fill('#global-search', '');
  await page.waitForTimeout(900);

  /* ------------------------------ cuisine filter --------------------------- */
  await page.locator('button[aria-pressed]', { hasText: 'Desserts' }).first().click();
  await page.waitForFunction(
    () => document.querySelectorAll('article h3').length > 0 || /no restaurants/i.test(document.body.innerText),
    undefined,
    { timeout: 25000 },
  );
  await page.waitForTimeout(800);
  const dessertCards = await page.locator('article h3').allTextContents();
  check(
    'cuisine filter narrows results',
    dessertCards.length > 0 && dessertCards.length < cards.length,
    `${dessertCards.length} results`,
  );
  check('cuisine filter in URL', page.url().includes('cuisine=Desserts'), page.url());

  await page.locator('button[aria-pressed]', { hasText: 'All' }).first().click();
  await page.waitForTimeout(1100);

  /* --------------------------------- price --------------------------------- */
  /*
   * Driven through the URL rather than the filter sheet: the sheet is
   * transient, and what matters is that the query behind it works.
   * The combined case is checked explicitly because "range filter + multi-field
   * sort" is the combination Firestore rejects, and it broke before.
   */
  await page.goto(`${base}/?price=2`, WAIT);
  await page.waitForSelector('article', { timeout: 20000 });
  await page.waitForTimeout(600);
  const cheap = await page.locator('article h3').allTextContents();
  check('price filter returns results', cheap.length > 0 && cheap.length <= 6, `${cheap.length} results`);

  await page.goto(`${base}/?price=2&sort=deliveryTime`, WAIT);
  await page.waitForSelector('article', { timeout: 20000 });
  await page.waitForTimeout(600);
  const comboCards = await page.locator('article h3').allTextContents();
  const comboAlerts = await page.locator('[role="alert"]').count();
  check(
    'price filter + sort combine',
    comboCards.length > 0 && comboAlerts === 0,
    `${comboCards.length} results, ${comboAlerts} alerts`,
  );

  await page.goto(base, WAIT);
  await page.waitForSelector('article');

  /* ---------------------------------- sort --------------------------------- */
  await page.selectOption('#sort-select', 'deliveryTime');
  await page.waitForTimeout(1400);
  const sorted = await page.locator('article h3').allTextContents();
  check('sort by delivery time works', sorted.length === 6, `${sorted.length} results`);
  await page.goto(base, WAIT);
  await page.waitForSelector('article');

  /* ---------------------------- restaurant + menu -------------------------- */
  await page.locator('article h3', { hasText: 'Truffle Affairs' }).click();
  await page.waitForURL('**/restaurants/**');
  await page.waitForSelector('article h4', { timeout: 20000 });

  const dishTitle = (await page.locator('h1').first().textContent()) ?? '';
  check('restaurant page loads', dishTitle.includes('Truffle Affairs'), dishTitle);

  const dishes = await page.locator('article h4').allTextContents();
  /*
   * Not a fixed count: Truffle Affairs gained a dish when a photograph arrived
   * that had no dish to sit on. Asserting "5" here would make adding a menu item
   * look like a regression.
   */
  check('menu shows dishes', dishes.length >= 5, `${dishes.length}: ${dishes.join(', ')}`);

  const prices = (await page.locator('article p').allTextContents()).filter((t) =>
    RUPEE.test(t),
  );
  check('every dish shows a price', prices.length === dishes.length, `${prices.length} of ${dishes.length}: ${prices.join(' ')}`);

  /*
   * Menu images use loading="lazy", so below-the-fold rows have not fetched
   * yet. Scrolling them into view is what a real visitor experiences; without
   * it this assertion fails for reasons unrelated to the app.
   */
  await page.evaluate(async () => {
    const step = 700;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(2600);
  const menuImages = await page.locator('article img').evaluateAll((els) =>
    els.map((e) => ({ ok: e.naturalWidth > 0, src: (e.getAttribute('src') ?? '').split('/').pop() })),
  );
  check(
    'menu images load',
    menuImages.length > 0 && menuImages.every((i) => i.ok),
    `${menuImages.filter((i) => i.ok).length}/${menuImages.length} — ${menuImages
      .filter((i) => !i.ok)
      .map((i) => i.src)
      .join(', ')}`,
  );

  /* --------------------------------- veg markers ---------------------------- */
  const veg = await page.locator('.diet-dot--veg').count();
  const nonVeg = await page.locator('.diet-dot--nonveg').count();
  check(
    'veg / non-veg markers render',
    veg + nonVeg === dishes.length,
    `${veg} veg, ${nonVeg} non-veg, ${dishes.length} dishes`,
  );

  /* -------------------------------- add to cart ---------------------------- */
  /*
   * Target by dish name, not button index: clicking "Add" replaces that button
   * with a stepper, so every index-based selector after the first click points
   * at a different element.
   */
  const dish = (name) =>
    page.locator('article').filter({ has: page.locator(`h4:text-is("${name}")`) });

  await dish('Truffle Mushroom Pizza').locator('button:has-text("Add")').click();
  await page.waitForTimeout(400);
  check(
    'add to cart shows stepper',
    (await dish('Truffle Mushroom Pizza').locator('[aria-label^="Increase quantity"]').count()) === 1,
  );

  await dish('Spicy Arrabbiata').locator('button:has-text("Add")').click();
  await page.waitForTimeout(500);

  const badge = (await page.locator('a[aria-label^="Cart"]').first().getAttribute('aria-label')) ?? '';
  check('header cart badge updates', /Cart, 2 items/.test(badge), badge);

  /* ---------------------------------- cart --------------------------------- */
  await page.locator('a[aria-label^="Cart"]').first().click();
  await page.waitForURL('**/cart');
  await page.waitForSelector('li h3', { timeout: 20000 });

  const cartLines = await page.locator('li h3').allTextContents();
  check('cart lists both dishes', cartLines.length === 2, cartLines.join(' | '));

  /*
   * Recompute the bill from the figures the cart itself displays rather than
   * hardcoding an expected total — the previous version guessed "2x one dish"
   * and reported a false failure when the basket held one of each.
   */
  const totals = (await page.locator('dl > div').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
  /*
   * Keeps the decimal point. Stripping it turned "₹48.90" into 489 and made the
   * bill look ten times too large - which only started happening once amounts
   * correctly began showing paise instead of being truncated to whole rupees.
   */
  const rupeesOf = (s) => Number((s ?? '').replace(/[^\d.]/g, ''));

  const perLine = await page
    .locator('li')
    .evaluateAll((els) =>
      els
        .map((li) =>
          [...li.querySelectorAll('p')]
            .map((p) => (p.textContent ?? '').trim())
            .filter((t) => /^[\u20B9]/.test(t))
            .pop(),
        )
        .filter(Boolean),
    );

  const subtotal = perLine.reduce((sum, t) => sum + rupeesOf(t), 0);
  const delivery = rupeesOf(totals.find((t) => t.includes('Delivery fee')));
  const taxShown = rupeesOf(totals.find((t) => t.includes('Taxes')));
  const payShown = rupeesOf(totals.find((t) => t.includes('To pay')));
  /* Tax is rounded to a whole rupee by `calculateTotals`, so ₹48.90 becomes ₹49. */
  const taxExpected = Math.round(subtotal * 0.05);

  check(
    'cart arithmetic is consistent',
    taxShown === taxExpected && payShown === subtotal + delivery + taxShown,
    `lines sum ${subtotal} + delivery ${delivery} + tax ${taxShown} = ${payShown}; expected tax ${taxExpected}`,
  );
  check('cart shows a checkout button', (await page.locator('button:has-text("Proceed to checkout")').count()) === 1);

  /* ------------------------------- persistence ----------------------------- */
  await page.reload(WAIT);
  await page.waitForSelector('li h3', { timeout: 20000 });
  const afterReload = await page.locator('li h3').allTextContents();
  check('cart survives reload', afterReload.length === 2, afterReload.join(' | '));

  /* ------------------------------ route guards ----------------------------- */
  for (const guarded of ['/checkout', '/orders', '/favourites', '/admin']) {
    await page.goto(base + guarded, WAIT);
    await page.waitForTimeout(2400);
    check(`${guarded} redirects to login when signed out`, page.url().includes('/login'), page.url());
  }

  /* --------------------------------- credits -------------------------------- */
  await page.goto(`${base}/credits`, WAIT);
  await page.waitForSelector('h1', { timeout: 20000 });
  const creditsHeading = (await page.locator('h1').first().textContent()) ?? '';
  check('credits page renders', /credits/i.test(creditsHeading), creditsHeading);

  const creditRows = await page.locator('li img').count();
  check('credits lists photographs', creditRows >= 25, `${creditRows} rows`);

  const licences = await page.locator('li p span').allTextContents();
  check(
    'every photo shows a licence',
    licences.length >= 25 && licences.every((t) => /CC0|CC BY|PD|Unsplash/i.test(t)),
    licences.slice(0, 4).join(', '),
  );

  /* ---------------------------------- 404 ---------------------------------- */
  await page.goto(`${base}/definitely-not-a-page`, WAIT);
  await page.waitForTimeout(900);
  const notFound = (await page.locator('h1').first().textContent()) ?? '';
  check('404 page renders', /404|couldn.t find/i.test(notFound), notFound);

  /* --------------------------- SPA deep-link refresh ----------------------- */
  await page.goto(`${base}/restaurants/saffron-junction`, WAIT);
  await page.reload(WAIT);
  await page.waitForSelector('article h4', { timeout: 20000 });
  const deepDishes = await page.locator('article h4').allTextContents();
  check('deep link survives refresh', deepDishes.length === 5, deepDishes.join(', '));

  /* --------------------------------- mobile -------------------------------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, WAIT);
  await page.waitForSelector('article', { timeout: 20000 });
  const mobileCards = await page.locator('article').count();
  check('mobile layout renders', mobileCards === 6, `${mobileCards} cards @390px`);
  await page.setViewportSize({ width: 1440, height: 900 });

  const failed = problems.length;
  return JSON.stringify(
    {
      total: results.length,
      failed: results.filter((r) => !r.pass).length,
      consoleAndPageErrors: [...new Set(problems)].filter((p) => p.startsWith('console') || p.startsWith('pageerror')),
      results,
    },
    null,
    1,
  );
}
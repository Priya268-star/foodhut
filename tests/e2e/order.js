/**
 * Full order journey, end to end, on the deployed site:
 *
 *   sign up -> add dishes -> cart -> checkout -> place order -> order history
 *
 * Every step asserts something real rather than just clicking through: the
 * order must land in Firestore and come back in the history list, otherwise
 * "placed successfully" would be a lie the UI tells before the write lands.
 *
 *   playwright-cli open https://foodhut-zomato-clone.web.app --browser=chrome
 *   playwright-cli run-code --filename=tests/e2e/order.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const WAIT = { waitUntil: 'domcontentloaded' };
  const out = [];
  const problems = [];
  const note = (k, v) => out.push({ [k]: v });
  const check = (k, pass, detail = '') => {
    out.push({ [k]: detail ? `${pass ? 'PASS' : 'FAIL'} — ${detail}` : pass ? 'PASS' : 'FAIL' });
    if (!pass) problems.push(`${k}${detail ? ` — ${detail}` : ''}`);
  };

  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));

  const email = `order.${Date.now()}@example.com`;
  const password = 'Foodhut@12345';
  note('test account', email);

  /* ------------------------------- 1. sign up ----------------------------- */
  await page.goto(`${base}/signup`, WAIT);
  await page.waitForSelector('input[name="email"]', { timeout: 20000 });

  await page.fill('input[name="name"]', 'Order Tester');
  await page.fill('input[type="email"]', email);
  const pwBoxes = page.locator('input[type="password"]');
  for (let i = 0; i < (await pwBoxes.count()); i += 1) await pwBoxes.nth(i).fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(7000);

  check('signup lands on the app', !page.url().includes('/signup'), page.url());

  /* ---------------------- 2. build a cart from a menu --------------------- */
  await page.goto(`${base}/restaurants/saffron-junction`, WAIT);
  await page.waitForSelector('article h4', { timeout: 20000 });

  const dishNames = await page.locator('article h4').allTextContents();
  note('dishes on menu', dishNames.join(', '));

  const dish = (name) =>
    page.locator('article').filter({ has: page.locator(`h4:text-is("${name}")`) });

  await dish(dishNames[0]).locator('button:has-text("Add")').click();
  await page.waitForTimeout(500);
  await dish(dishNames[1]).locator('button:has-text("Add")').click();
  await page.waitForTimeout(700);

  const badge = (await page.locator('a[aria-label^="Cart"]').first().getAttribute('aria-label')) ?? '';
  check('header badge shows 2 items', /2 items/.test(badge), badge);

  /* -------------------------------- 3. cart ------------------------------- */
  await page.goto(`${base}/cart`, WAIT);
  await page.waitForSelector('li h3', { timeout: 20000 });

  const cartLines = await page.locator('li h3').allTextContents();
  check('cart holds both dishes', cartLines.length === 2, cartLines.join(' | '));

  const totals = (await page.locator('dl > div').allTextContents()).map((t) =>
    t.replace(/\s+/g, ' ').trim(),
  );
  note('cart bill', totals.join(' / '));

  /* ------------------------------ 4. checkout ----------------------------- */
  await page.locator('button:has-text("Proceed to checkout")').click();
  await page.waitForTimeout(4000);
  check('checkout page reached', page.url().includes('/checkout'), page.url());

  /* Dump the form so a structural change is visible in the report. */
  const form = await page.evaluate(() => ({
    headings: [...document.querySelectorAll('h2, h3')].map((e) => e.textContent.trim()),
    buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean),
    fields: [...document.querySelectorAll('input, textarea, select')].map((i) => ({
      tag: i.tagName,
      name: i.name || '',
      type: i.type || '',
      placeholder: i.placeholder || '',
    })),
  }));
  note('checkout headings', form.headings.join(' | '));
  note('checkout fields', form.fields.map((f) => `${f.name || f.type}:${f.placeholder || ''}`).join(' | '));
  note('checkout buttons', form.buttons.join(' | '));

  /*
   * Addresses live in a subcollection, so a brand-new account has none and the
   * checkout form starts blank. Rather than typing into five required boxes, take
   * the shortcut the app offers - that path is also what a first-time customer
   * uses, so it is the one worth testing.
   */
  const sampleBtn = page.locator('button:has-text("Use sample address")');
  const hasSample = (await sampleBtn.count()) > 0;
  note('sample-address shortcut offered on first visit', hasSample);

  if (hasSample) {
    await sampleBtn.first().click();
    await page.waitForTimeout(900);
  }

  const addressValues = {
    'address.phone': '9876543210',
    'address.line1': 'Flat 402, Green Residency',
    'address.line2': 'Near MG Road',
    'address.city': 'Bengaluru',
    'address.postalCode': '560001',
  };

  // Only fill what the shortcut left empty, so the test still exercises manual
  // entry when the shortcut is not offered.
  for (const [name, value] of Object.entries(addressValues)) {
    const field = page.locator(`[name="${name}"]`);
    if ((await field.count()) === 0) continue;
    if ((await field.inputValue()) === '') await field.fill(value);
  }
  await page.waitForTimeout(600);

  const filled = await page.evaluate(() =>
    ['address.phone', 'address.line1', 'address.city', 'address.postalCode'].map((n) => {
      const el = document.querySelector(`[name="${n}"]`);
      return `${n}=${el ? JSON.stringify(el.value) : 'missing'}`;
    }),
  );
  note('address fields after filling', filled.join(' '));
  check(
    'address is complete',
    !filled.some((f) => /missing|""/.test(f)),
    filled.join(' '),
  );

  // The shortcut must get out of the way once the form has been filled.
  check(
    'sample-address shortcut hides once filled',
    (await page.locator('button:has-text("Use sample address")').count()) === 0,
  );

  const placeBtn = page
    .locator('button:has-text("Place order"), button:has-text("Pay"), button:has-text("Confirm")')
    .first();
  check('a place-order button exists', (await placeBtn.count()) > 0, await placeBtn.textContent().catch(() => ''));

  if ((await placeBtn.count()) > 0) {
    await placeBtn.click();
    await page.waitForTimeout(8000);
    note('after placing order, url', page.url());
    check('order redirects away from checkout', !page.url().includes('/checkout'), page.url());

    /* ------------------------- 5. it must persist ------------------------ */
    /*
     * Navigating re-mounts the app, which has to restore the Firebase session
     * before the signed-in UI and the orders query can run. Waiting a fixed 5s
     * read "Checking your session…" and failed a perfectly good order; wait for
     * the heading instead, then for the order list to arrive.
     */
    await page.goto(`${base}/orders`, WAIT);
    await page.waitForSelector('h1', { timeout: 20000 });
    await page.waitForFunction(
      () => !/Checking your session/i.test(document.body.innerText),
      undefined,
      { timeout: 25000 },
    );
    await page.waitForTimeout(2500);
    const orderText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

    const showsRestaurant = orderText.includes('Saffron Junction');
    check('order appears in history', showsRestaurant, orderText.slice(0, 220));

    const showsTotal = /To pay|Paid|Total|\u20B9/.test(orderText);
    check('order shows an amount', showsTotal);

    const notEmpty = !/no orders|nothing here|haven't ordered/i.test(orderText);
    check('orders page is not empty', notEmpty);
  }

  return JSON.stringify({ results: out, problems: [...new Set(problems)] }, null, 1);
}
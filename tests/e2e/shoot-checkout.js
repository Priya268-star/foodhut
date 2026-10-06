/**
 * Screenshots the checkout page for a brand-new account, so the sample-address
 * shortcut can be reviewed as it appears to a first-time customer.
 *
 *   playwright-cli run-code --filename=tests/e2e/shoot-checkout.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const WAIT = { waitUntil: 'domcontentloaded' };

  // Fresh account, so the address form is genuinely blank.
  await page.goto(`${base}/signup`, WAIT);
  await page.waitForSelector('input[name="email"]', { timeout: 20000 });
  await page.fill('input[name="name"]', 'Shopper');
  await page.fill('input[type="email"]', `shopper.${Date.now()}@example.com`);
  const boxes = page.locator('input[type="password"]');
  for (let i = 0; i < (await boxes.count()); i += 1) await boxes.nth(i).fill('Foodhut@12345');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(7000);

  // Build a cart so checkout has something to show.
  await page.goto(`${base}/restaurants/wok-theory`, WAIT);
  await page.waitForSelector('article h4', { timeout: 20000 });
  const dish = page.locator('article').filter({ has: page.locator('h4:text-is("Burnt Garlic Noodles")') });
  await dish.locator('button:has-text("Add")').click();
  await page.waitForTimeout(700);

  await page.goto(`${base}/checkout`, WAIT);
  await page.waitForSelector('[name="address.line1"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'shots/checkout-blank.png' });

  await page.locator('button:has-text("Use sample address")').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots/checkout-filled.png' });

  return JSON.stringify(
    {
      shortcutHiddenAfterFill:
        (await page.locator('button:has-text("Use sample address")').count()) === 0,
      line1: await page.locator('[name="address.line1"]').inputValue(),
      city: await page.locator('[name="address.city"]').inputValue(),
      postalCode: await page.locator('[name="address.postalCode"]').inputValue(),
    },
    null,
    1,
  );
}
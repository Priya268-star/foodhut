/**
 * Signs in as the administrator and captures the panel, so the account can be
 * reviewed rather than taken on trust.
 *
 *   playwright-cli run-code --filename=tests/e2e/shoot-admin.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const WAIT = { waitUntil: 'domcontentloaded' };

  await page.goto(`${base}/login`, WAIT);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', 'pri@doe.com');
  await page.fill('input[type="password"]', 'pri@doe');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(7000);

  await page.goto(`${base}/admin`, WAIT);
  await page.waitForSelector('h1', { timeout: 25000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'shots/admin-dashboard.png' });

  await page.goto(`${base}/admin/restaurants/saffron-junction/menu`, WAIT);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'shots/admin-menu.png' });

  await page.goto(`${base}/admin/restaurants/saffron-junction/orders`, WAIT);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'shots/admin-orders.png' });

  return 'captured';
}
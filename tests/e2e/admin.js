/**
 * Admin panel test for the seeded administrator account.
 *
 * Signs in with the real credentials, then walks the panel. Every screen is
 * checked for content rather than for a 200: an admin page that renders its
 * shell while every Firestore query fails permission looks identical to a working
 * one in a screenshot, so the assertions look for actual rows and headings.
 *
 *   playwright-cli run-code --filename=tests/e2e/admin.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const WAIT = { waitUntil: 'domcontentloaded' };
  const results = [];
  const problems = [];

  const check = (name, pass, detail = '') => {
    results.push({ [name]: detail ? `${pass ? 'PASS' : 'FAIL'} — ${detail}` : pass ? 'PASS' : 'FAIL' });
    if (!pass) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
  };

  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 140)}`));

  /* ------------------------------ 1. sign in ------------------------------- */
  await page.goto(`${base}/login`, WAIT);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  await page.fill('input[type="email"]', 'pri@doe.com');
  await page.fill('input[type="password"]', 'pri@doe');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(7000);

  const signedIn = !page.url().includes('/login');
  check('signs in with pri@doe.com', signedIn, page.url());

  /* --------------------------- 2. panel is reachable ------------------------ */
  await page.goto(`${base}/admin`, WAIT);
  await page.waitForSelector('h1', { timeout: 25000 });
  await page.waitForTimeout(3500);

  const dash = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    headings: [...document.querySelectorAll('h2, h3')].map((h) => h.textContent?.trim()),
    restaurants: [...document.querySelectorAll('article, li, tr')].length,
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
  }));

  check('/admin opens for the admin account', !/not found|error/i.test(dash.body), dash.h1);
  check('dashboard lists restaurants', dash.restaurants > 0, `${dash.restaurants} rows; headings: ${dash.headings.slice(0, 6).join(' | ')}`);
  check('dashboard is not an error page', !/permission|insufficient|denied/i.test(dash.body), dash.body.slice(0, 120));

  /* --------------------------- 3. restaurant names ------------------------- */
  const restaurantNames = await page.evaluate(() =>
    [...document.querySelectorAll('article h3, li h3, h3')].map((h) => h.textContent?.trim()).filter(Boolean),
  );
  check(
    'the six seeded restaurants are listed',
    ['Truffle Affairs', 'Saffron Junction', 'Smoke & Salt', 'Green Bowl', 'Wok Theory', 'Kadak Cafe'].every(
      (name) => restaurantNames.some((n) => n?.includes(name)),
    ),
    restaurantNames.slice(0, 8).join(' | '),
  );

  /* ------------------------------- 4. menu --------------------------------- */
  await page.goto(`${base}/admin/restaurants/truffle-affairs/menu`, WAIT);
  await page.waitForTimeout(4000);
  const menu = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  check(
    'menu manager shows dishes',
    /Chocolate Cherry Cake|Strawberry Sundae/.test(menu),
    menu.slice(0, 160),
  );

  /* ------------------------------- 5. orders ------------------------------- */
  await page.goto(`${base}/admin/restaurants/saffron-junction/orders`, WAIT);
  await page.waitForTimeout(4000);
  const orders = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  check('order manager renders', orders.length > 40, orders.slice(0, 160));
  check('order manager is not a permission error', !/permission|insufficient|denied/i.test(orders));

  /* ---------------------------- 6. new restaurant --------------------------- */
  await page.goto(`${base}/admin/new`, WAIT);
  await page.waitForSelector('h1', { timeout: 20000 });
  const form = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    inputs: document.querySelectorAll('input, textarea, select').length,
  }));
  check('new-restaurant form renders', form.inputs >= 5, `${form.inputs} fields; ${form.h1}`);

  /* ---------------------------- 7. session survives ------------------------- */
  await page.goto(`${base}/orders`, WAIT);
  await page.waitForSelector('h1', { timeout: 20000 });
  await page.waitForTimeout(2500);
  check('admin session survives navigation', !page.url().includes('/login'), page.url());

  return JSON.stringify({ results, problems: [...new Set(problems)] }, null, 1);
}
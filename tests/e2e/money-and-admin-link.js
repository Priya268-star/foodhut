/**
 * Checks the two most recent changes on the live site:
 *
 *   1. Money is always whole rupees - no "₹1,234.5" anywhere a customer reads.
 *   2. The admin shortcut is on the homepage, and only for admin accounts.
 *
 *   playwright-cli run-code --filename=tests/e2e/money-and-admin-link.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const WAIT = { waitUntil: 'domcontentloaded' };
  const results = [];
  const problems = [];

  const check = (name, pass, detail = '') => {
    results.push({ [name]: detail ? `${pass ? 'PASS' : 'FAIL'} — ${detail}` : pass ? 'PASS' : 'FAIL' });
    if (!pass) problems.push(name);
  };

  /** Every rupee figure on the page, e.g. "₹1,234.5" */
  const moneyOnPage = () =>
    page.evaluate(() => {
      const found = new Set();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walk.nextNode())) {
        for (const m of node.nodeValue.matchAll(/₹[\d,]+(?:\.\d+)?/g)) found.add(m[0]);
      }
      return [...found];
    });

  const hasFraction = (list) => list.filter((s) => /\.\d/.test(s));

  /* ------------------- 1. signed out: no admin link, money clean ------------------- */
  await page.goto(base, WAIT);
  await page.waitForSelector('article', { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(2000);

  const homeMoney = await moneyOnPage();
  check('home page shows no fractional rupees', hasFraction(homeMoney).length === 0, hasFraction(homeMoney).join(', ') || `${homeMoney.length} whole figures`);
  check('admin shortcut hidden for signed-out visitors', (await page.locator('a:has-text("Open admin panel")').count()) === 0);

  /* ------------------------------ 2. cart totals ------------------------------- */
  /*
 * Truffle Affairs, not Kadak Cafe: Kadak Cafe is seeded closed, and a closed
 * restaurant renders no "Add" buttons at all, so the click simply times out.
 */
  await page.goto(`${base}/restaurants/truffle-affairs`, WAIT);
  await page.waitForSelector('article h4', { timeout: 20000 });

  const dishNames = await page.locator('article h4').allTextContents();
  // Target by name: clicking "Add" turns the button into a quantity stepper, so
  // any index-based selector after the first click points at a different element.
  for (const name of [dishNames[0], dishNames[2]]) {
    await page
      .locator('article')
      .filter({ has: page.locator(`h4:text-is("${name}")`) })
      .locator('button:has-text("Add")')
      .click();
    await page.waitForTimeout(600);
  }

  await page.goto(`${base}/cart`, WAIT);
  await page.waitForSelector('li h3', { timeout: 20000 });
  const cartMoney = await moneyOnPage();
  check('cart shows no fractional rupees', hasFraction(cartMoney).length === 0, hasFraction(cartMoney).join(', ') || cartMoney.join(' '));

  const totals = await page.locator('dl > div').allTextContents();
  const rupees = (s) => Number((s ?? '').replace(/[^\d]/g, ''));
  const subtotal = rupees(totals.find((t) => t.includes('Item total')));
  const delivery = rupees(totals.find((t) => t.includes('Delivery fee')));
  const tax = rupees(totals.find((t) => t.includes('Taxes')));
  const pay = rupees(totals.find((t) => t.includes('To pay')));
  check(
    'stored total equals displayed total',
    subtotal + delivery + tax === pay,
    `${subtotal} + ${delivery} + ${tax} = ${pay}`,
  );

  /* ---------------------------- 3. admin sees it ------------------------------- */
  await page.goto(`${base}/login`, WAIT);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', 'pri@doe.com');
  await page.fill('input[type="password"]', 'pri@doe');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(7000);

  await page.goto(base, WAIT);
  await page.waitForSelector('article', { timeout: 25000 });
  await page.waitForTimeout(1500);

  const shortcut = page.locator('a:has-text("Open admin panel")');
  check('admin shortcut appears for the admin', (await shortcut.count()) === 1);
  if ((await shortcut.count()) === 1) {
    await shortcut.click();
    await page.waitForURL('**/admin', { timeout: 20000 });
    await page.waitForSelector('h1', { timeout: 25000 });
    await page.waitForTimeout(3000);
    const rows = await page.locator('article, li, tr').count();
    check('shortcut navigates to a working admin panel', rows > 0, `${rows} rows at ${page.url()}`);
  }

  const footerLink = await page.locator('footer a:has-text("Admin dashboard")').count();
  check('footer link is labelled for admins', footerLink > 0);

  await page.screenshot({ path: 'shots/admin-shortcut.png' });

  return JSON.stringify({ results, problems }, null, 1);
}
/**
 * Verifies that authentication actually works in the deployed app, and that
 * the Google provider is wired up.
 *
 * The Identity Toolkit config API is not readable with the CLI's OAuth token,
 * so provider state is checked the only way that actually proves anything:
 * by signing a real account into the live site and pressing the Google button.
 *
 *   playwright-cli open https://foodhut-zomato-clone.web.app --browser=chrome
 *   playwright-cli run-code --filename=tests/e2e/auth.js --raw
 */
async (page) => {
  const base = 'https://foodhut-zomato-clone.web.app';
  const WAIT = { waitUntil: 'domcontentloaded' };
  const out = [];
  const note = (k, v) => out.push({ [k]: v });

  /* A throwaway address; nothing real is sent to the restaurant. */
  const email = `e2e.${Date.now()}@example.com`;
  const password = 'Foodhut@12345';

  /* ------------------------------ 1. sign up ------------------------------ */
  await page.goto(`${base}/signup`, WAIT);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  const heading = (await page.locator('h1').first().textContent()) ?? '';
  note('signup page heading', heading.trim());

  await page.fill('input[name="name"]', 'E2E Tester');
  await page.fill('input[type="email"]', email);

  /*
   * Fill every password box rather than naming one: the form has both a
   * password and a confirm-password field, and filling only the first fails
   * with "Please confirm your password" instead of submitting.
   */
  const passwordBoxes = page.locator('input[type="password"]');
  const boxCount = await passwordBoxes.count();
  for (let i = 0; i < boxCount; i += 1) await passwordBoxes.nth(i).fill(password);
  note('password fields filled', boxCount);

  await page.locator('button[type="submit"]').click();

  /* A real account lands on the app, not on an error banner. */
  await page.waitForTimeout(7000);
  note('after signup, url', page.url());

  /* Surface any field-level validation text, which a generic regex misses. */
  const invalid = await page
    .locator('[role="alert"], [aria-live], .field-error, p.text-red-500, p.text-red-600')
    .allTextContents();
  note('validation / error messages', invalid.map((t) => t.trim()).filter(Boolean).join(' | ') || 'none');

  const signedIn = await page
    .locator('a[aria-label*="Account"], a[href="/profile"], button[aria-label*="Account"]')
    .count();
  note('account control visible (signed in)', signedIn > 0);

  const bodyText = (await page.locator('body').innerText()).slice(0, 400);
  note(
    'no auth error on screen',
    !/CONFIGURATION_NOT_FOUND|auth\/operation-not-allowed|invalid login|error/i.test(bodyText),
    bodyText.replace(/\s+/g, ' ').slice(0, 160),
  );

  note('test account used', email);

  /* --------------------- 2. session survives a reload --------------------- */
  await page.reload(WAIT);
  await page.waitForTimeout(4000);
  note('still signed in after reload', (await page.locator('a[href="/profile"]').count()) > 0);
  note('url after reload', page.url());

  /* -------------------------- 3. guarded routes --------------------------- */
  /* Signed in, these must NOT bounce to /login. That is the real guard test. */
  for (const path of ['/orders', '/favourites', '/checkout']) {
    await page.goto(base + path, WAIT);
    await page.waitForTimeout(3500);
    note(`${path} reachable while signed in`, !page.url().includes('/login'), page.url());
  }

  /* ---------------------------- 4. Google button -------------------------- */
  await page.goto(`${base}/login`, WAIT);
  await page.waitForTimeout(2500);

  const googleBtn = page.locator('button:has-text("Google")').first();
  note('Google button exists on login page', (await googleBtn.count()) > 0);

  if ((await googleBtn.count()) > 0) {
    const before = page.context().pages().length;
    await googleBtn.click();
    await page.waitForTimeout(5000);

    const pages = page.context().pages();
    const popup = pages[pages.length - 1];
    const popupUrl = popup.url();

    /*
     * Enabled provider -> Google account chooser opens (popup or redirect).
     * Disabled provider  -> Firebase raises auth/operation-not-allowed and the
     *                       button just sits there doing nothing.
     */
    const reachedGoogle =
      /accounts\.google\.com|firebaseapp\.com\/__\/auth\/handler/.test(popupUrl);
    note('Google provider responds (chooser opened)', reachedGoogle, popupUrl.slice(0, 120));
    note('popup count before/after', `${before}/${pages.length}`);

    for (const extra of pages.slice(1)) await extra.close().catch(() => {});
    note('closed popups', pages.length - 1);
  }

  return JSON.stringify(out, null, 1);
}
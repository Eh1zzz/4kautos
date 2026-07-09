import { test, expect } from '@playwright/test';

/* Critical-path smoke tests. Each is independent and lenient (counts > 0, not
   exact) so seed changes don't break them. They guard against the class of
   silent frontend breakage that unit tests can't see (CSP blocks, a bad
   selector, a broken script bundle, a dead click handler). */

const SEED_BUYER = { email: 'buyer@4kautos.com', password: 'password123' };

test('home renders: hero, car cards, trust strip', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/index.html');
  await expect(page.locator('.hero-title')).toBeVisible();
  await expect(page.locator('.trust-strip')).toBeVisible();
  await expect(page.locator('.car-card').first()).toBeVisible();
  expect(errors, `page errors: ${errors.join('; ')}`).toHaveLength(0);
});

test('clicking a car card opens its detail page (customs box included)', async ({ page }) => {
  await page.goto('/listings.html');
  await expect(page.locator('.car-card').first()).toBeVisible();
  await page.locator('.car-card').first().click();
  await expect(page).toHaveURL(/detail\.html\?id=\d+/);
  await expect(page.locator('#d-title')).not.toHaveText(/^Loading/);
  // Landed/customs box renders for priced cars (async; allow it to populate).
  await expect(page.locator('#landed-box')).toBeVisible();
});

test('listings filter produces a removable chip and results', async ({ page }) => {
  await page.goto('/listings.html?type=SUV');
  const chip = page.locator('#filter-chips .f-chip').first();
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('SUV');
  // Results grid rendered (or the empty-state recommendations — either is "not broken").
  await expect(page.locator('.car-card').first()).toBeVisible();
});

test('save/heart toggles and persists to localStorage', async ({ page }) => {
  await page.goto('/listings.html');
  const heart = page.locator('.car-card .card-saves').first();
  await expect(heart).toBeVisible();
  await heart.click();
  await expect(heart).toHaveClass(/saved/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('4k_saved') || '[]'));
  expect(saved.length).toBeGreaterThan(0);
});

test('buyer can log in and the nav reflects the session', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#nav-login-btn').click();
  await expect(page.locator('#auth-modal')).toHaveClass(/open/);
  await page.locator('#login-email').fill(SEED_BUYER.email);
  await page.locator('#login-password').fill(SEED_BUYER.password);
  await page.locator('#login-btn').click();
  // On success the app stores the session and reloads; the profile button appears.
  await expect(page.locator('#nav-profile-btn')).toBeVisible({ timeout: 12_000 });
  const user = await page.evaluate(() => JSON.parse(localStorage.getItem('4k_user') || 'null'));
  expect(user?.role).toBe('buyer');
});

test('seller profile page renders from a listing', async ({ page }) => {
  await page.goto('/listings.html');
  await page.locator('.car-card').first().click();
  await expect(page).toHaveURL(/detail\.html/);
  // The detail sidebar shifts as async content (customs, valuation, similar)
  // populates, so navigate via the link's href rather than clicking a moving
  // target — this still verifies the link is wired to a real seller id and that
  // the destination profile renders.
  const sellerLink = page.locator('#seller-name a.seller-link');
  await expect(sellerLink).toBeVisible();
  const href = await sellerLink.getAttribute('href');
  expect(href).toMatch(/seller\.html\?id=\d+/);
  await page.goto('/' + href);
  await expect(page.locator('#s-name')).not.toHaveText('—');
  await expect(page.locator('#seller-grid .car-card').first()).toBeVisible();
});

test('clearance estimator returns duty figures', async ({ page }) => {
  await page.goto('/clearance.html?cif=15000&cur=USD');
  await page.locator('#estimate-btn').click();
  await expect(page.locator('#duty-grid .duty-row').first()).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('#agents-list .agent-card').first()).toBeVisible();
});

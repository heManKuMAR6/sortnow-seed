import {test, expect} from './fixtures.mjs';

const URL = 'http://127.0.0.1:4185/';
const hero = page => page.locator('.hero');
const status = page => page.getByRole('status');
const parts = page => page.locator('[data-seed-part]');
const overlay = page => page.locator('[data-seed-overlay]');
const go = async (page, date) => { await page.locator(`[data-date="${date}"]`).click(); };
const approve = (page, name) => page.getByRole('button', {name: `Approve ${name}`}).click();

test.beforeEach(async ({page}) => { await page.goto(URL); await expect(status(page)).toHaveText('Showing the base site'); });

test('drafts never render; approval shows the full Christmas design and the flyby', async ({page}) => {
  await go(page, '2026-12-12');
  await expect(parts(page)).toHaveCount(0);
  await approve(page, 'Christmas');
  await expect(status(page)).toHaveText('Showing Christmas (approved)');
  await expect(hero(page)).toHaveAttribute('data-seed-experience', 'christmas-2026');
  await expect(page.locator('[data-seed-part="banner"]')).toContainText('Happy holidays from all of us.');
  await expect(page.locator('[data-seed-part="illustration"] svg')).toBeVisible();
  await expect(page.locator('[data-seed-part="decoration"] svg')).toBeVisible();
  await expect(overlay(page)).toHaveAttribute('data-seed-overlay', 'flyby');
  await expect(overlay(page)).toHaveCSS('pointer-events', 'none');
  // The page stays usable during the effect.
  await page.getByRole('button', {name: 'Add to cart'}).first().click({timeout: 1000});
  await expect(overlay(page)).toHaveCount(0, {timeout: 8000});
});

test('the effect plays once per visit, then only the static design remains', async ({page}) => {
  await go(page, '2026-12-12');
  await approve(page, 'Christmas');
  await expect(overlay(page)).toHaveCount(1);
  await expect(overlay(page)).toHaveCount(0, {timeout: 8000});
  await page.reload();
  await go(page, '2026-12-12');
  await approve(page, 'Christmas');
  await expect(hero(page)).toHaveAttribute('data-seed-experience', 'christmas-2026');
  await page.waitForTimeout(300);
  await expect(overlay(page)).toHaveCount(0);
});

test('reduced motion gets no animation but keeps the artwork', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await go(page, '2026-12-12');
  await approve(page, 'Christmas');
  await expect(page.locator('[data-seed-part="illustration"]')).toHaveCount(1);
  await page.waitForTimeout(300);
  await expect(overlay(page)).toHaveCount(0);
});

test('Black Friday and Christmas never mix, and expiry restores the exact base page', async ({page}) => {
  const before = await hero(page).evaluate(el => el.outerHTML);
  const banner = await page.locator('.announce').evaluate(el => el.outerHTML);
  // Approve while neither is active, so each effect first plays on its own date.
  await go(page, '2026-11-07');
  await approve(page, 'Black Friday');
  await approve(page, 'Christmas');
  await go(page, '2026-11-28');
  await expect(hero(page)).toHaveAttribute('data-seed-experience', 'black-friday-2026');
  await expect(overlay(page)).toHaveAttribute('data-seed-overlay', 'particles');
  await go(page, '2026-12-12');
  await expect(hero(page)).toHaveAttribute('data-seed-experience', 'christmas-2026');
  await expect(page.locator('[data-seed-experience="black-friday-2026"]')).toHaveCount(0);
  // At most one effect per visit: the confetti already played, so Christmas stays static in this visit.
  await page.waitForTimeout(300);
  await expect(overlay(page)).toHaveCount(0);
  await expect(page.locator('[data-seed-part="illustration"]')).toHaveCount(1);
  await go(page, '2026-12-27');
  await expect(status(page)).toHaveText('Showing the base site');
  await expect(parts(page)).toHaveCount(0);
  await expect(overlay(page)).toHaveCount(0);
  expect(await hero(page).evaluate(el => el.outerHTML)).toBe(before);
  expect(await page.locator('.announce').evaluate(el => el.outerHTML)).toBe(banner);
});

test('revoking returns to the base site immediately', async ({page}) => {
  await go(page, '2026-12-12');
  await approve(page, 'Christmas');
  await expect(hero(page)).toHaveAttribute('data-seed-experience', 'christmas-2026');
  await page.getByRole('button', {name: 'Revoke Christmas'}).click();
  await expect(parts(page)).toHaveCount(0);
  await expect(overlay(page)).toHaveCount(0);
});

test('expiry never overwrites style changes the host made after SEED activated', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await go(page, '2026-12-12');
  await approve(page, 'Christmas');
  await expect(hero(page)).toHaveAttribute('data-seed-experience', 'christmas-2026');
  await hero(page).evaluate(el => { el.style.backgroundColor = 'rgb(1, 2, 3)'; el.style.outline = '2px solid red'; });
  await go(page, '2026-12-27');
  await expect(parts(page)).toHaveCount(0);
  await expect(hero(page)).not.toHaveAttribute('data-seed-experience');
  await expect(hero(page)).toHaveCSS('background-color', 'rgb(1, 2, 3)');
  await expect(hero(page)).toHaveCSS('outline-style', 'solid');
  expect(await hero(page).evaluate(el => el.style.getPropertyValue('--seed-accent'))).toBe('');
});

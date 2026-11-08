import {test, expect} from './fixtures.mjs';

const URL = 'http://127.0.0.1:4186/';
const root = page => page.locator('seed-root');
const parts = page => page.locator('[data-seed-part]');
const at = (page, name) => page.locator('.demo').getByRole('button', {name, exact: true}).click();

test('one script tag themes a framework-free page, and dates switch designs', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(URL);
  await expect(root(page)).toHaveAttribute('data-state', 'active');
  expect(await page.evaluate(() => typeof window.React)).toBe('undefined');
  await expect(page.locator('[data-seed-part="banner"]')).toContainText('Order your Christmas bake by December 20.');
  await expect(page.locator('.hero [data-seed-part="illustration"] svg')).toBeVisible();
  await at(page, 'Black Friday');
  await expect(page.locator('.hero')).toHaveAttribute('data-seed-experience', 'black-friday-20261127-america-chicago');
  await at(page, 'Today');
  await expect(root(page)).toHaveAttribute('data-state', 'base');
  await expect(parts(page)).toHaveCount(0);
});

test('slots that appear later are decorated, including the seed-area wrapper', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(URL);
  await expect(root(page)).toHaveAttribute('data-state', 'active');
  await page.evaluate(() => {
    const route = document.createElement('div');
    route.innerHTML = '<div id="late" data-seed-slot="banner"></div><seed-area id="wrapped" slots="banner"><p>Existing</p></seed-area>';
    document.querySelector('main').append(route);
  });
  await expect(page.locator('#late [data-seed-part="banner"]')).toHaveCount(1);
  await expect(page.locator('#wrapped [data-seed-part="banner"]')).toHaveCount(1);
  await expect(page.locator('#wrapped p')).toHaveText('Existing');
});

test('broken configuration fails closed and the base site stays', async ({page}) => {
  await page.route('**/seed/approvals.json', route => route.fulfill({contentType: 'application/json', body: '{"approved": true}'}));
  await page.goto(URL);
  await expect(root(page)).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#state')).toContainText('SEED error');
  await expect(parts(page)).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Bread worth waking up for.');
});

test('without a valid brand policy nothing renders', async ({page}) => {
  await page.route('**/seed/brand.json', route => route.fulfill({contentType: 'application/json', body: '{"effects": "on"}'}));
  await page.goto(URL);
  await expect(root(page)).toHaveAttribute('data-state', 'error');
  await expect(parts(page)).toHaveCount(0);
});

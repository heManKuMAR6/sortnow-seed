import {test, expect} from './fixtures.mjs';

const URL = 'http://127.0.0.1:4184/';
const BASE_LINK = 'rgb(127, 209, 199)';
const LAUNCH_LINK = 'rgb(183, 196, 255)';
const area = (page, name) => page.locator(`[data-seed-area="${name}"]`);
const expectBase = async page => {
  await expect(area(page, 'hero')).not.toHaveAttribute('data-seed-experience');
  await expect(page.locator('.masthead a')).toHaveCSS('color', BASE_LINK);
};
const expectLaunch = async page => {
  await expect(area(page, 'hero')).toHaveAttribute('data-seed-experience', 'launch-week');
  await expect(page.locator('.masthead a')).toHaveCSS('color', LAUNCH_LINK);
};
// Neither of these may ever render: one is vetoed by brand policy, the other was never reviewed.
const expectNothingUnapproved = async page => {
  await expect(area(page, 'banner')).toBeEmpty();
  await expect(page.locator('[data-seed-experience="approved-banner"], [data-seed-experience="unreviewed-draft"]')).toHaveCount(0);
};

test('server HTML is base content and hydrates into a working page', async ({page, request}) => {
  const html = await (await request.get(URL)).text();
  expect(html).toContain('Reconcile every account');
  expect(html).not.toContain('data-seed-experience');
  expect(html).not.toContain('--seed-');
  await page.goto(URL);
  // Only a hydrated page responds to this click. The fixture fails the test on any hydration error.
  const during = page.getByRole('button', {name: 'During launch'});
  await during.click();
  await expect(during).toHaveAttribute('aria-pressed', 'true');
  await expectLaunch(page);
  await expectNothingUnapproved(page);
});

test('the live clock activates and expires an approved experience', async ({page}) => {
  await page.clock.install({time: new Date('2027-03-07T23:59:00.000Z')});
  await page.goto(URL);
  await expect(page.getByRole('button', {name: 'During launch'})).toBeVisible();
  await expectBase(page);
  await page.clock.fastForward('02:00');
  await expectLaunch(page);
  await expectNothingUnapproved(page);
  await page.clock.fastForward(7 * 24 * 60 * 60 * 1000); // Past the exclusive end at 2027-03-15T00:00:00.000Z.
  await expectBase(page);
});

test('styling stays inside the area in every state', async ({page}) => {
  await page.goto(URL);
  const plans = page.locator('.plans');
  const before = await plans.innerHTML();
  const cell = page.locator('.plans td').first();
  const color = await cell.evaluate(el => getComputedStyle(el).color);
  for (const name of ['During launch', 'After launch', 'Live clock']) {
    await page.getByRole('button', {name}).click();
    expect(await plans.innerHTML()).toBe(before);
    await expect(cell).toHaveCSS('color', color);
  }
});

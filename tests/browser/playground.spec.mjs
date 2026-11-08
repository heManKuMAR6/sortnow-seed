import {test, expect} from './fixtures.mjs';

const control = (page, name) => page.locator('aside label').filter({hasText: name}).locator('select, input');
const hero = (page, pane) => page.getByRole('region', {name: pane}).locator('[data-seed-area="hero"]');
const proposed = page => hero(page, 'Experience preview');
const original = page => hero(page, 'Original website');
const status = page => page.getByRole('status');
const approve = page => page.getByRole('button', {name: 'Approve this exact version'}).click();
const showApprovedSchedule = page => control(page, 'Right-hand preview').selectOption('approved');
const ACTIVE = 'winter-season-20261201-utc';
const expectBase = async locator => expect(locator).not.toHaveAttribute('data-seed-experience');

test.beforeEach(async ({page}) => {
  await page.goto('http://127.0.0.1:4183/');
  await expect(status(page)).toContainText('draft');
});

test('a draft preview never counts as approval', async ({page}) => {
  await expect(proposed(page)).toHaveAttribute('data-seed-experience', ACTIVE);
  await expectBase(original(page));
  await showApprovedSchedule(page);
  await expectBase(proposed(page));
  await expect(status(page)).toContainText('draft');
});

test('approving activates the schedule and leaves the original untouched', async ({page}) => {
  await approve(page);
  await expect(status(page)).toContainText('approved');
  await expect(proposed(page)).toHaveAttribute('data-seed-experience', ACTIVE);
  await expect(proposed(page).locator('.hero')).toHaveCSS('background-color', 'rgb(231, 238, 228)');
  await expectBase(original(page));
  await expect(original(page).locator('.hero')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('any edit invalidates approval until the exact version returns', async ({page}) => {
  const message = control(page, 'Message');
  const text = await message.inputValue();
  await approve(page);
  await message.fill(`${text} Edited.`);
  await expect(status(page)).toContainText('draft');
  await expectBase(proposed(page));
  await message.fill(text);
  await expect(status(page)).toContainText('approved');
  await expect(proposed(page)).toHaveAttribute('data-seed-experience', ACTIVE);
  await control(page, 'Experience').selectOption('launch');
  await expect(status(page)).toContainText('draft');
  await expectBase(proposed(page));
});

test('an approved experience only shows inside its schedule', async ({page}) => {
  const date = control(page, 'Preview date');
  await approve(page);
  await date.fill('2026-11-30');
  await expectBase(proposed(page));
  await date.fill('2026-12-31');
  await expect(proposed(page)).toHaveAttribute('data-seed-experience', ACTIVE);
  await date.fill('2027-01-01');
  await expectBase(proposed(page));
  await expect(proposed(page).locator('.hero')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(status(page)).toContainText('approved');
});

test('revoking restores the base appearance', async ({page}) => {
  await approve(page);
  await expect(proposed(page)).toHaveAttribute('data-seed-experience', ACTIVE);
  await page.getByRole('button', {name: 'Revoke approval'}).click();
  await expect(status(page)).toContainText('draft');
  await expectBase(proposed(page));
  await expect(proposed(page).locator('.hero')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('choosing a theme pack previews artwork, needs approval, and leaves the original untouched', async ({page}) => {
  await page.locator('aside select').first().selectOption('christmas'); // the Event picker
  await expect(control(page, 'Theme pack')).toHaveValue('christmas');
  const preview = page.getByRole('region', {name: 'Experience preview'});
  const originalPane = page.getByRole('region', {name: 'Original website'});
  await expect(preview.locator('[data-seed-part="illustration"] svg')).toBeVisible();
  await expect(status(page)).toContainText('draft');
  await approve(page);
  await expect(status(page)).toContainText('approved');
  await expect(preview.locator('[data-seed-part="banner"]')).toContainText('Wishing you a warm and joyful holiday season.');
  await expect(preview.locator('[data-seed-part="decoration"]')).toHaveCount(1);
  await expect(originalPane.locator('[data-seed-part]')).toHaveCount(0);
  await control(page, 'Hero illustration').selectOption('gift-stack');
  await expect(status(page)).toContainText('draft');
  await expect(page.getByRole('button', {name: 'Download draft bundle'})).toBeEnabled();
});

test('plan by market lists upcoming occasions, loads one into the editor, and downloads a bundle', async ({page}) => {
  const planner = page.locator('.planner');
  await expect(planner.getByRole('list', {name: 'Upcoming occasions'})).toHaveCount(0);
  await planner.getByLabel('India').check();
  await planner.locator('input[type="date"]').fill('2026-11-08');
  await expect(planner.getByText('Republic Day (India)')).toBeVisible();
  await expect(planner.getByText('Thanksgiving (US)')).toHaveCount(0);
  await expect(planner.getByRole('checkbox', {name: /Include/}).first()).not.toBeChecked();
  await planner.getByRole('button', {name: 'Edit Republic Day (India)'}).click();
  await expect(control(page, 'Theme pack')).toHaveValue('celebration');
  await expect(control(page, 'First day')).toHaveValue('2027-01-26');
  await planner.getByLabel('Include Republic Day (India)').check();
  await planner.getByLabel("Include New Year's Day").check();
  const download = page.waitForEvent('download');
  await planner.getByRole('button', {name: 'Download plan bundle (2)'}).click();
  expect((await download).suggestedFilename()).toBe('seed-plan-2026-11-08.bundle.json');
});

test('your brand: paste CSS, review the proposal, and preview packs in those colours', async ({page}) => {
  const panel = page.locator('.brand-panel');
  await panel.locator('textarea').fill(':root{--color-surface:#f8f6f1;--color-text:#1f2a24;--color-primary:#2f6b4f}');
  await panel.getByRole('button', {name: 'Propose brand'}).click();
  const proposal = panel.getByLabel('Proposed brand');
  await expect(proposal).toContainText('--color-primary');
  await expect(proposal.getByRole('checkbox', {name: /Allow effects/})).not.toBeChecked();
  await proposal.getByRole('button', {name: 'Use this brand'}).click();
  await expect(panel.getByRole('button', {name: 'Download brand.json'})).toBeVisible();
  await page.locator('aside select').first().selectOption('christmas');
  await approve(page);
  const hero = page.getByRole('region', {name: 'Experience preview'}).locator('[data-seed-experience]').first();
  await expect(hero).toHaveCSS('--seed-foreground', '#1f2a24');
  await expect(page.locator('[data-seed-overlay]')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await panel.getByRole('button', {name: 'Download brand.json'}).click();
  expect((await download).suggestedFilename()).toBe('brand.json');
});

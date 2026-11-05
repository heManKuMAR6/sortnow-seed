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

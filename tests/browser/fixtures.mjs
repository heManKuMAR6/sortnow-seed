import {test as base, expect} from '@playwright/test';

// Hydration mismatches, CSP violations, and uncaught errors all surface here, so every flow fails on them.
export const test = base.extend({
  page: async ({page}, use) => {
    const problems = [];
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    page.on('pageerror', error => problems.push(error.message));
    await use(page);
    expect(problems).toEqual([]);
  },
});
export {expect};

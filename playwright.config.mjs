import {defineConfig, devices} from '@playwright/test';

// Separate from the demo defaults (4173, 4174) so a developer's running demo is never reused or disturbed.
const server = (script, port) => ({
  command: `node ${script}`,
  url: `http://127.0.0.1:${port}/`,
  env: {PORT: String(port)},
  reuseExistingServer: false,
});

export default defineConfig({
  testDir: 'tests/browser',
  forbidOnly: !!process.env.CI,
  retries: 0, // A flaky critical flow should be visible, not retried away.
  reporter: 'list',
  use: {...devices['Desktop Chrome'], trace: 'retain-on-failure'},
  webServer: [server('scripts/demo.mjs', 4183), server('scripts/demo-second-app.mjs', 4184)],
});

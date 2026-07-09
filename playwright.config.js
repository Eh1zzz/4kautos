import { defineConfig, devices } from '@playwright/test';

/* Frontend smoke suite. Runs the real app (backend serves the static frontend)
   and drives Chromium through the critical buyer journeys. Intentionally lean
   and lenient — it catches "the page is broken / the flow doesn't work", not
   pixel details. Assumes the dev database is seeded (npm run seed).

   Locally it reuses whatever server is already on :3000 (e.g. the preview
   server); in CI it starts its own. */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Disable the anim.js layer (pure enhancement) so elements are stable and
    // clicks are deterministic — otherwise continuous animation defeats
    // Playwright's actionability checks.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node backend/server.js',
    url: 'http://localhost:3000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

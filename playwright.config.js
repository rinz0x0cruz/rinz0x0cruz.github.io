import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 15_000,
  failOnFlakyTests: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4383',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // These smokes check that the page is usable in another engine, not that it
    // animates, so motion is off: it costs them nothing and gives the actionability
    // checks a settled box to wait on. They also carry the browser's cold start on
    // the two slowest engines, which is what the shared 15s budget had no room for,
    // so they get their own. Chromium keeps the tight budget and its motion, because
    // its tests deliberately assert both.
    {
      name: 'firefox-smoke',
      testMatch: /cross-browser\.spec\.js/u,
      timeout: 45_000,
      use: { ...devices['Desktop Firefox'], reducedMotion: 'reduce' },
    },
    {
      name: 'webkit-smoke',
      testMatch: /cross-browser\.spec\.js/u,
      timeout: 45_000,
      use: { ...devices['Desktop Safari'], reducedMotion: 'reduce' },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4383',
    url: 'http://127.0.0.1:4383',
    reuseExistingServer: false,
  },
})
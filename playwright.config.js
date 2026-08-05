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
    {
      name: 'firefox-smoke',
      testMatch: /cross-browser\.spec\.js/u,
      // These smokes check that the page is usable in another engine, not that it
      // animates. Motion is opt-in here, so turning it off gives the actionability
      // checks a stable box to wait on instead of a perpetually moving one.
      use: { ...devices['Desktop Firefox'], reducedMotion: 'reduce' },
    },
    {
      name: 'webkit-smoke',
      testMatch: /cross-browser\.spec\.js/u,
      use: { ...devices['Desktop Safari'], reducedMotion: 'reduce' },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4383',
    url: 'http://127.0.0.1:4383',
    reuseExistingServer: false,
  },
})
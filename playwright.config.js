import { defineConfig } from '@playwright/test'

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
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4383',
    url: 'http://127.0.0.1:4383',
    reuseExistingServer: false,
  },
})
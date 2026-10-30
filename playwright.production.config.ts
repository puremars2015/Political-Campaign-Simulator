import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/production', outputDir: 'test-results/production', fullyParallel: true, workers: 2,
  use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } },
  ],
  webServer: { command: 'pnpm build && PORT=4174 pnpm start', port:4174, reuseExistingServer: false },
});

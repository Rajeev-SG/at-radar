import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './test/e2e',
  use: {
    baseURL: isCI ? 'https://d95ab9e8.adtech-change-radar.pages.dev' : 'http://127.0.0.1:4321',
    headless: true,
  },
  webServer: isCI ? undefined : [
    {
      command: 'cd ../.. && npm run dev:local -w packages/worker',
      url: 'http://127.0.0.1:8787/api/health',
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: 'cd ../.. && PUBLIC_RADAR_API_URL=http://127.0.0.1:8787 npm run dev -w packages/web',
      url: 'http://127.0.0.1:4321',
      timeout: 120000,
      reuseExistingServer: true,
    },
  ],
});

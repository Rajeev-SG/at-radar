import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4321';
const apiURL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:8787';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './test/e2e',
  use: {
    baseURL,
    headless: true,
  },
  webServer: skipWebServer ? undefined : [
    {
      command: 'cd ../.. && npm run dev:local -w packages/worker',
      url: `${apiURL}/api/health`,
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: `cd ../.. && PUBLIC_RADAR_API_URL=${apiURL} npm run dev -w packages/web`,
      url: baseURL,
      timeout: 120000,
      reuseExistingServer: true,
    },
  ],
});

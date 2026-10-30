import { defineConfig } from '@playwright/test';
import base from './playwright.production.config.ts';

// Requires the explicitly started local Docker Compose service; does not start or stop containers.
export default defineConfig({
  ...base,
  outputDir: 'test-results/docker',
  webServer: undefined,
  use: { ...base.use, baseURL: process.env.DOCKER_TEST_URL ?? 'http://127.0.0.1:8787' },
});

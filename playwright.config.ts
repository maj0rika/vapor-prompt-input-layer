import { defineConfig, devices } from '@playwright/test';

const PORT = 5180;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/*.smoke.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // VAPOR_VALIDATION_MAX_CONCURRENT: E2E 가 fullyParallel 로 다수의 validation
    // 요청을 동시 발사하므로, production default (3) 보다 충분히 높은 값으로
    // 둬야 429 backpressure 가 flake 를 일으키지 않는다. production 운영
    // boundary 는 환경변수로 별도 관리한다 (docs/operations.md §4.2).
    command: `VAPOR_VALIDATION_MAX_CONCURRENT=50 VITE_AGENT_CLIENT=mock npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

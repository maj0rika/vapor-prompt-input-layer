/**
 * Live DeepSeek validation smoke 전용 Playwright config (G012).
 *
 * CI hard gate (verify:ci / test:e2e / smoke:live-deepseek) 에 포함되지 않습니다.
 * 모델/네트워크 변동성으로 인해 별도 명령으로 분리.
 *
 * 실행: DEEPSEEK_API_KEY=... npm run smoke:live-deepseek:validation
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5182;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testMatch: ['**/live-deepseek-validation.smoke.spec.ts'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'smoke-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 90_000,
  },
});

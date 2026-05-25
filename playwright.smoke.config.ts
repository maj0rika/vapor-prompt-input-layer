/**
 * Live DeepSeek smoke 전용 Playwright config.
 *
 * CI hard gate(verify:ci / test:e2e)에 포함되지 않습니다.
 * 실행: DEEPSEEK_API_KEY=... npm run smoke:live-deepseek
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5181;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testMatch: ['**/live-deepseek.smoke.spec.ts'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 240_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'smoke-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // live DeepSeek: VITE_AGENT_CLIENT 미설정 (= live 모드)
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 90_000,
  },
});

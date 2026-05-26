import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import vapor from 'eslint-plugin-vapor'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  /* 일반 접근성 규칙 (eslint-plugin-jsx-a11y) */
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [jsxA11y.flatConfigs.recommended],
  },
  /* Vapor 컴포넌트 전용 접근성 규칙 (eslint-plugin-vapor) */
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: vapor.configs.flat.plugins,
    rules: vapor.configs.flat.rules,
  },
  /*
   * 경계 규칙 (2종)
   *
   * 1) Vapor 경계 — Vapor primitive 는 제품 컴포넌트 레이어에서만 사용한다.
   *    src/** 전역에서 @vapor-ui/core 직접 import 를 차단하고,
   *    허용 소비처를 아래에서 *명시적으로 열거*해 규칙을 해제한다.
   *    레이어를 추가하면 이 열거 목록에 한 줄을 더해야 하므로,
   *    경계 결정이 항상 diff 에 드러난다.
   *
   * 2) agent-internal 경계 — agent 엔진은 배럴(src/agent/index.ts)로만
   *    노출된다. 앱·chat 레이어가 agent 내부 모듈을 deep import 하면 error.
   */

  // 1) Vapor 차단 (src/** 기본값)
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@vapor-ui/core', '@vapor-ui/core/*'],
              message:
                'Vapor primitive 는 제품 컴포넌트 레이어(src/components/prompt, src/components/chat)에서만 import 할 수 있습니다.',
            },
          ],
        },
      ],
    },
  },

  // 1) Vapor 허용 소비처 — 명시적 열거 (규칙 해제)
  {
    files: [
      'src/components/prompt/**/*.{ts,tsx}',
      'src/components/chat/**/*.{ts,tsx}',
      'src/main.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // 2) agent-internal 경계 — chat 레이어: Vapor 허용 + agent deep import 차단
  {
    files: ['src/components/chat/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/agent/*'],
              message:
                'agent 엔진은 배럴(src/agent)로만 import 하세요. 내부 모듈 직접 import 는 금지됩니다.',
            },
          ],
        },
      ],
    },
  },

  // 2) agent-internal 경계 — 앱 레이어: Vapor + agent deep import 모두 차단
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@vapor-ui/core', '@vapor-ui/core/*'],
              message:
                '앱 레이어는 Vapor primitive 를 직접 import 할 수 없습니다. src/components 의 제품 컴포넌트를 사용하세요.',
            },
            {
              group: ['**/agent/*'],
              message:
                'agent 엔진은 배럴(src/agent)로만 import 하세요. 내부 모듈 직접 import 는 금지됩니다.',
            },
          ],
        },
      ],
    },
  },

  /*
   * 3) compliance 경계 — compliance 코드는 레거시 LLM/DeepSeek/Agent 모듈을 import 할 수 없다.
   *
   * 금지 대상 레거시 디렉토리:
   *   - src/agent/            (DeepSeek agent 엔진)
   *   - src/components/chat/  (LLM chat UI)
   *   - src/components/prompt/(LLM prompt UI)
   *   - server/deepseek/      (DeepSeek API 서버)
   *   - server/preview/       (미리보기 서버)
   *
   * 적용 범위:
   *   - src/compliance/**
   *   - src/components/compliance/**
   *   - src/app/CompliancePage.tsx
   */
  {
    files: [
      'src/compliance/**/*.{ts,tsx}',
      'src/components/compliance/**/*.{ts,tsx}',
      'src/app/CompliancePage.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/agent/**', '**/agent'],
              message:
                'Compliance 코드는 레거시 src/agent/ 모듈을 import 할 수 없습니다. (legacy LLM 경계 — src/legacy/README.md 참고)',
            },
            {
              group: ['**/components/chat/**', '**/components/chat'],
              message:
                'Compliance 코드는 레거시 src/components/chat/ 모듈을 import 할 수 없습니다. (legacy LLM 경계 — src/legacy/README.md 참고)',
            },
            {
              group: ['**/components/prompt/**', '**/components/prompt'],
              message:
                'Compliance 코드는 레거시 src/components/prompt/ 모듈을 import 할 수 없습니다. (legacy LLM 경계 — src/legacy/README.md 참고)',
            },
            {
              group: ['**/deepseek/**'],
              message:
                'Compliance 코드는 레거시 server/deepseek/ 모듈을 import 할 수 없습니다. (legacy LLM 경계 — src/legacy/README.md 참고)',
            },
            {
              group: ['**/preview/**'],
              message:
                'Compliance 코드는 레거시 server/preview/ 모듈을 import 할 수 없습니다. (legacy LLM 경계 — src/legacy/README.md 참고)',
            },
          ],
        },
      ],
    },
  },
])

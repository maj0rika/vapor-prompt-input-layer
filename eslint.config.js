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
   * 경계 규칙: 앱 레이어는 Vapor primitive 를 직접 사용하지 않는다.
   * Vapor 는 오직 제품 컴포넌트 레이어(src/components/**)에서만 import 한다.
   */
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
                '앱 레이어는 Vapor primitive 를 직접 import 할 수 없습니다. src/components/prompt 의 제품 컴포넌트를 사용하세요.',
            },
          ],
        },
      ],
    },
  },
])

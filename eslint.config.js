import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
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
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Experimental React Compiler diagnostics newly bundled into react-hooks v6
      // recommended. This codebase predates them and they flag many intentional,
      // correct patterns (effect-driven state sync, in-place snapshot mutation).
      // Keep the battle-tested rules-of-hooks and exhaustive-deps; drop these.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // Vite fast-refresh hint — a dev-only HMR nicety with no runtime impact.
      // Router, store, and hook modules legitimately export non-components.
      'react-refresh/only-export-components': 'off',
      // Honour the underscore-prefix "intentionally unused" convention.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  // Tests and e2e specs lean on `any` for mocks/fixtures, and deliberately pass
  // constant falsy values (e.g. `false && 'x'`) to exercise edge cases.
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-constant-binary-expression': 'off',
    },
  },
  // Feature isolation: files inside src/features/ must import other features
  // through their public barrel (e.g. '@/features/lore'), not internal files.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/features/*/**'],
            message: "Cross-feature: import from the barrel ('@/features/<name>') not internal files.",
          },
        ],
      }],
    },
  },
])

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` is build output. `supabase/functions` is Deno code — it runs under a
  // different runtime (Deno.serve, Deno globals) with its own linter and
  // `deno-lint-ignore` directives, so the browser ESLint config must not lint it.
  globalIgnores(['dist', 'supabase/functions']),
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
    rules: {
      // Allow intentionally-unused args/vars/caught-errors when prefixed with `_`
      // (stable function signatures, deliberately-ignored catch bindings).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // React-Compiler preview rules (eslint-plugin-react-hooks v7): kept as
      // warnings, not errors. They flag (a) the standard async data-loading
      // effect pattern and (b) Date.now() in render-time date math — neither is
      // a correctness bug in this client-only SPA (no SSR / no hydration). They
      // remain visible as tech-debt signals rather than blocking the build, so we
      // don't mass-refactor ~13 working call sites for a cosmetic zero.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
])

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'mobile/dist/**', 'mobile/.expo/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["**/*.test.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.vitest, ...globals.node },
    },
  },
  {
    files: ["server/**/*.js", "netlify/**/*.js", "mobile/**/*.js", "mobile/**/*.jsx"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);

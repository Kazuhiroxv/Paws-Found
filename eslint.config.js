import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * ESLint flat config.
 *
 * Kept small on purpose: the recommended rule sets plus the two React-specific
 * plugins. Add rules only when they catch a mistake the team has actually made
 * — a wall of red squiggles gets ignored.
 */
export default [
  // `scripts/.local/` holds throwaway measurement scripts that drive a headless
  // Chrome. Most of their body is code that runs inside `page.evaluate()`, so
  // `document`, `window` and `scrollY` are real there and undefined here —
  // linting them as Node files reports fourteen errors about globals that are
  // correct. They are gitignored and are not part of the application.
  { ignores: ['dist', 'node_modules', 'scripts/.local'] },

  js.configs.recommended,
  // The plugin ships both formats; `configs.flat.*` are the flat-config ones.
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,

  {
    // Build and database tooling runs in Node, not the browser, so it gets
    // `process` and `console` rather than `window`.
    files: ['scripts/**/*.{js,mjs}', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Allow the deliberate `const { id: _id, ...rest } = changes` pattern the
      // services use to strip server-owned fields before a patch.
      'no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
]

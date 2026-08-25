import js from '@eslint/js';
import globals from 'globals';

// eslint-plugin-react / eslint-plugin-react-hooks don't yet publish a release
// supporting ESLint 10's peer range, so this config sticks to core JS rules
// with JSX parsing enabled until those plugins catch up.
export default [
  {
    ignores: ['build/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // React 19's automatic JSX runtime no longer requires `import React`,
          // but the codebase keeps it for consistency across files.
          varsIgnorePattern: '^React$',
        },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.test.{js,jsx}', 'src/setupTests.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
        vi: 'readonly',
      },
    },
  },
];

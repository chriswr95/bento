import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'work/**', 'prototype/vendor/**'] },
  js.configs.recommended,
  { files: ['**/*.{js,cjs}'], languageOptions: { ecmaVersion: 'latest' }, rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
    eqeqeq: ['error', 'always', { null: 'ignore' }]
  } },
  { files: ['*.js', 'desktop/**', 'files/**', 'scripts/**', 'tests/**', 'prototype/tests/**'], languageOptions: { globals: globals.node } },
  { files: ['prototype/**', 'tests/**'], languageOptions: { globals: globals.browser } },
  { files: ['desktop/*.cjs'], languageOptions: { sourceType: 'commonjs' } }
];

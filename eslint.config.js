import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output/**', '.wxt/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Security (docs/security-privacy.md §2.1): no dynamic code execution.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Never insert NetSuite data as HTML. Use textContent.' },
        { property: 'outerHTML', message: 'Never insert NetSuite data as HTML. Use textContent.' },
        { property: 'insertAdjacentHTML', message: 'Never insert NetSuite data as HTML.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Never insert NetSuite data as HTML.',
        },
      ],
    },
  },
  {
    // Playwright fixtures use a `use` callback that is not a React hook.
    files: ['tests/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    // CLAUDE.md rule 8: UI code never calls fetch against NetSuite; only the adapter does.
    files: ['src/features/**', 'src/shared/**', 'src/entrypoints/sidepanel/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'NetSuite access goes through NetSuiteAdapter.' },
        { name: 'XMLHttpRequest', message: 'NetSuite access goes through NetSuiteAdapter.' },
      ],
    },
  },
  {
    // No default exports except WXT entrypoints and React page components.
    files: ['src/netsuite/**', 'src/features/**', 'src/shared/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Never insert NetSuite data as HTML.',
        },
      ],
    },
  },
);

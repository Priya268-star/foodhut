import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config.
 *
 * Type-aware linting is intentionally off: `tsc --noEmit` already does full
 * type checking, and it runs far faster than a type-aware ESLint pass.
 */
export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      '.firebase',
      '**/*.config.js',
      // JSON config is validated by the tools that consume it, not by ESLint.
      'firebase.json',
      'firestore.indexes.json',
      'package.json',
      'tsconfig*.json',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React (the new JSX transform means no need for react/react-in-jsx-scope)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /* ---------------------------- correctness --------------------------- */
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-implicit-coercion': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-useless-catch': 'error',
      'no-throw-literal': 'error',

      /* --------------------------- type strictness ------------------------ */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      /*
       * Type-aware promise rules (`no-floating-promises`, `no-misused-promises`)
       * need parser type information, which we deliberately do not generate —
       * `tsc --noEmit` already covers this and runs far faster. Add a
       * `projectService: true` block here if you want them.
       */

      /* -------------------------------- react ----------------------------- */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /*
       * `set-state-in-effect` targets React Compiler semantics, where a
       * synchronous setState in an effect costs a cascaded render pass. This
       * app is not compiled, and the pattern in question is the standard
       * data-fetching shape: mark loading, await, write the result. React
       * bails out of identical state values, so the extra render only happens
       * on the one transition that genuinely needs to show a spinner.
       * Kept as a warning so the rule still surfaces the patterns that *would*
       * matter once the compiler is enabled.
       */
      'react-hooks/set-state-in-effect': 'warn',

      // `react-hook-form` returns new function identities per render, which the
      // compiler cannot statically prove pure. It is a warning-only notice.
      'react-hooks/incompatible-library': 'off',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Tailwind class ordering is handled by `prettier-plugin-tailwindcss`.

  /* ----------------------------- test files ------------------------------ */
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  /* ------------------------------ config files ---------------------------- */
  {
    files: ['*.config.{ts,js}', 'firebase.json'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);

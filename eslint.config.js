import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // Disable JS rules for TS files
      'no-unused-vars': 'off',
      'no-undef': 'off',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Style rules
      'no-console': 'off',
      'quotes': 'off',
      'semi': ['error', 'always'],
      'eol-last': ['error', 'always'],
      'no-trailing-spaces': 'error'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'migrations/**'
    ]
  }
];

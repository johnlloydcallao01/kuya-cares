const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/',
      '.expo/',
      '**/.expo/**',
      'dist/',
      'web-build/',
      '**/metro.config.eas.js',
      '**/fix-autolinking-imports.js',
      '*.config.js',
      'babel.config.js',
      'metro.config.js',
    ],
  },
  expoConfig,
  {
    rules: {
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',
    },
  },
]);

/**
 * Root ESLint configuration
 * This file is required for ESLint v9+ to run from the root directory.
 * We ignore all workspace packages here as they have their own configurations.
 */
module.exports = [
  {
    ignores: [
      "apps/**",
      "packages/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.vercel/**",
      "**/coverage/**"
    ]
  }
];

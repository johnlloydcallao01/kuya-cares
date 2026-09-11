const nextConfig = require("@encreasl/eslint-config/nextjs");

module.exports = [
  ...nextConfig,
  {
    ignores: [".next/**", "dist/**", "node_modules/**"]
  }
];

const baseConfig = require("@encreasl/eslint-config/base");

module.exports = [
  ...baseConfig,
  {
    ignores: ["dist/**", "node_modules/**"]
  }
];

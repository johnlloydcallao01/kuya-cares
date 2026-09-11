const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Ultra-simplified Metro config for EAS builds
const projectRoot = process.cwd();
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// OPTIMIZED: Only watch the project directory, not the entire monorepo
// This prevents expo doctor timeout issues in large monorepos
config.watchFolders = [projectRoot];

// Critical resolver configuration for pnpm monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Essential modules for EAS builds
config.resolver.extraNodeModules = {
  'react': path.resolve(monorepoRoot, 'node_modules/react'),
  'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
  'expo': path.resolve(monorepoRoot, 'node_modules/expo'),
  'expo-modules-core': path.resolve(monorepoRoot, 'node_modules/expo-modules-core'),
};

// Fix autolinking by ensuring proper module resolution
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Apply NativeWind
try {
  const { withNativeWind } = require('nativewind/metro');
  module.exports = withNativeWind(config, {
    input: './global.css',
    configPath: './tailwind.config.js',
  });
} catch (_error) {
  module.exports = config;
}



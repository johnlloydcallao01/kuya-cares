const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Expo Metro config
const config = getDefaultConfig(__dirname);

// Configure for monorepo structure
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// Set up watch folders for monorepo
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), monorepoRoot])
);

// Configure node modules resolution
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Configure platforms
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// NativeWind v2 doesn't use metro plugin - it uses PostCSS and Babel
console.log('✅ Metro config loaded successfully');
console.log('✅ NativeWind v2 configured via Babel and PostCSS');
module.exports = config;

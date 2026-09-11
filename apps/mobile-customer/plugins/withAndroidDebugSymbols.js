const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidDebugSymbols(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const buildGradle = config.modResults.contents;

      // Check if we already have the configuration to avoid duplicates
      if (buildGradle.includes("debugSymbolLevel 'FULL'")) {
        return config;
      }

      // Try to inject into buildTypes { release { ... } }
      // This is the most specific and correct place for release builds
      const releaseBuildTypeRegex = /buildTypes\s*\{\s*release\s*\{/;
      
      if (releaseBuildTypeRegex.test(buildGradle)) {
        config.modResults.contents = buildGradle.replace(
          releaseBuildTypeRegex,
          `buildTypes {
        release {
            ndk {
                debugSymbolLevel 'FULL'
            }`
        );
      } else {
        // Fallback: Inject into defaultConfig if release block isn't found
        // This acts as a global default for all build types
        const defaultConfigRegex = /defaultConfig\s*\{/;
        if (defaultConfigRegex.test(buildGradle)) {
          config.modResults.contents = buildGradle.replace(
            defaultConfigRegex,
            `defaultConfig {
        ndk {
            debugSymbolLevel 'FULL'
        }`
          );
        }
      }
    }
    return config;
  });
};

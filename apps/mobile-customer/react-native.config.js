/**
 * React Native CLI Configuration Override
 * This file overrides the default autolinking behavior to fix the ExpoModulesPackage import issue
 *
 * ISSUE: React Native CLI autolinking generates PackageList.java with incorrect import:
 * - Generated: import expo.core.ExpoModulesPackage;
 * - Correct:   import expo.modules.ExpoModulesPackage;
 *
 * This configuration ensures the correct import path is used for Expo SDK 53+
 */

module.exports = {
  project: {
    android: {
      sourceDir: './android',
      appName: 'app',
      packageName: 'com.tap2go.mobile',
    },
  },
  dependencies: {
    'expo-modules-core': {
      platforms: {
        android: {
          sourceDir: '../node_modules/expo-modules-core/android',
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
        },
      },
    },
  },
};

const { withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to apply the android-autolinking-fix.gradle to the Android build
 * This fixes the ExpoModulesPackage import error in Expo SDK 52+ projects
 */
function withAndroidAutolinkingFix(config) {
  // First, copy the gradle fix file to the android directory
  const projectRoot = config._internal?.projectRoot || process.cwd();
  const androidDir = path.join(projectRoot, 'android');
  const sourceFile = path.join(projectRoot, 'android-autolinking-fix.gradle');
  const destFile = path.join(androidDir, 'android-autolinking-fix.gradle');
  
  if (fs.existsSync(sourceFile)) {
    try {
      fs.copyFileSync(sourceFile, destFile);
      console.log('✅ Copied android-autolinking-fix.gradle to android directory');
    } catch (error) {
      console.log('⚠️ Could not copy android-autolinking-fix.gradle:', error.message);
    }
  } else {
    console.log('⚠️ android-autolinking-fix.gradle not found at:', sourceFile);
  }

  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    
    // Check if the fix is already applied
    if (buildGradle.includes('android-autolinking-fix.gradle')) {
      console.log('✅ Android autolinking fix already applied to build.gradle');
      return config;
    }
    
    // Add the autolinking fix after the react plugin application
    const applyReactPlugin = 'apply plugin: "com.facebook.react"';
    const autolinkingFix = `apply plugin: "com.facebook.react"

// Apply autolinking fix for Expo SDK 53+ - Fixes ExpoModulesPackage import error
apply from: "./android-autolinking-fix.gradle"`;
    
    if (buildGradle.includes(applyReactPlugin)) {
      config.modResults.contents = buildGradle.replace(
        applyReactPlugin,
        autolinkingFix
      );
      console.log('✅ Applied android-autolinking-fix.gradle to build.gradle');
    } else {
      console.log('⚠️ Could not find apply plugin: "com.facebook.react" in build.gradle');
    }
    
    return config;
  });
}

module.exports = withAndroidAutolinkingFix;

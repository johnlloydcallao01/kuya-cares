# EAS Build Success Guide - Expo SDK 53+ Autolinking Fix

## 🚨 Critical Issue: ExpoModulesPackage Import Error

### The Problem
When running EAS builds with Expo SDK 52+ (especially SDK 53), you may encounter this error:

```
Task :app:compileReleaseJavaWithJavac FAILED
/home/expo/workingdir/build/apps/mobile-customer/android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java:22: error: cannot find symbol
import expo.core.ExpoModulesPackage;
                ^
  symbol:   class ExpoModulesPackage
  location: package expo.core
```

### ❌ Common Misconceptions
- **NOT related to AppEntry.js** - This is a native Android compilation issue, not JavaScript
- **NOT a dependency issue** - expo-modules-core is properly installed
- **NOT a version conflict** - All packages are compatible

### ✅ Root Cause Analysis
**React Native CLI autolinking hasn't been updated for Expo SDK 52+ package structure changes:**

- **Old Path (SDK 51-)**: `import expo.core.ExpoModulesPackage;`
- **New Path (SDK 52+)**: `import expo.modules.ExpoModulesPackage;`

The autolinking system generates PackageList.java with the old import path, causing compilation failure.

## 🔧 Complete Solution Implementation

### 1. React Native Config Override
Create `react-native.config.override.js`:

```javascript
/**
 * React Native CLI Configuration Override
 * Fixes ExpoModulesPackage import path for Expo SDK 53+
 */
module.exports = {
  project: {
    android: {
      sourceDir: './android',
      appName: 'app',
      packageName: 'com.tap2go.mobile', // Your package name
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
```

### 2. JavaScript Fix Script
Create `fix-autolinking-imports.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing autolinking imports...');

function fixPackageListImport(filePath) {
    if (!fs.existsSync(filePath)) return false;
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes('import expo.core.ExpoModulesPackage;')) {
            console.log(`🔧 Fixing incorrect import in: ${filePath}`);
            content = content.replace(
                /import expo\.core\.ExpoModulesPackage;/g,
                'import expo.modules.ExpoModulesPackage;'
            );
            fs.writeFileSync(filePath, content);
            console.log('✅ Fixed autolinking import');
            return true;
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    return false;
}

// Fix known locations
const locations = [
    'android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java',
    'android/app/build/generated/rncli/src/main/java/com/facebook/react/PackageList.java'
];

locations.forEach(fixPackageListImport);
```

### 3. EAS Build Post-Install Hook
Update `eas-build-post-install.sh`:

```bash
#!/bin/bash
echo "🚀 EAS Build Post-Install Hook"

if [ "$EAS_BUILD" = "true" ] || [ "$CI" = "true" ]; then
    echo "✅ EAS Build environment detected"
    
    # CRITICAL FIX: Apply autolinking import fix
    echo "🔧 Applying autolinking import fix for ExpoModulesPackage..."
    
    # Copy React Native config override
    if [ -f "react-native.config.override.js" ]; then
        cp react-native.config.override.js react-native.config.js
        echo "✅ React Native config override applied"
    fi
    
    # Run autolinking import fix
    if [ -f "fix-autolinking-imports.js" ]; then
        node fix-autolinking-imports.js
        echo "✅ Autolinking import fix completed"
    fi
fi
```

### 4. Gradle Build Hook (Advanced)
Create `android-autolinking-fix.gradle`:

```gradle
// Hook into autolinking tasks to fix imports immediately
afterEvaluate { project ->
    project.tasks.matching { task ->
        task.name.contains("generateAutolinking")
    }.all { autolinkingTask ->
        autolinkingTask.doLast {
            println "🔧 APPLYING EXPO SDK 53+ AUTOLINKING FIX"
            
            def packageListLocations = [
                "${project.buildDir}/generated/autolinking/src/main/java/com/facebook/react/PackageList.java"
            ]
            
            packageListLocations.each { location ->
                def file = file(location)
                if (file.exists()) {
                    def content = file.text
                    if (content.contains('import expo.core.ExpoModulesPackage;')) {
                        def fixed = content.replace(
                            'import expo.core.ExpoModulesPackage;',
                            'import expo.modules.ExpoModulesPackage;'
                        )
                        file.text = fixed
                        println "✅ Fixed import in: ${location}"
                    }
                }
            }
        }
    }
}
```

Add to `android/app/build.gradle`:
```gradle
// Apply autolinking fix
apply from: "../../android-autolinking-fix.gradle"
```

## 🎯 Best Practices for EAS Builds

### Pre-Build Checklist
1. **Run Expo Doctor**: `npx expo-doctor` - Must pass 15/15 checks
2. **Clean Build**: Remove `android/` and `ios/` directories before build
3. **Verify Dependencies**: Ensure all Expo packages are compatible versions
4. **Test Locally**: Run `npx expo prebuild` to test autolinking

### EAS Configuration Best Practices

#### Use Preview Profile for Production APKs
```bash
# ✅ Correct for production APK
npx eas build --platform android --profile preview

# ❌ Wrong - development builds are for testing only
npx eas build --platform android --profile development
```

#### Optimal eas.json Configuration
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "env": {
          "NODE_ENV": "production"
        }
      }
    }
  }
}
```

### Monorepo Considerations
- Skip Expo Doctor in EAS builds (causes timeouts)
- Use proper workspace configuration
- Ensure correct entry points and paths

## 🔍 Troubleshooting Guide

### If Build Still Fails
1. **Check Build Logs**: Look for the exact PackageList.java path
2. **Verify Fix Application**: Ensure post-install script runs
3. **Manual Verification**: Check if import was actually fixed
4. **Clean Rebuild**: Clear EAS cache and rebuild

### Common Issues
- **Timeout during fingerprinting**: Set `EAS_SKIP_AUTO_FINGERPRINT=1`
- **Gradle initialization slow**: Normal for first build
- **Metro config errors**: Ensure proper workspace configuration

## 📚 Technical Background

### Why This Happens
1. **Expo SDK Evolution**: Package structure changed in SDK 52+
2. **React Native CLI Lag**: Autolinking templates not updated
3. **Build Environment**: EAS uses React Native CLI for autolinking

### The Fix Explained
- **Preventive**: React Native config override
- **Reactive**: Post-install script fixes generated files
- **Aggressive**: Gradle hooks for immediate fixing

## ✅ Success Indicators
- Build completes without compilation errors
- APK generates successfully
- No ExpoModulesPackage import errors in logs
- App installs and runs properly

## 🚀 Final Notes
This issue affects **all Expo SDK 52+ projects** using EAS Build. The fix is **permanent** once implemented and will work for future builds. This is **not related to AppEntry.js** - it's purely a native Android compilation issue caused by outdated autolinking templates.

**Remember**: Always use `--profile preview` for production APK builds!

## 🛡️ Prevention Strategies

### 1. Project Setup Best Practices
```bash
# Always use latest Expo CLI
npm install -g @expo/cli@latest

# Initialize with proper SDK version
npx create-expo-app --template blank-typescript

# Install dependencies properly
npx expo install expo-modules-core
```

### 2. Dependency Management
- **Never manually edit package.json** for Expo packages
- **Use `npx expo install`** for all Expo-related packages
- **Keep SDK versions consistent** across all Expo packages
- **Avoid mixing Expo SDK versions**

### 3. Build Environment Consistency
```json
// package.json - Ensure consistent Node version
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

## 🔧 Advanced Troubleshooting

### Debug Build Failures
1. **Enable Verbose Logging**:
   ```bash
   npx eas build --platform android --profile preview --verbose
   ```

2. **Check Specific Build Phase**:
   - Look for "Run gradlew" phase in build logs
   - Identify exact compilation error location
   - Verify autolinking generation step

3. **Local Reproduction**:
   ```bash
   npx expo prebuild --clean
   cd android
   ./gradlew assembleRelease --stacktrace
   ```

### Emergency Fixes During Build
If build fails and you need immediate fix:

1. **Fork and modify autolinking**:
   ```bash
   # In eas-build-post-install.sh
   find . -name "PackageList.java" -exec sed -i 's/expo\.core\.ExpoModulesPackage/expo.modules.ExpoModulesPackage/g' {} \;
   ```

2. **Force regenerate autolinking**:
   ```bash
   npx react-native config
   node fix-autolinking-imports.js
   ```

## 📊 Build Performance Optimization

### Faster EAS Builds
1. **Use Build Cache**: EAS automatically caches dependencies
2. **Optimize Bundle Size**: Remove unused dependencies
3. **Skip Unnecessary Steps**: Configure eas.json properly
4. **Use Appropriate Profiles**: Don't use development for production

### Resource Management
```json
// eas.json - Optimize build resources
{
  "build": {
    "preview": {
      "android": {
        "resourceClass": "medium", // or "large" for complex apps
        "cache": {
          "disabled": false
        }
      }
    }
  }
}
```

## 🌐 Community Resources

### Official Documentation
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [React Native Autolinking](https://github.com/react-native-community/cli/blob/main/docs/autolinking.md)
- [Expo SDK Changelog](https://expo.dev/changelog)

### Known Issues & Tracking
- [EAS CLI Issue #2789](https://github.com/expo/eas-cli/issues/2789) - ExpoModulesPackage import error
- [React Native CLI Autolinking Issues](https://github.com/react-native-community/cli/issues)

### Community Solutions
- Stack Overflow: Search "ExpoModulesPackage cannot find symbol"
- Expo Discord: #eas-build channel
- GitHub Discussions: expo/expo repository

## 🎓 Learning from This Issue

### Key Takeaways
1. **SDK Upgrades Have Breaking Changes**: Always check changelogs
2. **Autolinking is Fragile**: Requires careful configuration
3. **Build Environment Differs from Local**: Test thoroughly
4. **Multiple Fix Layers Work Best**: Preventive + reactive approaches

### Future-Proofing
- **Stay Updated**: Monitor Expo SDK releases
- **Test Early**: Use beta/RC versions for testing
- **Document Fixes**: Keep solutions for team reference
- **Automate Checks**: Add pre-build validation scripts

---

## 📝 Conclusion

The ExpoModulesPackage import issue is a **known problem** affecting Expo SDK 52+ projects. It's caused by **outdated React Native CLI autolinking templates** that haven't been updated for Expo's new package structure.

**This comprehensive guide provides multiple layers of fixes** to ensure your EAS builds succeed:
- **Preventive**: Configuration overrides
- **Reactive**: Post-install scripts
- **Aggressive**: Gradle build hooks

**The solution is permanent** once implemented and will protect against future builds. Remember to always use the **preview profile** for production APKs and maintain proper dependency management practices.

**Most importantly**: This issue is **NOT related to AppEntry.js** or JavaScript entry points - it's purely a native Android compilation issue that requires native-level fixes.

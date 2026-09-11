#!/usr/bin/env node

/**
 * Fix Autolinking Imports - Official Solution
 * This script fixes the expo.core.ExpoModulesPackage import issue
 * Based on official Expo documentation for autolinking issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing autolinking imports...');

// Function to fix PackageList.java import
function fixPackageListImport(filePath) {
    if (!fs.existsSync(filePath)) {
        return false;
    }
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if the wrong import exists
        if (content.includes('import expo.core.ExpoModulesPackage;')) {
            console.log(`🔧 Fixing incorrect import in: ${filePath}`);
            
            // Replace the incorrect import with the correct one
            content = content.replace(
                /import expo\.core\.ExpoModulesPackage;/g,
                'import expo.modules.ExpoModulesPackage;'
            );
            
            // Write the fixed content back
            fs.writeFileSync(filePath, content);
            console.log('✅ Fixed autolinking import');
            return true;
        } else if (content.includes('import expo.modules.ExpoModulesPackage;')) {
            console.log(`✅ Import already correct in: ${filePath}`);
            return true;
        } else {
            console.log(`ℹ️  No ExpoModulesPackage import found in: ${filePath}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Error processing ${filePath}: ${error.message}`);
        return false;
    }
}

// Locations where autolinking generates PackageList.java
const packageListLocations = [
    'android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java',
    'android/app/build/generated/rncli/src/main/java/com/facebook/react/PackageList.java'
];

// Check if we're in an Android build
if (!fs.existsSync('android')) {
    console.log('ℹ️  Android directory not found, skipping autolinking fix');
    process.exit(0);
}

// Fix existing files
let fixed = false;
for (const location of packageListLocations) {
    if (fixPackageListImport(location)) {
        fixed = true;
    }
}

// Search for any other PackageList.java files in the build directory
try {
    const buildDir = 'android/app/build';
    if (fs.existsSync(buildDir)) {
        console.log('🔍 Searching for additional PackageList.java files...');
        
        function searchDirectory(dir) {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    searchDirectory(fullPath);
                } else if (item === 'PackageList.java') {
                    console.log(`📁 Found: ${fullPath}`);
                    fixPackageListImport(fullPath);
                }
            }
        }
        
        searchDirectory(buildDir);
    }
} catch (_error) {
    console.log('ℹ️  Search completed');
}

if (fixed) {
    console.log('✅ Updated one or more PackageList.java files');
} else {
    console.log('ℹ️  No autolinking import changes were required');
}

console.log('✅ Autolinking import fix completed');
process.exit(0);

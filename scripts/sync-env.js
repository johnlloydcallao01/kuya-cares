#!/usr/bin/env node

/**
 * Environment Variable Synchronization Script for Tap2Go Monorepo
 * 
 * This script ensures all apps in the monorepo have access to the same
 * environment variables from the root .env.local file.
 * 
 * Usage:
 *   node scripts/sync-env.js
 *   npm run sync-env
 */

const fs = require('fs');
const path = require('path');

class EnvSynchronizer {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.rootEnvFile = path.join(this.rootDir, '.env.local');
    this.apps = [
      {
        name: 'web',
        path: path.join(this.rootDir, 'apps/web'),
        needsSync: false, // Next.js automatically loads from root
      },
      {
        name: 'mobile-customer',
        path: path.join(this.rootDir, 'apps/mobile-customer'),
        needsSync: true, // React Native needs explicit sync
      }
    ];
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'     // Reset
    };
    
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
  }

  checkRootEnvFile() {
    // Check if we're in EAS Build environment
    if (process.env.EAS_BUILD || process.env.CI) {
      this.log('Running in EAS Build/CI environment - skipping .env.local check', 'info');
      return 'eas-build';
    }

    if (!fs.existsSync(this.rootEnvFile)) {
      this.log('Root .env.local file not found - skipping sync for monorepo setup', 'warning');
      this.log('Each app should manage its own environment variables', 'info');
      return false;
    }
    return true;
  }

  readRootEnvFile() {
    try {
      const content = fs.readFileSync(this.rootEnvFile, 'utf8');
      this.log(`Read ${content.split('\n').length} lines from root .env.local`, 'success');
      return content;
    } catch (error) {
      this.log(`Failed to read root .env.local: ${error.message}`, 'error');
      return null;
    }
  }

  syncAppEnvironment(app, envContent) {
    if (!app.needsSync) {
      this.log(`${app.name}: Uses root .env.local automatically`, 'info');
      return true;
    }

    const appEnvFile = path.join(app.path, '.env.local');
    
    try {
      // Create app directory if it doesn't exist
      if (!fs.existsSync(app.path)) {
        this.log(`Creating directory: ${app.path}`, 'warning');
        fs.mkdirSync(app.path, { recursive: true });
      }

      // Write environment file
      fs.writeFileSync(appEnvFile, envContent, 'utf8');
      this.log(`${app.name}: Environment variables synchronized`, 'success');
      return true;
    } catch (error) {
      this.log(`${app.name}: Failed to sync - ${error.message}`, 'error');
      return false;
    }
  }

  validateEnvironment() {
    this.log('Validating environment variables...', 'info');
    
    const envContent = this.readRootEnvFile();
    if (!envContent) return false;

    // Core environment variables that should be synced across all apps
    const coreEnvVars = [
      'NODE_ENV',
      'JWT_SECRET',
      'DATABASE_URL',
      'REDIS_URL',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
      'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
      'NEXT_PUBLIC_CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'PAYMONGO_PUBLIC_KEY_LIVE',
      'PAYMONGO_SECRET_KEY_LIVE',
      'RESEND_API_KEY',
      'OPENAI_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN'
    ];

    // Check for required variables
    const requiredVars = [
      'NEXT_PUBLIC_MAPS_FRONTEND_KEY'
    ];

    const missing = requiredVars.filter(varName => 
      !envContent.includes(`${varName}=`)
    );

    if (missing.length > 0) {
      this.log('Missing required environment variables:', 'error');
      missing.forEach(varName => this.log(`  - ${varName}`, 'error'));
      return false;
    }

    this.log('All required environment variables present', 'success');
    return true;
  }

  run() {
    this.log('🔄 Starting environment synchronization...', 'info');

    // Check if root .env.local exists or if we're in EAS Build
    const envCheck = this.checkRootEnvFile();
    if (envCheck === false) {
      this.log('✅ Monorepo setup - each app manages its own environment', 'success');
      return;
    }

    // If we're in EAS Build, skip the sync process
    if (envCheck === 'eas-build') {
      this.log('🚀 EAS Build detected - environment variables provided by EAS Dashboard', 'success');
      this.log('✅ Skipping local environment synchronization', 'info');
      this.log('🎉 Environment setup complete for EAS Build!', 'success');
      return;
    }

    // Validate environment variables (local development only)
    if (!this.validateEnvironment()) {
      this.log('Environment validation failed', 'error');
      process.exit(1);
    }

    // Read root environment file
    const envContent = this.readRootEnvFile();
    if (!envContent) {
      process.exit(1);
    }

    // Sync environment for each app
    let allSuccess = true;
    for (const app of this.apps) {
      const success = this.syncAppEnvironment(app, envContent);
      if (!success) allSuccess = false;
    }

    if (allSuccess) {
      this.log('🎉 Environment synchronization completed successfully!', 'success');
      this.log('All apps now have access to the same environment variables', 'info');
    } else {
      this.log('❌ Some apps failed to sync', 'error');
      process.exit(1);
    }
  }
}

// Run the synchronizer
if (require.main === module) {
  const synchronizer = new EnvSynchronizer();
  synchronizer.run();
}

module.exports = EnvSynchronizer;

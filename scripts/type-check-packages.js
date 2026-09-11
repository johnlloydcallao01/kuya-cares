#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const packages = [
  'packages/env/tsconfig.json',
  'packages/ui/tsconfig.json', 
  'packages/cms-types/tsconfig.json',
  'packages/redux/tsconfig.json'
];

console.log('🔍 Running TypeScript type-check for all packages...\n');

let hasErrors = false;

for (const pkg of packages) {
  const packageName = path.dirname(pkg).split('/')[1];
  console.log(`📦 Checking ${packageName}...`);
  
  try {
    execSync(`pnpm exec tsc --project ${pkg} --noEmit`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${packageName} - OK\n`);
  } catch (error) {
    console.log(`❌ ${packageName} - FAILED\n`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.log('❌ Some packages failed type-check');
  process.exit(1);
} else {
  console.log('✅ All packages passed type-check!');
}
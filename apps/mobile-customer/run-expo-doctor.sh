#!/bin/bash

# Optimized Expo Doctor Script
# This script runs expo doctor with minimal environment loading to prevent timeouts

echo "🔍 Running optimized Expo Doctor..."

# Backup current env files
if [ -f ".env.local" ]; then
    mv .env.local .env.local.backup
fi

if [ -f ".env" ]; then
    mv .env .env.backup
fi

# Use minimal environment for doctor
cp .env.doctor .env.local

# Run expo doctor with timeout
timeout 60 npx expo-doctor

# Store the result
DOCTOR_RESULT=$?

# Restore original env files
rm -f .env.local

if [ -f ".env.local.backup" ]; then
    mv .env.local.backup .env.local
fi

if [ -f ".env.backup" ]; then
    mv .env.backup .env
fi

# Report results
if [ $DOCTOR_RESULT -eq 0 ]; then
    echo "✅ Expo Doctor completed successfully!"
    exit 0
elif [ $DOCTOR_RESULT -eq 124 ]; then
    echo "⚠️ Expo Doctor timed out (60s limit)"
    exit 1
else
    echo "❌ Expo Doctor failed with error code: $DOCTOR_RESULT"
    exit $DOCTOR_RESULT
fi

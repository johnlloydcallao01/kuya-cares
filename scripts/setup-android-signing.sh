#!/bin/bash

# 🔑 Android Signing Setup Script
# This script helps you generate and configure Android signing keys

echo "🔑 Setting up Android signing for production builds..."

# Create android directory if it doesn't exist
mkdir -p apps/mobile/android/app

# Generate keystore (you'll be prompted for passwords)
echo "📝 Generating Android keystore..."
echo "⚠️  Remember the passwords you enter - you'll need them for GitHub secrets!"

keytool -genkeypair -v -storetype PKCS12 \
  -keystore apps/mobile/android/app/my-upload-key.keystore \
  -alias my-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Tap2Go, OU=Mobile, O=Tap2Go, L=City, S=State, C=US"

echo ""
echo "✅ Keystore generated successfully!"
echo ""
echo "🔐 Next steps:"
echo "1. Add these secrets to your GitHub repository:"
echo "   - ANDROID_STORE_PASSWORD (keystore password)"
echo "   - ANDROID_KEY_PASSWORD (key password)"
echo ""
echo "2. Go to GitHub → Settings → Secrets and variables → Actions"
echo "3. Add the passwords you just entered"
echo ""
echo "🚀 Your Android signing is now ready for production builds!"

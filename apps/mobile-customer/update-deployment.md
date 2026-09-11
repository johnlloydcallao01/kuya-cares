Complete Guide: Updating Your WordPress App to React Native (Expo) on Google Play
Part 1: Find Your Existing App's Package Name
Method 1: Google Play Console (Easiest)

Log into Google Play Console
Find your existing WordPress app in the app list
The package name appears under the app name (e.g., com.yourcompany.appname)

Method 2: Play Store URL

Find your app on Google Play Store
Look at the URL: https://play.google.com/store/apps/details?id=com.example.myapp
Everything after id= is your package name
com.wnapp.id1721090048598

Part 2: Create a New Upload Key (Keystore Reset)
Since your third-party provider built your WordPress app and you have "Signing by Google Play" enabled, you can create a brand new keystore without contacting them!
Step 1: Create a New Keystore
Open Terminal/Command Prompt and run:
bashkeytool -genkeypair -alias upload -keyalg RSA -keysize 2048 -validity 9125 -keystore keystore.jks
Follow the prompts to set:

Keystore password (save this!)
Your name/organization details
Key password (save this!)

CRITICAL: Save this keystore.jks file and all passwords in a secure location. You'll need them for all future updates.
Step 2: Export PEM Certificate
Run this command:
bashkeytool -export -rfc -keystore keystore.jks -alias upload -file upload_certificate.pem
Enter the keystore password when prompted. This creates the upload_certificate.pem file.
Step 3: Request Upload Key Reset in Play Console
Navigation:

Go to Play Console → Setup → App Integrity → App Signing tab
Scroll down to find the "Upload key certificate" section
Look for "Request upload key reset" button or link

If you don't see "Request upload key reset" immediately:

Scroll all the way down - it's usually below the "App signing key certificate" section
Look for a settings icon (⚙️) in the "Upload key certificate" area and click it
Check permissions: You must be logged in as the account owner

Once you find it:

Click "Request upload key reset"
Select "I lost my upload key" as the reason
Upload the upload_certificate.pem file you created
Click Request

Step 4: Wait for Approval

Google will review your request (usually 48 hours)
You'll receive an email confirmation when approved
After approval, you can use your new keystore for all future updates


Part 3: Configure Your Expo React Native App
Step 1: Install EAS CLI
bashnpm install -g eas-cli
eas login
Step 2: Update app.json or app.config.js
Edit your app.json to match your existing WordPress app's package name:
json{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "version": "2.0.0",
    "android": {
      "package": "com.yourcompany.appname",
      "versionCode": 2
    }
  }
}
CRITICAL Requirements:

android.package MUST exactly match your existing WordPress app's package name
android.versionCode must be higher than your current version (check Play Console → Release → Production)
version is the user-facing version (e.g., "2.0.0")

Step 3: Initialize EAS Build (if not already done)
basheas build:configure
When prompted:

Choose "All" for platforms (or just Android if iOS not needed)
EAS will create eas.json file

Step 4: Configure eas.json
Your eas.json should look like this:
json{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "apk"
      }
    }
  }
}
Note: The autoIncrement: true will automatically increment versionCode for future builds after the first one.

Part 4: Build Your App with EAS
Step 1: Create Production Build
Run this command to build your Android app bundle:
basheas build --platform android --profile production
Important:

EAS will ask if you want to generate a new keystore - Say NO initially
We'll configure it to use your new keystore from Part 2

Step 2: Configure Your New Keystore with EAS
You have two options:
Option A: Upload Keystore to EAS (Recommended)

Go to Expo Dashboard
Select your project
Go to Credentials → Android → Your package name
Click Add Keystore
Upload your keystore.jks file
Enter the keystore password and key alias ("upload")

Option B: Use Local Keystore
Add to eas.json:
json{
  "build": {
    "production": {
      "android": {
        "credentialsSource": "local"
      }
    }
  }
}
Then create credentials.json in your project root:
json{
  "android": {
    "keystore": {
      "keystorePath": "./keystore.jks",
      "keystorePassword": "YOUR_KEYSTORE_PASSWORD",
      "keyAlias": "upload",
      "keyPassword": "YOUR_KEY_PASSWORD"
    }
  }
}
Step 3: Build Again
After configuring your keystore, run:
basheas build --platform android --profile production
The build will:

Queue on EAS servers
Build your .aab file
Sign it with your new keystore (after the 48-hour reset approval)
Auto-increment the versionCode

You can track progress at the provided EAS dashboard link.
Step 4: Download the .aab File
Once the build completes:

Go to the EAS dashboard link provided
Click Download to get your .aab file
Or use: eas build:download


Part 5: Upload to Google Play Console

Open your Play Console and select your app
In the side menu, go to Release → Production
Click "Create new release" in the top right corner
Upload your AAB file:

Drag and drop the .aab file from EAS Build
Or click "Upload" and browse to the file


Add Release Notes:

Explain what's new (e.g., "Complete rebuild using React Native for better performance and features")
Support multiple languages if needed
Note: We have prepared the English (UK) description in `apps/mobile-customer/metadata/en-GB/full_description.txt`. You can copy-paste this into the "Full description" and "Release notes" fields in the Play Console.

Click "Save"
Click "Review Release"
Review all details, then click "Start rollout to Production"


Part 6: Review & Publication

Review time: Anywhere from a few hours to 7 days (typically 24-48 hours)
No testing requirements: Since you're updating an existing app, you skip the 20 testers and 14-day waiting period
User experience: Existing users will receive the update automatically
Ratings & reviews: All previous ratings and reviews are preserved


Part 7: Future Updates (Bonus)
For future updates, the process is much simpler:
Quick Update Process:

Update your code
Increment version in app.json (e.g., "2.0.0" → "2.1.0")
Run: eas build --platform android
Download the .aab and upload to Play Console

Note: versionCode will auto-increment if you set autoIncrement: true in eas.json!
Over-the-Air (OTA) Updates:
For minor changes (bug fixes, UI tweaks) that don't require native code changes:
basheas update --branch production --message "Bug fixes"
Users will get updates instantly without downloading from Play Store!

Troubleshooting
Can't Find "Request Upload Key Reset"

Scroll all the way down on the App Signing tab - it's in the "Upload key certificate" section
Verify permissions: You must be the account owner
Look for settings icon (⚙️) in the "Upload key certificate" section

Error: "Upload key does not match"

Wait the full 48 hours after key reset request
Verify you're using the correct new keystore file
Confirm you exported the PEM certificate from the correct keystore

Error: "Version code must be greater"

Check your current version in Play Console under Release → Production
Set android.versionCode in app.json to be higher than the current one
Example: If current is 1, use 2 or higher

Error: "Package name doesn't match"

Your android.package in app.json must exactly match your existing app's package name
Verify the package name in Play Console or your app's Play Store URL

EAS Build Fails

Make sure you've run eas login
Check that app.json is properly formatted (valid JSON)
Ensure all required fields are present in app.json


Summary Checklist

 Found existing app's package name
 Created new keystore (keystore.jks)
 Exported PEM certificate (upload_certificate.pem)
 Requested upload key reset in Play Console
 Waited 48 hours for approval
 Installed EAS CLI and logged in
 Updated android.package to match existing package name
 Set android.versionCode higher than current version
 Configured keystore in EAS or locally
 Built app with eas build --platform android
 Downloaded .aab file from EAS dashboard
 Uploaded to Google Play Console Production track
 Added release notes
 Started rollout to production
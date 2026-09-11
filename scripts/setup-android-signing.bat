@echo off
echo 🔑 Setting up Android signing for production builds...

REM Create android directory if it doesn't exist
if not exist "apps\mobile\android\app" mkdir "apps\mobile\android\app"

REM Generate keystore (you'll be prompted for passwords)
echo 📝 Generating Android keystore...
echo ⚠️  Remember the passwords you enter - you'll need them for GitHub secrets!

REM Try to find keytool in common Java installation paths
set KEYTOOL_PATH=""
if exist "C:\Program Files\Eclipse Adoptium\jdk-21*\bin\keytool.exe" (
    for /d %%i in ("C:\Program Files\Eclipse Adoptium\jdk-21*") do set KEYTOOL_PATH="%%i\bin\keytool.exe"
)
if exist "C:\Program Files\Java\jdk*\bin\keytool.exe" (
    for /d %%i in ("C:\Program Files\Java\jdk*") do set KEYTOOL_PATH="%%i\bin\keytool.exe"
)

if %KEYTOOL_PATH%=="" (
    echo ❌ Could not find keytool. Please add Java bin directory to PATH.
    echo Java is installed but keytool is not accessible.
    pause
    exit /b 1
)

echo Using keytool from: %KEYTOOL_PATH%

%KEYTOOL_PATH% -genkeypair -v -storetype PKCS12 ^
  -keystore apps\mobile\android\app\my-upload-key.keystore ^
  -alias my-key-alias ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000 ^
  -dname "CN=Tap2Go, OU=Mobile, O=Tap2Go, L=City, S=State, C=US"

echo.
echo ✅ Keystore generated successfully!
echo.
echo 🔐 Next steps:
echo 1. Add these secrets to your GitHub repository:
echo    - ANDROID_STORE_PASSWORD (keystore password)
echo    - ANDROID_KEY_PASSWORD (key password)
echo.
echo 2. Go to GitHub → Settings → Secrets and variables → Actions
echo 3. Add the passwords you just entered
echo.
echo 🚀 Your Android signing is now ready for production builds!
pause

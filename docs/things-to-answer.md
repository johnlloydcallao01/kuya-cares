Please ask your friend for the following information:

### 1. The Exact Package Name (Application ID)
- **What it is:** The unique identifier of the app (for example: `com.oldcompany.oldapp`).
- **Why we need it:** Our new code must be renamed to match this exact package name before we can upload it as an update.
- **Answer:** `com.wnapp.id1721090048598`

### 2. The Next Version Code
- **What it is:** A whole number representing the release version (for example: if the current version on the Play Store is `12`, we need to set ours to `13`).
- **Why we need it:** Google Play requires every update to have a `versionCode` that is strictly higher than the previous one. Please check the current Version Code on the Play Console and give me the next number up.
- **Answer:** `16`

### 3. The Keystore File (Upload Key / Signing Key)
- **What it is:** A digital signature file (usually ending in `.jks` or `.keystore`) that was used to sign the previous releases of the app.
- **Why we need it:** Google Play will immediately reject the update if it is not signed with the exact same key as the original app.
- **Answer:** `c:\Users\User\Desktop\tap2go\keys\keystore.jks`

### 4. Keystore Credentials
Along with the keystore file, we need the exact credentials used to unlock it:
- **Store Password:** `Tap2Go2026!Secure`
- **Key Alias:** `upload`
- **Key Password:** `Tap2Go2026!Secure`
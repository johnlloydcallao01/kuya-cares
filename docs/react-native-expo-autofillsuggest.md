# React Native Expo Autofill Suggestion Implementation Plan (Android Only)

## Objective
Enable secure, native credential saving and autofill suggestions for the `apps/mobile-customer` login screen on Android devices. This ensures a seamless login experience by leveraging the **Android Autofill Framework**.

## Implementation Phases

### Phase 1: Code Modifications (LoginScreen.tsx)
**Target File:** `apps/mobile-customer/src/screens/auth/LoginScreen.tsx`

- [x] **Review Current Implementation:** Analyze the existing `TextInput` components and parent containers.
- [x] **Configure Email Input Props:**
    - [x] Set `autoComplete="email"` (Critical for Android)
    - [x] Set `keyboardType="email-address"`
    - [x] Set `importantForAutofill="yes"` (Explicitly tells Android API 26+ this field is important)
    - [x] Set `textContentType="emailAddress"` (iOS fallback / standard compliance)
- [x] **Configure Password Input Props:**
    - [x] Set `autoComplete="current-password"` (Standard for login forms)
    - [x] Set `secureTextEntry={true}`
    - [x] Set `importantForAutofill="yes"`
    - [x] Set `textContentType="password"`
- [x] **Verify Container Structure:**
    - [x] Ensure inputs are direct children of a View/KeyboardAvoidingView without unnecessary nesting.
    - [x] *Optimization:* Avoid deep nesting inside `KeyboardAvoidingView` to improve autofill node recognition.

### Phase 2: Server-Side Configuration (Mandatory for Reliable Autofill)
**Target:** Website Version Domain (`https://app.tap2goph.com`)

*Note: Even for purely mobile apps, Google Password Manager requires this association to trust the app and reliably show the "Save Password" prompt. We host this on the web-app domain to allow future credential sharing.*

- [ ] **Get the Correct SHA-256 Fingerprint:**
    -   **Crucial:** Do NOT use your local keystore if you are using **Google Play App Signing** (default for modern apps).
    -   Go to **Google Play Console** -> **Release** -> **Setup** -> **App Integrity**.
    -   Copy the **SHA-256 certificate fingerprint** from the **App signing key certificate** section.
- [ ] **Create Digital Asset Links File:**
    -   Create a file named `assetlinks.json`.
    -   Content must includes your package name and the SHA-256 fingerprint from above.
    ```json
    [{
      "relation": ["delegate_permission/common.get_login_creds"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.wnapp.id1721090048598",
        "sha256_cert_fingerprints": ["F8:D2:11:7A:67:C8:AD:17:C1:FA:CA:19:2E:46:25:DC:3B:5F:B1:E4:68:99:54:5C:CF:6A:A3:5F:B3:F4:B2:D4"]
      }
    }]
    ```
- [ ] **Deploy:** Host at `https://app.tap2goph.com/.well-known/assetlinks.json`.
    -   *Why?* This allows Google Password Manager to securely associate credentials with your app.

### Phase 3: Configuration (app.json)
**Target File:** `apps/mobile-customer/app.json`

- [ ] **Verify Android Package Name:** Ensure `android.package` matches the one in `assetlinks.json` (e.g., `com.wnapp.id1721090048598`).
    -   *Note:* Do **NOT** add `associatedDomains` or `webcredentials` to the `android` section of `app.json`. That is an **iOS-only** configuration. For Android, the `assetlinks.json` file on your server (Phase 2) is all that is required.

### Phase 4: Build & Deployment
**Target:** Expo EAS (Android)

- [ ] **Commit Changes:** Ensure all local changes are committed to Git.
- [ ] **Trigger EAS Build:** Run `eas build --platform android --profile production`.
    -   *Warning:* **Expo Go will NOT work.** Autofill requires the app to be signed with the certificate matching `assetlinks.json`.
- [ ] **Install & Verify:**
    -   Install the build on a physical Android device (Android 8.0 / API 26+ required).
    -   **Test Case 1 (Google Autofill):** Login successfully -> Check if Google Password Manager asks to save credentials.
    -   **Test Case 2 (Samsung Pass):** Test on a Samsung device if possible, as implementation can vary.
    -   **Test Case 3:** Logout -> Tap email field -> Verify "Use saved password" suggestion appears.

## Known Issues & Workarounds

1.  **`react-native-screens` / React Navigation Bug:**
    -   **Issue:** Autofill often fails (showing "Content can't be autofilled") due to how screens are detached/attached in the native hierarchy.
    -   **Actionable Workarounds (Try in order if standard implementation fails):**
        1.  **State-based Mounting:** Render the `TextInput` components inside a `useEffect` after a small delay (e.g., 50-100ms) ensuring the screen transition is complete before the inputs mount.
        2.  **Width Hack:** Set `TextInput` width to `99%` on first render, then update to `100%` via state. This forces a layout pass that can re-register the view with the Autofill service.
        3.  **Editable Toggle:** Set `editable={false}` initially, then switch to `true` after mount.
2.  **Android API Level:**
    -   `importantForAutofill` and the Autofill Framework are only supported on **Android 8.0 (API 26)** and above.

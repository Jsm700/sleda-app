# Build Instructions for "Следа" (Sleda)

## Quick Start: Build APK for Field Testing

After cloning this repo from GitHub, run the following from the `frontend/` folder:

```bash
cd frontend
npm install -g eas-cli   # one-time, global install
eas login                # use your Expo account (free, sign up at expo.dev)
eas build -p android --profile preview
```

EAS will:
1. Upload the project to Expo's build servers (~30 sec).
2. Compile a standalone APK with all native modules (expo-location, expo-task-manager, react-native-maps).
3. Take 10-20 minutes for the first build (subsequent builds are faster due to caching).
4. Print a direct download URL when finished, e.g.
   `https://expo.dev/artifacts/eas/abc123.apk`.

Install the APK on your Android device:
- Enable "Install unknown apps" for your browser in Android Settings.
- Open the URL on your phone and tap install.

## Preview profile details

The `preview` profile in `eas.json` is configured for direct device install:
- `distribution: internal` - no Play Store, downloadable APK.
- `buildType: apk` - standalone APK (not AAB which is store-only).
- `EXPO_PUBLIC_BACKEND_URL` is baked in pointing to your Emergent preview backend.

## Optional: local build (no Expo account)

If you prefer a fully local build (requires Android Studio + SDK):

```bash
cd frontend
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

## Background GPS testing checklist on device

After installing the APK:

1. Open the app → grant **fine location** when prompted.
2. Press START → grant **"Allow all the time"** (NOT "While using the app").
3. Confirm the **"Следа · Записва маршрут"** notification appears in the status bar.
4. Lock the screen, walk around outside for 5-10 minutes.
5. Unlock → confirm the polyline and distance updated.
6. Press STOP → verify Alert "Маршрутът е запазен" → check Архив tab.

## Battery optimization warning (Samsung / Xiaomi / Huawei)

These OEMs aggressively kill background tasks. After install:
- Android Settings → Apps → Следа → Battery → "Unrestricted" (or "Don't optimize").
- On Samsung: also Settings → Battery and device care → Background usage limits → Never sleeping apps → add Следа.

Without this step the OS may kill the foreground service after ~20 minutes.

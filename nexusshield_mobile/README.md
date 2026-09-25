# NexusShield Personal AI Guard

Flutter + Rust FFI client for on-device PII firewall, BYOK vault, and Personal AI Guard.

Store identifiers: `com.nexusshield.guard` (Android `applicationId` and iOS `PRODUCT_BUNDLE_IDENTIFIER`).

## Store assets

From `nexusshield_mobile/`:

```bash
flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

(`flutter pub run …` still works; `dart run` is the current Flutter entry.)

Launcher icons use `assets/images/nexusshield-logo.png`. Native splash uses background `#0F172A` (`0xFF0F172A`) with the centered lockup.

## Android Play Console (AAB)

1. Create `android/key.properties` from `android/key.properties.example` **or** export:

   - `ANDROID_KEYSTORE_PATH`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

2. Generate an upload keystore once (do not commit `*.jks`):

```bash
keytool -genkey -v -keystore android/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

3. Release bundle:

```bash
flutter analyze
flutter build appbundle --release
```

Output: `build/app/outputs/bundle/release/app-release.aab`

If `key.properties` / env vars are missing, Gradle falls back to the debug keystore so local `--release` still compiles. Play uploads **must** use the upload keystore.

## iOS App Store / TestFlight (IPA)

On macOS with a valid Apple Development/Distribution team selected in Xcode:

```bash
flutter analyze
flutter build ipa --release
```

Archive: `build/ios/ipa/*.ipa`

Open `ios/Runner.xcworkspace` → Runner target → Signing & Capabilities → Team, then Product → Archive for Transporter / App Store Connect if you prefer Xcode.

Privacy strings in `ios/Runner/Info.plist`:

- Face ID: vault unlock
- Local network: on-device interceptor / runtime discovery

## Quality gate

```bash
flutter analyze
```

Must report no issues before a store build.

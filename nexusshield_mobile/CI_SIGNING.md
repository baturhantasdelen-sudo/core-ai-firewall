# NexusShield mobile — production signing & CI/CD

App: **`com.nexusshield.guard`** · Workflow: [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) (tags `v*.*.*`).

## GitHub Secrets checklist

### Android (Play Store AAB)

| Secret | Purpose |
|--------|---------|
| `ANDROID_KEYSTORE_BASE64` | Base64 of `android/app/upload-keystore.jks` (single line, no spaces) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEYSTORE_ALIAS` | Key alias (e.g. `upload-alias`) |
| `ANDROID_KEY_PASSWORD` | Alias password |
| `GOOGLE_PLAY_JSON_KEY_CONTENT` | Play Console service account JSON |
| `ANDROID_KEY_ALIAS` | Optional alias of `ANDROID_KEYSTORE_ALIAS` |

**CI behavior:** decode → `android/app/upload-keystore.jks` → write `android/key.properties` → `flutter build appbundle --release` (no debug fallback).

**Local encode (PowerShell):**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android/app/upload-keystore.jks")) | Set-Clipboard
```

### iOS (TestFlight / App Store)

| Secret | Purpose |
|--------|---------|
| `MATCH_GIT_URL` | Private certs repo (`https://…` or `git@…`; PAT in URL or use `MATCH_GIT_BASIC_AUTHORIZATION`) |
| `MATCH_PASSWORD` | Match encryption passphrase |
| `FASTLANE_TEAM_ID` | Apple Developer Team ID |
| `APP_STORE_CONNECT_API_KEY_KEY_ID` | ASC API Key ID |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | ASC issuer UUID |
| `APP_STORE_CONNECT_API_KEY_KEY` | `.p8` file body |
| `MATCH_GIT_BRANCH` | Optional (default `main`) |
| `MATCH_GITHUB_PAT` | **Recommended** — PAT with read access to match repo (workflow derives auth header) |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Optional Base64 `x-access-token:PAT` (skip if `MATCH_GITHUB_PAT` is set) |
| `MATCH_KEYCHAIN_NAME` | Optional (default `nexusshield-ci.keychain-db` in CI) |
| `MATCH_KEYCHAIN_PASSWORD` | Optional (CI generates random if unset; not the same as `MATCH_PASSWORD`) |

**CI behavior:** validate secrets → `fastlane ci_keychain` → `fastlane sign` (match **appstore**, readonly) → `flutter build ipa` → `fastlane deploy`.

Details: [ios/MATCH_SETUP.md](ios/MATCH_SETUP.md).

## Gradle / Fastlane entry points

| Platform | Config | CI lanes |
|----------|--------|----------|
| Android | `android/app/build.gradle.kts` | — (Gradle + Fastlane `deploy`) |
| iOS | `ios/fastlane/Fastfile` | `ci_keychain`, `sign`, `match_appstore`, `build`, `deploy`, `release` |

## Pre-release verification

1. All secrets set on GitHub (this checklist).
2. iOS match repo populated: local `bundle exec fastlane match appstore` once.
3. Tag push: `git tag v1.0.0 && git push origin v1.0.0`.
4. Actions: both jobs green; AAB not debug-signed; IPA has Apple Distribution identity before archive.

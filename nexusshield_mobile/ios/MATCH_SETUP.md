# Fastlane Match — NexusShield iOS (`com.nexusshield.guard`)

Private git repository stores **distribution certificate** and **App Store provisioning profile**. CI reads them in **readonly** mode; initial setup runs once on a trusted Mac.

## Checklist

### 1. Create the certificates repository

- [ ] Create a **private** empty repo (example: `nexusshield-ios-certificates`).
- [ ] Do **not** commit certificates manually — only `fastlane match` writes to this repo.

### 2. GitHub Actions secrets (repo → Settings → Secrets → Actions)

| Secret | Required | Example / notes |
|--------|----------|-----------------|
| `MATCH_GIT_URL` | **Yes** | `https://github.com/YOUR_ORG/nexusshield-ios-certificates.git` (or embed PAT: `https://x-access-token:ghp_xxx@github.com/...`) |
| `MATCH_PASSWORD` | **Yes** | Strong passphrase used to encrypt files in the match repo |
| `FASTLANE_TEAM_ID` | **Yes** | 10-character Apple Developer Team ID |
| `MATCH_GIT_BRANCH` | No | Default `main` |
| `MATCH_GIT_BASIC_AUTHORIZATION` | If needed | Base64 of `x-access-token:GITHUB_PAT` for HTTPS clone without token in URL |
| `APP_STORE_CONNECT_API_KEY_KEY_ID` | **Yes** | App Store Connect API key |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | **Yes** | Issuer UUID |
| `APP_STORE_CONNECT_API_KEY_KEY` | **Yes** | Contents of `AuthKey_XXXXXX.p8` |

**`MATCH_GIT_URL` formats (pick one):**

```text
https://github.com/YOUR_ORG/nexusshield-ios-certificates.git
https://x-access-token:ghp_xxxx@github.com/YOUR_ORG/nexusshield-ios-certificates.git
git@github.com:YOUR_ORG/nexusshield-ios-certificates.git
```

If the URL has **no** embedded token, set `MATCH_GIT_BASIC_AUTHORIZATION`:

```bash
printf 'x-access-token:YOUR_GITHUB_PAT' | base64
```

Paste the output into the `MATCH_GIT_BASIC_AUTHORIZATION` secret.

### 3. One-time local bootstrap (writable match)

On macOS, from `nexusshield_mobile/ios`:

```bash
bundle install
export FASTLANE_TEAM_ID=XXXXXXXXXX
export MATCH_PASSWORD='your-match-encryption-password'
export MATCH_GIT_URL='https://github.com/YOUR_ORG/nexusshield-ios-certificates.git'
export APP_STORE_CONNECT_API_KEY_KEY_ID=...
export APP_STORE_CONNECT_API_KEY_ISSUER_ID=...
export APP_STORE_CONNECT_API_KEY_PATH=/path/to/AuthKey_XXXXXX.p8
bundle exec fastlane match appstore
```

This creates/uploads the App Store cert + profile for `com.nexusshield.guard`.

### 4. CI flow (tag `v*.*.*`)

Workflow job `build-ios` (see `.github/workflows/publish.yml`):

1. `fastlane ci_keychain`
2. `fastlane sign` or `fastlane match_appstore` (match **appstore**, **readonly** + `ExportOptions.plist`)
3. `fastlane unlock_keychain` + `flutter build ipa`
4. `fastlane deploy`

Fastlane reads **`ENV["MATCH_GIT_URL"]`** — there is no hardcoded repo URL in the project.

### 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `MATCH_GIT_URL is required` | Add secret `MATCH_GIT_URL` on GitHub; re-run workflow |
| `could not clone` / auth failed | PAT with `repo` scope; use `MATCH_GIT_BASIC_AUTHORIZATION` or token in HTTPS URL |
| `No code signing identities` | Run local `match appstore` once; verify `ci_keychain` → `sign` order in Actions |
| Wrong team | Set `FASTLANE_TEAM_ID` to the team that owns `com.nexusshield.guard` |

See also: [nexusshield_mobile/README.md](../README.md) (CI secrets table).

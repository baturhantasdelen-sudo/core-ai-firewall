# Fastlane Match — NexusShield iOS (`com.nexusshield.guard`)

Private **match git** repository stores the **distribution certificate** and **App Store provisioning profile**. CI reads them in **readonly** mode after a one-time **writable** bootstrap on a trusted Mac.

## Two repositories (do not confuse)

| Repository | Role |
|------------|------|
| **`baturhantasdelen-sudo/nexus-shield`** (remote `nexus-shield`) | App code + `.github/workflows/publish.yml`. CI runs on tags `v*.*.*`. |
| **Match certs repo** (`MATCH_GIT_URL`) | Encrypted certs/profiles only — written by `fastlane match`, not by hand. |

Secrets for CI live on **`nexus-shield`** → Settings → Secrets and variables → Actions.

## Passwords / keys (three different things)

| Name | Purpose |
|------|---------|
| **`MATCH_PASSWORD`** | Encrypts files **inside the match git repo**. Must be **identical** on Mac bootstrap and GitHub Secrets. |
| **`MATCH_KEYCHAIN_PASSWORD`** | Unlocks the **ephemeral CI macOS keychain** (`nexusshield-ci.keychain-db`). CI generates per run if unset — **not** `MATCH_PASSWORD`. |
| **`APP_STORE_CONNECT_API_KEY_*`** | App Store Connect API (`.p8` body in `APP_STORE_CONNECT_API_KEY_KEY`). Do **not** set `APP_STORE_CONNECT_API_KEY_PATH` in CI env (conflicts with Fastlane `api_key`). |

## GitHub Actions secrets (`nexus-shield`)

| Secret | Required | Notes |
|--------|----------|--------|
| `MATCH_GIT_URL` | **Yes** | Private match repo, e.g. `https://github.com/YOUR_ORG/nexusshield-ios-certificates.git` |
| `MATCH_PASSWORD` | **Yes** | Same string as Mac bootstrap |
| `FASTLANE_TEAM_ID` | **Yes** | Team that owns `com.nexusshield.guard` |
| `APP_STORE_CONNECT_API_KEY_KEY_ID` | **Yes** | ASC API Key ID |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | **Yes** | ASC issuer UUID |
| `APP_STORE_CONNECT_API_KEY_KEY` | **Yes** | Full `.p8` file contents |
| `MATCH_GITHUB_PAT` | **Required (CI)** | Fine-grained or classic PAT with **read** on the **match repo only** (e.g. `nexus-shield-match`). Used with `readonly: true` — **no push**, avoids 403. |
| `MATCH_GITHUB_PAT_WRITE` | Optional | **Write** PAT for CI bootstrap only. Set `NEXUS_MATCH_ALLOW_BOOTSTRAP=true` and unset/disable `NEXUS_MATCH_DISABLE_BOOTSTRAP`. Prefer Mac bootstrap instead. |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Optional | Base64 of `x-access-token:PAT` if you skip `MATCH_GITHUB_PAT` |
| `MATCH_GIT_BRANCH` | Optional | Default **`main`** in workflow + Fastfile |
| `MATCH_KEYCHAIN_NAME` | Optional | Default **`nexusshield-ci.keychain-db`** in CI |
| `MATCH_KEYCHAIN_PASSWORD` | Optional | CI auto-generates if empty |

### `MATCH_GIT_URL` + auth (pick one)

```text
https://github.com/YOUR_ORG/nexusshield-ios-certificates.git   + MATCH_GITHUB_PAT
https://x-access-token:TOKEN@github.com/YOUR_ORG/....git
git@github.com:YOUR_ORG/nexusshield-ios-certificates.git       (Mac SSH; CI prefers HTTPS + PAT)
```

Base64 header (alternative to `MATCH_GITHUB_PAT`):

```bash
printf 'x-access-token:YOUR_GITHUB_PAT' | base64
```

## One-time Mac bootstrap (writable match)

From `nexusshield_mobile/ios` on **macOS**:

```bash
bundle install

export FASTLANE_TEAM_ID=XXXXXXXXXX
export MATCH_PASSWORD='same-as-github-secret'
export MATCH_GIT_URL='https://github.com/YOUR_ORG/nexusshield-ios-certificates.git'
export MATCH_GIT_BRANCH='main'   # if your match repo uses main

export APP_STORE_CONNECT_API_KEY_KEY_ID='...'
export APP_STORE_CONNECT_API_KEY_ISSUER_ID='...'
export APP_STORE_CONNECT_API_KEY_KEY="$(cat /path/to/AuthKey_XXXXXX.p8)"

export MATCH_GITHUB_PAT='ghp_...'   # needs write access to match repo
```

If Apple reports **too many distribution certificates**, revoke an unused **Apple Distribution** cert in [Developer → Certificates](https://developer.apple.com/account/resources/certificates/list), then retry.

```bash
bundle exec fastlane match appstore
# equivalent lane: bundle exec fastlane match_appstore
```

Mac is not CI → `readonly` is **false** → creates/uploads App Store cert + profile for `com.nexusshield.guard`.

### Bootstrap success checks

1. New commit(s) on the **match** repo (not `nexus-shield`).
2. `security find-identity -v -p codesigning` shows **Apple Distribution**.
3. GitHub Secrets on **`nexus-shield`** match the Mac exports above (`MATCH_PASSWORD`, URL, branch, team, ASC keys).

## CI flow (after bootstrap)

Remote: **`git push nexus-shield main`** and **`git push nexus-shield vX.Y.Z`** (avoid `git push nexus-shield --tags` — monorepo has many unrelated tags).

Job `build-ios` runs **`bundle exec fastlane build`**, which:

1. Creates/unlocks CI keychain (`ci_keychain`)
2. **`sign`** → `match` **readonly**, imports into `MATCH_KEYCHAIN_NAME`, sets `ExportOptions.plist`
3. `flutter build ipa`
4. **`deploy`** → App Store Connect

CI env toggles:

| Variable | Effect |
|----------|--------|
| `NEXUS_MATCH_READONLY=true` | **Default in CI** — match only **clones/decrypts**; never pushes to match git (avoids 403 with read PAT) |
| `NEXUS_MATCH_DISABLE_BOOTSTRAP=true` | **Default in CI** — do not auto-retry with `readonly: false` |
| `NEXUS_MATCH_ALLOW_BOOTSTRAP=true` | Allow one writable retry; requires `MATCH_GITHUB_PAT_WRITE` |
| `NEXUS_MATCH_FORCE_GENERATE=true` | First run writable (needs write PAT) |
| `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_KEY_CONTENT` | Aliases for App Store Connect API secrets |

### PAT scopes (GitHub)

**CI read (`MATCH_GITHUB_PAT`):** target repository = **match certs repo** (not `nexus-shield` app repo). Permissions: **Contents: Read**.

**Bootstrap write (`MATCH_GITHUB_PAT_WRITE` or Mac):** same repo, **Contents: Read and write**. Classic PAT: `repo` scope on that private repo.

**Do not** use `GITHUB_TOKEN` for match — it only sees the workflow repo and will **403** when match lives in `nexus-shield-match`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `MATCH_GIT_URL is required` | Set secret on **`nexus-shield`** |
| `could not clone` / auth | `MATCH_GITHUB_PAT` or `MATCH_GIT_BASIC_AUTHORIZATION`; PAT not expired; repo URL correct |
| `readonly` + no code signing identity | Match repo missing valid **distribution cert + private key** — run Mac bootstrap; same `MATCH_PASSWORD` + branch |
| `api_key_path` vs `api_key` | Do not export `APP_STORE_CONNECT_API_KEY_PATH` in workflow job env |
| Wrong team | `FASTLANE_TEAM_ID` must match `com.nexusshield.guard` |

See also: [CI_SIGNING.md](../CI_SIGNING.md), [README.md](../README.md).

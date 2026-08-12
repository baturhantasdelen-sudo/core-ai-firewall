# Vercel OSS Outreach — Nexus Shield Gatekeeper

Copy-paste ready assets for `vercel/ai` (PR) and `vercel/next.js` (Issue).

---

## 1. Workflow — `.github/workflows/nexus-shield.yml`

See file in fork branch `feat/nexus-shield-security-gatekeeper`.

---

## 2. PR Title

```
feat(security): add Nexus Shield CI/CD gatekeeper for PII & secret leak prevention
```

## PR Body (vercel/ai)

## Summary

This PR adds a lightweight, PR-scoped security gatekeeper to prevent sensitive data from reaching the default branch.

[Nexus Shield](https://github.com/baturhantasdelen-sudo/nexus-shield-action) scans **only changed files in pull requests** for:

- **PII:** Turkish Identity Numbers (TCKN), credit card numbers, email addresses
- **Secrets:** OpenAI / Anthropic / Vercel API keys, AWS credentials, JWTs, private keys, and common hardcoded secret patterns

When a leak is detected, the action posts a structured PR comment with file, line, issue type, and masked preview — then fails the check (configurable).

## Motivation

Projects like `vercel/ai` and `vercel/next.js` are widely forked and extended by developers who frequently commit:

- `.env` files with real API keys
- Hardcoded `sk-proj-...` / `sk-ant-...` tokens in examples or tests
- Sample configs containing live credentials

Traditional SAST tools often add **3–5 minutes** to CI pipelines. Nexus Shield is designed for **edge-speed, diff-only scanning** with negligible workflow overhead — keeping maintainer review focused on real risk without slowing contributor velocity.

## Why Nexus Shield?

| Property | Detail |
|----------|--------|
| **Scope** | PR diff only — no full-repo scan on every push |
| **Latency** | Minimal; no external upload of source code |
| **False positives** | Skips `.env.example`, mocks, fixtures, and test files |
| **Developer UX** | Inline PR annotations + actionable Markdown report |
| **Adoption** | Published on [GitHub Marketplace](https://github.com/marketplace/actions/nexus-shield-security-gatekeeper) |
| **Ecosystem validation** | Recently accepted into [LangChain Security Documentation (#5246)](https://github.com/langchain-ai/langchain) |

## Changes

- Add `.github/workflows/nexus-shield.yml`
- Trigger on `pull_request` (`opened`, `synchronize`, `reopened`)
- Use `baturhantasdelen-sudo/nexus-shield-action@v1` with `fail-on-detection: true`

## How to test (for reviewers)

1. Open a draft PR from a branch that adds a file containing mock sensitive data, e.g.:

   ```txt
   OPENAI_API_KEY=sk-proj-1234567890abcdef1234567890abcdef
   ```

2. Confirm the **Nexus Shield Security Gatekeeper** check runs.
3. Verify a PR comment is posted with masked findings.
4. Confirm the check fails until the sensitive value is removed.

To validate the happy path, push a clean PR with only documentation or code changes — the check should pass with no findings.

## Security & privacy notes

- The action scans PR content via the GitHub API; it does not send repository source to third-party services by default.
- Optional telemetry (`nexus-api-key`) is **disabled** in this workflow.
- Detected values are masked in PR comments.

## Checklist

- [x] Workflow runs only on pull requests
- [x] Minimal permissions (`contents: read`, `pull-requests: write`)
- [x] No changes to build, test, or release pipelines
- [x] Uses pinned major version tag (`@v1`)

---

Happy to adjust trigger branches, required checks, or `fail-on-detection` behavior based on maintainer preference. Thank you for considering this — protecting downstream developers who build on Vercel's OSS stack is a high-leverage win with very low CI cost.

---

## Maintainer ping (PR or Issue comment)

```
Hi @vercel team, opened this PR/Issue to bring zero-latency PII & secret gatekeeping to the repo (as featured in LangChain docs #5246). Looking forward to your feedback!
```

---

## 3. Issue Title (vercel/next.js)

```
[Feature Request] Security Gatekeeper integration for AI/LLM secret leak prevention
```

## Issue Body (vercel/next.js)

See previous conversation template — full body in this file section below.

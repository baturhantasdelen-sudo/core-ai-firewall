# Cloudflare Cache & Routing Rules — Nexus Shield Dashboard

Apply these rules on the Cloudflare zone fronting `nexusshield.ai` / `nexus-shield-dashboard.vercel.app` (or your custom origin). Origin headers from `next.config.ts` and `/api/proof-verifier` align with this reference.

## Prerequisites (SSL / HTTPS — Rule 3)

In **Cloudflare Dashboard → SSL/TLS**:

| Setting | Value |
|---|---|
| Always Use HTTPS | **On** |
| Automatic HTTPS Rewrites | **On** |
| Minimum TLS Version | TLS 1.2 |
| SSL mode | Full (strict) when origin cert is valid |

These edge directives terminate HTTP→HTTPS redirects at Cloudflare and reduce origin **308** loops between Cloudflare and Next.js.

## Origin alignment (Next.js)

`next.config.ts` sets:

- `trailingSlash: false` — no trailing-slash URLs (matches Cloudflare canonical URLs)
- Long-cache headers for `/_next/static/*` and public media
- `/api/proof-verifier` GET returns `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`

---

## Rule 1 — Cache Next.js static assets & media

**Type:** Cache Rule (recommended) or Page Rule (legacy)

**Expression:**

```
(http.request.uri.path starts_with "/_next/static/") or
(http.request.uri.path eq "/favicon.ico") or
(http.request.uri.path eq "/logo.png") or
(http.request.uri.path matches ".*\\.(png|svg|jpg|jpeg|webp|ico|woff2)$")
```

**Settings:**

| Setting | Value |
|---|---|
| Cache eligibility | Eligible for cache |
| Edge TTL | 1 month |
| Browser TTL | 1 month |
| Respect origin Cache-Control | On (origin sends `immutable` for hashed chunks) |

### Terraform (Cache Rules)

```hcl
resource "cloudflare_ruleset" "nexus_static_cache" {
  zone_id     = var.cloudflare_zone_id
  name        = "Nexus Shield — static asset cache"
  description = "Long TTL for Next.js hashed static assets and public media"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules {
    action = "set_cache_settings"
    expression = "(http.request.uri.path starts_with \"/_next/static/\") or (http.request.uri.path eq \"/favicon.ico\") or (http.request.uri.path eq \"/logo.png\") or (http.request.uri.path matches \".*\\\\.(png|svg|jpg|jpeg|webp|ico|woff2)$\")"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 2592000 # 30 days
      }
      browser_ttl {
        mode    = "override_origin"
        default = 2592000
      }
    }
  }
}
```

---

## Rule 2 — Edge micro-cache for Proof Verifier API (GET only)

**Expression:**

```
(http.request.uri.path eq "/api/proof-verifier") and (http.request.method eq "GET")
```

**Settings:**

| Setting | Value |
|---|---|
| Cache eligibility | Eligible for cache |
| Edge TTL | Override origin — **60 seconds** |
| Browser TTL | Respect origin |
| Cache key — query string | **Include all query string parameters** |
| Cache key — headers | Include `Accept-Encoding` (via Vary) |

**Do not cache** POST / PUT / DELETE on this path (origin returns `Cache-Control: no-store`).

### Terraform (Cache Rules)

```hcl
resource "cloudflare_ruleset" "nexus_proof_verifier_microcache" {
  zone_id     = var.cloudflare_zone_id
  name        = "Nexus Shield — proof-verifier GET micro-cache"
  description = "60s edge cache for GET /api/proof-verifier"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules {
    action = "set_cache_settings"
    expression = "(http.request.uri.path eq \"/api/proof-verifier\") and (http.request.method eq \"GET\")"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 60
      }
      cache_key {
        custom_key {
          query_string {
            include = "*"
          }
        }
      }
    }
  }
}
```

---

## Rule 3 — Bypass cache for mutating API routes

**Expression:**

```
(http.request.uri.path starts_with "/api/") and
(http.request.method in {"POST" "PUT" "PATCH" "DELETE"})
```

**Settings:**

| Setting | Value |
|---|---|
| Cache eligibility | Bypass cache |

### Terraform

```hcl
resource "cloudflare_ruleset" "nexus_api_mutations_bypass" {
  zone_id     = var.cloudflare_zone_id
  name        = "Nexus Shield — bypass cache for API mutations"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules {
    action = "set_cache_settings"
    expression = "(http.request.uri.path starts_with \"/api/\") and (http.request.method in {\"POST\" \"PUT\" \"PATCH\" \"DELETE\"})"
    action_parameters {
      cache = false
    }
  }
}
```

---

## Verification checklist

1. `curl -I https://<domain>/_next/static/<chunk>.js` → `Cache-Control: public, max-age=31536000, immutable`
2. `curl -I "https://<domain>/api/proof-verifier"` → `Cache-Control: public, s-maxage=60, stale-while-revalidate=30` and `Vary: Accept-Encoding`
3. `curl -I -X POST https://<domain>/api/proof-verifier` → `Cache-Control: no-store`
4. Cloudflare Analytics → Cache hit rate should rise for `/_next/static/*` and GET `/api/proof-verifier`
5. No repeated **308** chains between `http://`, `https://`, and trailing-slash variants

## Related npm scripts

```bash
npm run build          # verify next.config headers compile
npm run disclosure:run-all   # unrelated batch jobs — do not cache at edge
```

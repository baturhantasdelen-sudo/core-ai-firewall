# DNS Fix — `DNS_PROBE_FINISHED_NXDOMAIN` on nexusshield.ai

## Root cause (confirmed via live diagnostics)

| Host | NS | A / CNAME | HTTP |
|---|---|---|---|
| `nexusshield.ai` (apex) | Cloudflare (`khalid`, `karina`) | **NONE** | `curl: (6) Could not resolve host` |
| `www.nexusshield.ai` | Cloudflare | **NONE** | NXDOMAIN |
| `api.nexusshield.ai` | Cloudflare | **A → 172.67.143.107** | Resolves |
| `nexus-shield-dashboard.vercel.app` | Vercel | Vercel anycast | **200 OK** `/docs/benchmark` |

The zone is delegated to Cloudflare, but **no web records exist for the apex or www hostnames**.
This is a registrar/Cloudflare DNS configuration gap — not a Next.js redirect loop.

`/docs/benchmark` works on the Vercel deployment URL today.

---

## Step 1 — Add domains in Vercel

**Vercel → Project `nexus-shield-dashboard` → Settings → Domains**

Add:

- `nexusshield.ai`
- `www.nexusshield.ai`

Vercel will show the required DNS targets (verify against table below).

---

## Step 2 — Cloudflare DNS records (paste these)

**Cloudflare → DNS → Records** for zone `nexusshield.ai`

| Type | Name | Content | Proxy | Notes |
|---|---|---|---|---|
| **CNAME** | `www` | `cname.vercel-dns.com` | **DNS only** (grey cloud) | Vercel requirement |
| **A** | `@` | `76.76.21.21` | **DNS only** (grey cloud) | Vercel apex anycast |
| **A** | `api` | *(keep existing)* | Proxied OK | Already working |

Alternative apex (Cloudflare CNAME flattening):

| Type | Name | Content | Proxy |
|---|---|---|---|
| **CNAME** | `@` | `cname.vercel-dns.com` | **DNS only** |

Do **not** point `@` or `www` at `api.nexusshield.ai` — that host serves the FastAPI backend, not the Next.js dashboard.

---

## Step 3 — Cloudflare SSL (after records propagate)

| Setting | Value |
|---|---|
| SSL/TLS mode | **Full (strict)** |
| Always Use HTTPS | **On** |
| Automatic HTTPS Rewrites | **On** |

See also: [cloudflare-rules.md](./cloudflare-rules.md)

---

## Step 4 — Vercel environment (after DNS propagates)

Set in **Vercel → Environment Variables → Production**:

```env
NEXT_PUBLIC_APP_URL=https://nexusshield.ai
NEXT_PUBLIC_REPORT_API_URL=https://nexusshield.ai
```

Until DNS is live, keep the working deployment origin:

```env
NEXT_PUBLIC_APP_URL=https://nexus-shield-dashboard.vercel.app
```

---

## Verification commands

```bash
# Windows PowerShell
Resolve-DnsName nexusshield.ai -Type A
Resolve-DnsName www.nexusshield.ai -Type CNAME
curl.exe -I https://nexusshield.ai/docs/benchmark
curl.exe -I https://www.nexusshield.ai/docs/benchmark   # should 308 → apex
```

Expected after fix:

- `nexusshield.ai` → A `76.76.21.21` or CNAME flatten to Vercel
- `www.nexusshield.ai` → CNAME `cname.vercel-dns.com`
- HTTP 200 on `https://nexusshield.ai/docs/benchmark`

---

## Codebase safeguards (already applied)

- `lib/site.ts` — `DEPLOYMENT_FALLBACK_URL` when apex DNS is missing; blocks API subdomain for doc links
- `vercel.json` — `www` → apex 301 redirect (active once www DNS exists)
- `next.config.ts` — no external redirects; cache headers only

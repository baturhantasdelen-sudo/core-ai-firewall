# Nexus Shield · Vercel Integration

Vercel Marketplace microservice for OAuth installation and automatic Nexus Shield environment variable injection.

## Architecture

```text
Vercel Marketplace Install
        │
        ▼
/api/auth/vercel/callback   (code → access_token)
        │
        ▼
Setup UI (/)                (pick Vercel project)
        │
        ▼
/api/setup POST             (inject NEXUS_SHIELD_* env vars)
        │
        ▼
Redirect back to Vercel dashboard
```

## Local development

```bash
cd packages/vercel-integration
cp .env.example .env.local
npm install
npm run dev
```

Dev server: http://localhost:3001

## Required environment variables

| Variable | Description |
| :--- | :--- |
| `VERCEL_CLIENT_ID` | Integration client ID from Vercel Integrations Console |
| `VERCEL_CLIENT_SECRET` | Integration client secret |
| `VERCEL_REDIRECT_URI` | OAuth callback URL (e.g. `http://localhost:3001/api/auth/vercel/callback`) |

## Injected project env vars

| Key | Value |
| :--- | :--- |
| `NEXUS_SHIELD_ENABLED` | `true` |
| `NEXUS_SHIELD_MASK_TCKN` | `true` |
| `NEXUS_SHIELD_MASK_CC` | `true` |
| `NEXUS_SHIELD_MASK_EMAIL` | `true` |
| `NEXUS_SHIELD_MASK_API_KEY` | `true` |

## Vercel Integration Console settings

1. **Redirect URL:** `https://your-domain.com/api/auth/vercel/callback`
2. **Scopes:** Projects (read/write), Environment Variables (write)
3. **Setup URL:** `https://your-domain.com/`

## API routes

| Route | Method | Purpose |
| :--- | :---: | :--- |
| `/api/auth/vercel/callback` | GET | OAuth code exchange + secure token cookie |
| `/api/setup` | GET | List Vercel projects for authenticated install |
| `/api/setup` | POST | Inject Nexus Shield env vars into selected project |

## License

MIT © Nexus Shield Team

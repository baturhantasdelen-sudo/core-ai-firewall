# Integration Requirements

## Required for pilot (minimum)

- Nexus Shield instance with Phase 3+ assurance persistence
- Organization API key
- `schema-assurance.sql` applied if using Supabase (`NEXUS_ASSURANCE_USE_SUPABASE=true`)

## Optional live Finance/ERP sandbox

| Variable | Description |
|----------|-------------|
| `NEXUS_ASSURANCE_USE_SUPABASE` | `true` for Postgres persistence |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `NEXUS_FINANCE_ERP_BASE_URL` | HTTPS sandbox base URL |
| `NEXUS_FINANCE_ERP_ENV` | `sandbox` or `test` (not `production`) |
| `NEXUS_HTTP_VERIFY_ALLOWLIST` | Hostname allowlist |
| `NEXUS_FINANCE_ERP_API_TOKEN` | Bearer token if required |
| `NEXUS_FINANCE_ERP_LIVE_TEST` | `true` to enable live read path |

## Customer deliverables

- Read-only invoice/refund status API or DB read replica
- Test tenant and sample invoice IDs
- Network allowlist for Nexus egress IP (if applicable)

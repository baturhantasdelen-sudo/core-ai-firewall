# Security and Data Handling (Pilot)

- Authentication: `x-nexus-api-key` / `x-api-key` → `organizations` row
- Tenant isolation: all verification/evidence/UAR queries scoped by `org_id`
- No client-controlled `record_type`
- Secrets: `NEXUS_FINANCE_ERP_API_TOKEN`, Supabase service role — server env only
- Data minimization: state hashes and structured diffs; avoid raw PII in evidence
- Read-only ERP: GET/HEAD only, allowlisted hosts, no redirects
- Hashes support integrity of **recorded** artifacts; they are not digital signatures

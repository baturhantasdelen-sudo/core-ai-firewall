# Pilot Technical Architecture

```
API Key → org_id
POST /api/v1/outcome/verify
  → (optional) async Finance ERP GET
  → runAssuranceEngine
  → persist (SQLite dev | Supabase when NEXUS_ASSURANCE_USE_SUPABASE=true)
GET /api/v1/proof/verification/{id}
  → verification + evidence + UAR + record_type
```

**Persistence:** `schema-assurance.sql` on Supabase Postgres; local `.data/nexus-assurance.sqlite` for dev.

**Trust boundary:** Agent/tool responses are not authoritative; adapters are read-only.

# Known Limitations (Pilot)

- Supabase persistence is **implemented in code**; live Postgres validation requires customer/project credentials and applied migration (integration gate).
- Live Finance/ERP HTTP reads are **BLOCKED BY CONFIGURATION** without sandbox env vars.
- Sync verification engine; ERP polling uses bounded async retries on the HTTP path only.
- SQLite dev store is not multi-instance HA.
- UAR signing is hash-integrity focused; not a qualified electronic signature.
- Website marketing IA may be on a separate commit from assurance backend.

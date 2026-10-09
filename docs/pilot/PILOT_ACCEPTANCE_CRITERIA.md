# Pilot Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | False success detected deterministically | `demoFinanceWrongAmount` / API mock fixture |
| 2 | VERIFIED only with matching authoritative state | Scenario A |
| 3 | Persisted proof survives restart (SQLite pilot) | `assurance-persistence.test.ts` |
| 4 | Cross-tenant IDOR denied | Persistence test |
| 5 | Proof Center shows REAL/DEMO from server | `record_type` in proof API |
| 6 | No proof on API/auth failure | UI error, no demo fallback |
| 7 | Live ERP | PASS only if sandbox configured; else BLOCKED BY CONFIGURATION |

Pilot sign-off requires customer witness of UC-1 with labeled DEMO or REAL proof.

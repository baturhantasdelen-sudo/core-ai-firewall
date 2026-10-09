# Customer Use Cases (Pilot)

## UC-1 — False success (primary)

**Intent:** Refund invoice for 50,000 TRY.  
**Tool:** HTTP 200 success.  
**Authoritative ERP/fixture:** 500,000 TRY or PENDING.  
**Result:** FAILED or UNVERIFIED, `false_success_detected: true`, persisted proof.

## UC-2 — Verified refund

Expected and observed state match → **VERIFIED**, DEMO or REAL provenance labeled.

## UC-3 — Blocked action with side effect

Policy BLOCK; post-check detects mutation → **BLOCKED** + post-block finding.

## UC-4 — Proof audit

Security/compliance reviewer loads `verification_id` in Proof Center with org API key; reviews evidence hash chain (integrity check, not signature).

# Demo Runbook (Deterministic)

## Prerequisites

- Org API key (`nex_…`)
- Local dashboard or deployed instance

## Steps

1. **False success (DEMO)**  
   `POST /api/v1/outcome/verify` with:
   - `mock_fixture: finance_wrong_refund`
   - `tool_response: { status_code: 200, body: "success" }`
   - Expected state: `refund_amount: 50000`, currency TRY

2. Note `verification_id` and `record_type: DEMO` in response.

3. Open Proof Center → **Persisted verification lookup** → enter ID + API key.

4. Confirm status **FAILED**, false success flag, diff on `refund_amount`.

5. Optional: **VERIFIED** demo with `mock_fixture: finance_verified_refund`.

Label all mock runs **DEMO** in customer-facing materials.

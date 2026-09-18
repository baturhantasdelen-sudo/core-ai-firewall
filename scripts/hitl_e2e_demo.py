#!/usr/bin/env python3
import json
import urllib.request

HOST = "http://127.0.0.1:8080"

pending_req = urllib.request.Request(
    f"{HOST}/v1/agent/action",
    data=json.dumps(
        {
            "tool_name": "read_invoice",
            "arguments": {"invoice_id": "INV-HITL-REJECT"},
            "user_prompt": "Bugun Ankara hava durumu nasil?",
            "tool_purpose": "Finansal fatura detaylarini okur.",
        }
    ).encode(),
    headers={
        "Content-Type": "application/json",
        "X-Nexus-Agent-Id": "agent-finance-01",
        "X-Session-Id": "hitl-reject-demo",
    },
    method="POST",
)
pending = json.loads(urllib.request.urlopen(pending_req, timeout=20).read().decode())
approval_id = pending["approval_id"]
print("PENDING:", json.dumps(pending, indent=2, ensure_ascii=False)[:800])

reject_req = urllib.request.Request(
    f"{HOST}/v1/agent/approval/decision",
    data=json.dumps(
        {
            "approval_id": approval_id,
            "decision": "REJECTED",
            "reviewer_notes": "Güvenlik ihlali gerekçesiyle insan denetçisi tarafından reddedildi.",
        }
    ).encode(),
    headers={
        "Content-Type": "application/json",
        "X-Nexus-Agent-Id": "agent-finance-01",
    },
    method="POST",
)
rejected = json.loads(urllib.request.urlopen(reject_req, timeout=20).read().decode())
print("\nREJECTED:", json.dumps(rejected, indent=2, ensure_ascii=False))

#!/usr/bin/env python3
import json
import sys
import urllib.error
import urllib.request

host = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
approval_id = sys.argv[2] if len(sys.argv) > 2 else "appr_55080847"

payload = {
    "approval_id": approval_id,
    "decision": "REJECTED",
    "reviewer_notes": "Güvenlik ihlali gerekçesiyle insan denetçisi tarafından reddedildi.",
}
req = urllib.request.Request(
    f"{host}/v1/agent/approval/decision",
    data=json.dumps(payload).encode(),
    headers={
        "Content-Type": "application/json",
        "X-Nexus-Agent-Id": "agent-finance-01",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=20) as response:
        print(json.dumps(json.loads(response.read().decode()), indent=2, ensure_ascii=False))
except urllib.error.HTTPError as exc:
    print(exc.read().decode())

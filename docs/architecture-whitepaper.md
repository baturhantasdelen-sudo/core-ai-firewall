# Architecture Design Document (ADD) & Whitepaper — Nexus Shield

**Audience:** CISO, enterprise security architecture, platform engineering  
**Scope:** Action Control Plane, UAR evidence, air-gapped deployment, self-healing edge  
**Status:** Open-source reference implementation (living document)

> **Know what your agents are allowed to do. Stop what they shouldn't. Prove what actually happened.**

Extended narrative: [ARCHITECTURE_WHITE_PAPER.md](./ARCHITECTURE_WHITE_PAPER.md) · Module map: [under-the-hood.md](./under-the-hood.md)

---

## 1. Design goals

| Goal | Mechanism |
|------|-----------|
| **Air-gapped guarantee** | Data plane (`nexus-runtime`) runs with `NEXUS_CLOUD_CONNECT=false` by default; governance and UAR sealing require no Nexus Cloud |
| **Zero telemetry** | No outbound product telemetry from `nexus/memory.py`, `nexus/evolution.py`, or `enterprise/data_plane_api.py` |
| **Tamper-evident receipts** | SHA-256 `evidence_hash` on every governed attempt (`ALLOW` and `BLOCK`) — integrity checking, not legal non-repudiation |
| **Self-auditing evolution** | Policy patches record before/after policy hashes locally (`POLICY_PATCH` audit entries) |

---

## 2. Logical architecture

```
┌──────────── Host / Agent / MCP Client ────────────┐
│  Intent + tool proposal                            │
└─────────────────────┬─────────────────────────────┘
                      │ POST /v1/intercept
┌─────────────────────▼─────────────────────────────┐
│  nexus sidecar (enterprise/data_plane_api.py)      │
│  RBAC → policy_engine → UAR → local ledger         │
└─────────────────────┬─────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │ Optional nexus-control     │  (license, SIEM fan-out — opt-in)
        └───────────────────────────┘
```

Reference deployment: [`nexus-reference-app/docker-compose.yml`](../nexus-reference-app/docker-compose.yml)

---

## 3. Air-gapped operation

- **Control plane optional:** `CloudPanelService` is not on the hot path when `NEXUS_AIRGAP=true`.
- **Local ledger:** `enterprise/data/uar_receipts.jsonl` (volume-mounted in Docker).
- **Verification:** `GET /v1/receipts/{id}/verify` recomputes hashes on-box.
- **Benchmark lane separated:** Harness scores ([`harness/`](../harness/)) do not substitute for production UAR proof — see [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md).

---

## 4. Self-healing edge — PBKDF2 + SQLite mirror

| Component | Path | Function |
|-----------|------|----------|
| Encrypted ledger | [`nexus/memory.py`](../nexus/memory.py) | PBKDF2-derived key + XOR stream seal; SQLite `memory.db` + `events.jsonl.enc` mirror |
| Policy evolution | [`nexus/evolution.py`](../nexus/evolution.py) | Threshold-driven patches to `policy.effective.yml`; snapshot + rollback |
| Key material | `nexus/data/.memory.key` | Generated locally, never transmitted |

**Hash-based self-auditing:** each patch records `before_hash`, `after_hash`, and `evidence_hash` in `policy_audits` (see `LocalMemoryLedger.record_policy_audit`). These are **tamper-evident action receipts (UAR)** — they demonstrate hash integrity over stored policy state. They do **not** constitute legal non-repudiation unless you add an external KMS/HSM or hardware signing layer.

### Threat model note (intent source)

Intent used for divergence analysis must be taken from the **user session** or a **trusted orchestrator boundary** (your app, IdP-attested context, signed workflow step). Text produced solely by a potentially **compromised agent** must not be treated as trusted intent for policy decisions.

Rollback command:

```bash
python -m nexus.evolution rollback
```

---

## 5. Trust boundaries

| Zone | Trust assumption |
|------|------------------|
| Sidecar process | Holds tenant RBAC secrets / bootstrap actor |
| Host agent | Untrusted — all tool calls intercepted |
| Nexus Cloud | Untrusted network — disabled by default |
| Harness benchmark | Public reproducibility — not authoritative for your fleet |

---

## 6. Compliance alignment (non-certifying)

- SOC 2 / ISO-oriented audit JSONL: [`enterprise/siem_exporter.py`](../enterprise/siem_exporter.py)
- Readiness checklist: [COMPLIANCE_READINESS.md](./COMPLIANCE_READINESS.md)
- OWASP GenAI / Agentic mappings in harness evidence exports

---

## 7. Related deliverables

| Artifact | Location |
|----------|----------|
| Enterprise pitch (EN/TR) | [ENTERPRISE_PITCH_AND_VISION.md](./ENTERPRISE_PITCH_AND_VISION.md) |
| Security benchmark transparency | [security-benchmarks.md](./security-benchmarks.md) |
| Integration snippets | [integration-quickstart.md](./integration-quickstart.md) |

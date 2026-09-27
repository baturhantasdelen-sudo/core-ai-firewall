"""
Enterprise SIEM exporter — interception events and Universal Action Receipts (UAR).

Formats Nexus Shield policy outcomes into structured JSON for Splunk, Datadog, and Elastic,
with mock webhook dispatch and compliance audit hooks.

Usage:
    python -m enterprise.siem_exporter --demo
    python -m enterprise.siem_exporter --demo --dispatch-mock
"""

from __future__ import annotations

import argparse
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Literal

logger = logging.getLogger("nexus.enterprise.siem")

EVENT_SCHEMA_VERSION = "1.0.0"
PRODUCT = "nexus_shield"
DEFAULT_VERIFY_BASE = "https://nexus-shield-dashboard.vercel.app/verify"

SiemVendor = Literal["canonical", "splunk", "datadog", "elastic"]

Severity = Literal["info", "low", "medium", "high", "critical"]

# Compliance hook identifiers (map to GRC evidence keys in harness/runners/compliance_exporter.py).
COMPLIANCE_HOOKS: dict[str, dict[str, str]] = {
    "soc2_cc7_2": {
        "framework": "SOC 2",
        "control_id": "CC7.2",
        "control_name": "Security event response — malicious agent actions",
    },
    "soc2_cc6_6": {
        "framework": "SOC 2",
        "control_id": "CC6.6",
        "control_name": "Logical access — excessive agency / tool abuse",
    },
    "iso_a_8_8": {
        "framework": "ISO 27001:2022",
        "control_id": "A.8.8",
        "control_name": "Management of technical vulnerabilities",
    },
    "iso_a_8_16": {
        "framework": "ISO 27001:2022",
        "control_id": "A.8.16",
        "control_name": "Monitoring activities — agent runtime interception",
    },
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _severity_from_decision(decision: str, risk_score: int) -> Severity:
    if decision == "BLOCK" or risk_score >= 85:
        return "critical"
    if decision in ("REQUIRE_APPROVAL", "READ_ONLY") or risk_score >= 65:
        return "high"
    if risk_score >= 40:
        return "medium"
    return "info"


def _verify_url(receipt: dict[str, Any], verify_base: str = DEFAULT_VERIFY_BASE) -> str:
    h = receipt.get("evidence_bundle_hash", "")
    rid = receipt.get("receipt_id", "")
    return f"{verify_base}?receipt_hash={h}&receipt_id={rid}"


def build_canonical_interception_event(
    *,
    evaluation: dict[str, Any],
    event_id: str | None = None,
    source: str = "nexus-shield-upstream-firewall",
    layer: str = "agent_action_governance",
    verify_base: str = DEFAULT_VERIFY_BASE,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Canonical JSON document for any SIEM vendor adapter."""
    receipt = evaluation.get("receipt") or {}
    decision = str(evaluation.get("decision", receipt.get("decision", "UNKNOWN")))
    risk = int(evaluation.get("risk_score", 0))
    eid = event_id or str(uuid.uuid4())

    event: dict[str, Any] = {
        "schema_version": EVENT_SCHEMA_VERSION,
        "event_id": eid,
        "@timestamp": receipt.get("timestamp") or utc_now_iso(),
        "product": PRODUCT,
        "event": {
            "kind": "alert" if decision == "BLOCK" else "event",
            "category": ["intrusion_detection", "ai_agent"],
            "type": ["denied"] if decision == "BLOCK" else ["info"],
            "action": "interception",
            "outcome": "failure" if decision == "BLOCK" else "success",
            "severity": _severity_from_decision(decision, risk),
        },
        "nexus_shield": {
            "layer": layer,
            "source": source,
            "decision": decision,
            "rule_id": evaluation.get("rule_id"),
            "risk_score": risk,
            "violations": evaluation.get("violations") or [],
            "agent_id": (receipt.get("agent") or {}).get("id"),
            "user_intent": receipt.get("intent"),
            "proposed_tool": (receipt.get("proposed_action") or {}).get("tool"),
            "proposed_params": (receipt.get("proposed_action") or {}).get("params"),
        },
        "universal_action_receipt": receipt,
        "cryptography": {
            "evidence_bundle_sha256": receipt.get("evidence_bundle_hash"),
            "receipt_id": receipt.get("receipt_id"),
            "independent_verify_url": _verify_url(receipt, verify_base) if receipt.get("receipt_id") else None,
            "execution_before_hash": (receipt.get("execution_state") or {}).get("before_hash"),
            "execution_after_hash": (receipt.get("execution_state") or {}).get("after_hash"),
        },
    }
    if extra:
        event["extensions"] = extra
    return event


def build_canonical_uar_event(
    receipt: dict[str, Any],
    *,
    event_id: str | None = None,
    source: str = "nexus-shield-uAR-seal",
    verify_base: str = DEFAULT_VERIFY_BASE,
) -> dict[str, Any]:
    """UAR-focused canonical event (receipt already sealed)."""
    decision = str(receipt.get("decision", "UNKNOWN"))
    eid = event_id or str(uuid.uuid4())
    return {
        "schema_version": EVENT_SCHEMA_VERSION,
        "event_id": eid,
        "@timestamp": receipt.get("timestamp") or utc_now_iso(),
        "product": PRODUCT,
        "event": {
            "kind": "event",
            "category": ["authentication", "ai_agent"],
            "type": ["creation"],
            "action": "uar_sealed",
            "outcome": "success",
            "severity": _severity_from_decision(decision, 100 if decision == "BLOCK" else 50),
        },
        "nexus_shield": {
            "source": source,
            "decision": decision,
            "rule_id": (receipt.get("policy_evaluated") or {}).get("rule_id"),
        },
        "universal_action_receipt": receipt,
        "cryptography": {
            "evidence_bundle_sha256": receipt.get("evidence_bundle_hash"),
            "receipt_id": receipt.get("receipt_id"),
            "independent_verify_url": _verify_url(receipt, verify_base),
        },
    }


def format_for_splunk(canonical: dict[str, Any]) -> dict[str, Any]:
    """Splunk HEC-friendly envelope (sourcetype + indexed fields)."""
    ns = canonical.get("nexus_shield") or {}
    crypto = canonical.get("cryptography") or {}
    return {
        "time": canonical.get("@timestamp"),
        "host": ns.get("agent_id") or "nexus-shield",
        "source": ns.get("source") or PRODUCT,
        "sourcetype": "nexus:shield:interception:json",
        "event": canonical,
        "fields": {
            "event_id": canonical.get("event_id"),
            "decision": ns.get("decision"),
            "rule_id": ns.get("rule_id"),
            "risk_score": ns.get("risk_score"),
            "receipt_id": crypto.get("receipt_id"),
            "evidence_bundle_sha256": crypto.get("evidence_bundle_sha256"),
            "severity": (canonical.get("event") or {}).get("severity"),
        },
    }


def format_for_datadog(canonical: dict[str, Any]) -> dict[str, Any]:
    """Datadog logs API shape (message + ddtags + attributes)."""
    ns = canonical.get("nexus_shield") or {}
    crypto = canonical.get("cryptography") or {}
    decision = ns.get("decision", "UNKNOWN")
    severity = (canonical.get("event") or {}).get("severity", "info")
    tags = [
        f"product:{PRODUCT}",
        f"decision:{decision}",
        f"severity:{severity}",
        f"rule_id:{ns.get('rule_id') or 'none'}",
    ]
    if ns.get("agent_id"):
        tags.append(f"agent_id:{ns['agent_id']}")
    return {
        "ddsource": "nexus-shield",
        "ddtags": ",".join(tags),
        "hostname": ns.get("agent_id") or "nexus-shield-runtime",
        "service": "nexus-shield-ai-firewall",
        "message": f"Nexus Shield interception decision={decision} receipt={crypto.get('receipt_id')}",
        "status": "error" if decision == "BLOCK" else "warn" if decision in ("READ_ONLY", "REQUIRE_APPROVAL") else "info",
        "attributes": canonical,
    }


def format_for_elastic(canonical: dict[str, Any]) -> dict[str, Any]:
    """Elastic ECS-oriented document."""
    ns = canonical.get("nexus_shield") or {}
    crypto = canonical.get("cryptography") or {}
    ev = canonical.get("event") or {}
    tool = ns.get("proposed_tool") or "unknown"
    return {
        "@timestamp": canonical.get("@timestamp"),
        "ecs": {"version": "8.11.0"},
        "event": {
            "id": canonical.get("event_id"),
            "kind": ev.get("kind"),
            "category": ev.get("category"),
            "type": ev.get("type"),
            "action": ev.get("action"),
            "outcome": ev.get("outcome"),
            "severity": _elastic_severity(ev.get("severity")),
        },
        "agent": {
            "id": ns.get("agent_id"),
            "type": "ai_agent",
        },
        "rule": {
            "id": ns.get("rule_id"),
            "name": "nexus_shield_adaptive_policy",
        },
        "threat": {
            "indicator": {
                "description": ", ".join(ns.get("violations") or []) or None,
            },
        },
        "nexus": {
            "shield": ns,
            "uar": canonical.get("universal_action_receipt"),
            "evidence_bundle_sha256": crypto.get("evidence_bundle_sha256"),
            "receipt_id": crypto.get("receipt_id"),
            "verify_url": crypto.get("independent_verify_url"),
        },
        "message": f"AI agent tool {tool} -> {ns.get('decision')}",
    }


def _elastic_severity(severity: str | None) -> int:
    return {"info": 1, "low": 2, "medium": 3, "high": 4, "critical": 5}.get(severity or "info", 1)


VENDOR_FORMATTERS: dict[SiemVendor, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "canonical": lambda x: x,
    "splunk": format_for_splunk,
    "datadog": format_for_datadog,
    "elastic": format_for_elastic,
}


def resolve_compliance_hooks(canonical: dict[str, Any]) -> list[str]:
    """Return compliance hook IDs that apply to this event."""
    ns = canonical.get("nexus_shield") or {}
    decision = ns.get("decision")
    hooks: list[str] = ["iso_a_8_16"]
    if decision == "BLOCK":
        hooks.extend(["soc2_cc7_2", "iso_a_8_8"])
    if ns.get("violations"):
        hooks.append("soc2_cc6_6")
    return sorted(set(hooks))


@dataclass
class ComplianceLogger:
    """Append-only compliance audit log with control mapping."""

    audit_path: Path = field(default_factory=lambda: Path("enterprise/logs/siem_compliance_audit.jsonl"))
    hooks_catalog: dict[str, dict[str, str]] = field(default_factory=lambda: COMPLIANCE_HOOKS.copy())

    def log_event(self, canonical: dict[str, Any], *, hook_ids: list[str] | None = None) -> dict[str, Any]:
        hook_ids = hook_ids or resolve_compliance_hooks(canonical)
        record = {
            "logged_at_utc": utc_now_iso(),
            "event_id": canonical.get("event_id"),
            "compliance_hooks": [
                {"hook_id": hid, **self.hooks_catalog[hid]} for hid in hook_ids if hid in self.hooks_catalog
            ],
            "decision": (canonical.get("nexus_shield") or {}).get("decision"),
            "evidence_bundle_sha256": (canonical.get("cryptography") or {}).get("evidence_bundle_sha256"),
            "receipt_id": (canonical.get("cryptography") or {}).get("receipt_id"),
        }
        self.audit_path.parent.mkdir(parents=True, exist_ok=True)
        with self.audit_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        logger.info("Compliance audit record appended | event_id=%s hooks=%s", record["event_id"], hook_ids)
        return record


@dataclass
class MockWebhookDispatcher:
    """
    Mock SIEM webhook dispatch — records payloads without requiring live Splunk/Datadog/Elastic endpoints.

    Set mock=False and webhook_url to perform a real HTTP POST (optional).
    """

    mock: bool = True
    webhook_url: str | None = None
    timeout_sec: float = 10.0
    sent_payloads: list[dict[str, Any]] = field(default_factory=list)

    def dispatch(self, vendor: SiemVendor, payload: dict[str, Any]) -> dict[str, Any]:
        envelope = {
            "dispatched_at_utc": utc_now_iso(),
            "vendor": vendor,
            "mock": self.mock,
            "payload": payload,
        }
        self.sent_payloads.append(envelope)

        if self.mock or not self.webhook_url:
            nested = payload.get("event") if isinstance(payload.get("event"), dict) else {}
            event_id = (
                payload.get("event_id")
                or (payload.get("attributes") or {}).get("event_id")
                or nested.get("event_id")
            )
            logger.info("Mock SIEM webhook | vendor=%s event_id=%s", vendor, event_id)
            return {**envelope, "http_status": None, "success": True, "mode": "mock"}

        try:
            import requests  # lazy — optional path

            response = requests.post(
                self.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout_sec,
            )
            response.raise_for_status()
            return {**envelope, "http_status": response.status_code, "success": True, "mode": "live"}
        except Exception as exc:  # noqa: BLE001 — enterprise sink must not crash caller
            logger.error("SIEM webhook failed | vendor=%s error=%s", vendor, exc)
            return {**envelope, "http_status": None, "success": False, "mode": "live", "error": str(exc)}


@dataclass
class SiemExporter:
    """Format policy outcomes and dispatch to SIEM vendors."""

    verify_base: str = DEFAULT_VERIFY_BASE
    compliance: ComplianceLogger = field(default_factory=ComplianceLogger)
    dispatcher: MockWebhookDispatcher = field(default_factory=MockWebhookDispatcher)

    def format(
        self,
        evaluation: dict[str, Any],
        vendor: SiemVendor = "canonical",
        *,
        event_id: str | None = None,
        source: str = "nexus-shield-policy-engine",
    ) -> dict[str, Any]:
        canonical = build_canonical_interception_event(
            evaluation=evaluation,
            event_id=event_id,
            source=source,
            verify_base=self.verify_base,
        )
        formatter = VENDOR_FORMATTERS.get(vendor, VENDOR_FORMATTERS["canonical"])
        return formatter(canonical)

    def export_interception(
        self,
        evaluation: dict[str, Any],
        vendor: SiemVendor = "canonical",
        *,
        dispatch: bool = False,
        compliance_log: bool = True,
        **format_kwargs: Any,
    ) -> dict[str, Any]:
        canonical = build_canonical_interception_event(
            evaluation=evaluation,
            verify_base=self.verify_base,
            **{k: v for k, v in format_kwargs.items() if k in ("event_id", "source", "layer", "extra")},
        )
        formatter = VENDOR_FORMATTERS[vendor]
        payload = formatter(canonical)
        compliance_record = self.compliance.log_event(canonical) if compliance_log else None
        dispatch_result = self.dispatcher.dispatch(vendor, payload) if dispatch else None
        return {
            "canonical": canonical,
            "vendor": vendor,
            "payload": payload,
            "compliance_record": compliance_record,
            "dispatch_result": dispatch_result,
        }

    def export_uar(
        self,
        receipt: dict[str, Any],
        vendor: SiemVendor = "canonical",
        *,
        dispatch: bool = False,
        compliance_log: bool = True,
    ) -> dict[str, Any]:
        canonical = build_canonical_uar_event(receipt, verify_base=self.verify_base)
        payload = VENDOR_FORMATTERS[vendor](canonical)
        compliance_record = self.compliance.log_event(canonical) if compliance_log else None
        dispatch_result = self.dispatcher.dispatch(vendor, payload) if dispatch else None
        return {
            "canonical": canonical,
            "vendor": vendor,
            "payload": payload,
            "compliance_record": compliance_record,
            "dispatch_result": dispatch_result,
        }


def _demo_evaluation() -> dict[str, Any]:
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "harness"))
    from core.policy_engine import evaluate_proposed_action  # noqa: WPS433

    return evaluate_proposed_action(
        agent_id="siem-demo-agent-01",
        intent="Read-only invoice summary for #7742",
        tool="export_customer_database",
        params={"destination": "https://webhook.site/siem-demo-exfil", "format": "csv"},
        identity_verified=False,
    )


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")
    parser = argparse.ArgumentParser(description="Nexus Shield SIEM exporter demo")
    parser.add_argument("--demo", action="store_true", help="Run sample policy evaluation export")
    parser.add_argument("--dispatch-mock", action="store_true", help="Mock webhook dispatch for each vendor")
    parser.add_argument("--vendor", choices=["canonical", "splunk", "datadog", "elastic"], default="canonical")
    args = parser.parse_args()

    if not args.demo:
        parser.print_help()
        return 0

    evaluation = _demo_evaluation()
    exporter = SiemExporter(
        compliance=ComplianceLogger(audit_path=Path("enterprise/logs/siem_compliance_audit.jsonl")),
        dispatcher=MockWebhookDispatcher(mock=True),
    )

    result = exporter.export_interception(
        evaluation,
        vendor=args.vendor,
        dispatch=args.dispatch_mock,
    )
    print(json.dumps(result["payload"], indent=2, ensure_ascii=False))

    if args.dispatch_mock:
        for vendor in ("splunk", "datadog", "elastic"):
            r = exporter.export_interception(evaluation, vendor=vendor, dispatch=True, compliance_log=False)
            print(f"\n--- mock dispatch {vendor} success={r['dispatch_result']['success']} ---")

    crypto = result["canonical"].get("cryptography") or {}
    print(f"\nVerify URL: {crypto.get('independent_verify_url')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Phased Trojan Horse outreach dispatcher — 5 sets × 10 targets.

DEFAULT: --dry-run (log only). Use --send to transmit via Resend or SMTP.
Requires explicit confirmation between each set unless --skip-set-confirm (not recommended).
"""

from __future__ import annotations

import argparse
import json
import os
import smtplib
import ssl
import sys
import textwrap
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BATCH = ROOT / "results" / "trojan_outreach" / "outreach_batch_50.json"
DEFAULT_LOG = ROOT / "results" / "trojan_outreach" / "dispatch_log.json"

POSITIONING = "Agent Action Governance & Verification"
RUNTIME_BENCHMARK = "P99 runtime intercept: 6.1ms (Nexus benchmark harness)"
SET_SIZE = 10
SET_COUNT = 5

SAFETY_NOTICE = """
================================================================================
  NEXUS SHIELD - PHASED OUTREACH DISPATCHER
  Default mode: DRY-RUN (no messages sent). Pass --send to transmit.
================================================================================
"""


def load_batch(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    targets = data.get("targets") or []
    if len(targets) != SET_SIZE * SET_COUNT:
        raise SystemExit(
            f"Expected {SET_SIZE * SET_COUNT} targets in batch, found {len(targets)}. "
            f"Regenerate with scripts/generate_trojan_outreach_batch.py"
        )
    return data


def chunk_sets(targets: list[dict[str, Any]], size: int = SET_SIZE) -> list[list[dict[str, Any]]]:
    return [targets[i : i + size] for i in range(0, len(targets), size)]


def verification_url(base: str, evidence_hash: str, receipt_id: str) -> str:
    base = base.rstrip("/")
    return f"{base}?receipt_hash={evidence_hash}&receipt_id={receipt_id}"


def playground_url(base: str, evidence_hash: str) -> str:
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}evidence={evidence_hash}"


def resolve_recipient(row: dict[str, Any]) -> tuple[str | None, str | None, bool]:
    """Returns (recipient, intended_label, routed_via_override)."""
    target = row.get("target") or {}
    intended = (target.get("outreach_email") or "").strip() or None
    override = (
        os.environ.get("TROJAN_CAMPAIGN_RECIPIENT", "").strip()
        or os.environ.get("DISCLOSURE_OUTBOUND_RECIPIENT", "").strip()
        or None
    )
    if override:
        label = intended or target.get("contact_name") or target.get("company_name")
        return override, label, True
    return intended, intended, False


def build_message(row: dict[str, Any], *, verify_base: str, playground_base: str) -> dict[str, str]:
    target = row["target"]
    sim = row["simulation"]
    receipt = row["universal_action_receipt"]
    evidence_hash = row.get("evidence_bundle_sha256") or receipt["evidence_bundle_hash"]
    receipt_id = receipt["receipt_id"]
    company = target["company_name"]
    contact = target["contact_name"]
    vector = target["vulnerability_vector"]
    decision = sim["governance_decision"]
    hash_short = evidence_hash[:16]

    verify_link = verification_url(verify_base, evidence_hash, receipt_id)
    play_link = playground_url(playground_base, evidence_hash)

    subject = f"Confidential — {POSITIONING} Advisory for {company} (SHA-256: {hash_short}…)"

    text_body = textwrap.dedent(
        f"""
        Dear {contact},

        Nexus Shield completed a controlled simulation of {company}'s agent/MCP tool surface under our
        {POSITIONING} policy engine.

        Simulated finding: {vector}
        Governance outcome: {decision} — {RUNTIME_BENCHMARK}

        Universal Action Receipt
        - Receipt ID: {receipt_id}
        - Evidence bundle (SHA-256): {evidence_hash}

        Cryptographic Verification (Security Engines & Verification Playground):
        {verify_link}

        Interactive governance demo (sandbox):
        {play_link}

        Recommended next steps: Runtime Action Governance, Policy Enforcement, Universal Action Receipts,
        and GRC Evidence Bundles with Cryptographic Verification on every production tool invocation.

        Best regards,
        Nexus Shield Security Research
        https://nexusshield.ai/reports/state-of-agent-security-2026
        """
    ).strip()

    html_body = f"""\
<div style="font-family:Inter,Arial,sans-serif;color:#18181b;line-height:1.55;max-width:640px">
  <p>Dear {contact},</p>
  <p>Nexus Shield completed a controlled simulation of <strong>{company}</strong>'s agent/MCP tool surface
  under our <strong>{POSITIONING}</strong> policy engine.</p>
  <ul>
    <li><strong>Finding:</strong> {vector}</li>
    <li><strong>Governance outcome:</strong> {decision} — {RUNTIME_BENCHMARK}</li>
  </ul>
  <p><strong>Universal Action Receipt</strong><br/>
  Receipt ID: <code>{receipt_id}</code><br/>
  Evidence bundle (SHA-256): <code>{evidence_hash}</code></p>
  <p><a href="{verify_link}">Verify receipt &amp; evidence bundle</a> (Security Engines &amp; Verification Playground)</p>
  <p><a href="{play_link}">Open interactive governance sandbox</a></p>
  <p style="color:#71717a;font-size:12px;">Runtime Action Governance · Policy Enforcement · Cryptographic Verification</p>
  <p>Best regards,<br/>Nexus Shield Security Research</p>
</div>"""

    return {"subject": subject, "text": text_body, "html": html_body}


def send_resend(*, api_key: str, from_email: str, to: str, subject: str, html: str, text: str) -> dict[str, Any]:
    payload = json.dumps(
        {
            "from": from_email,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
            return {"ok": True, "message_id": body.get("id"), "provider": "resend"}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        try:
            parsed = json.loads(detail)
            msg = parsed.get("message") or detail
        except json.JSONDecodeError:
            msg = detail
        return {"ok": False, "error": msg, "provider": "resend"}
    except OSError as exc:
        return {"ok": False, "error": str(exc), "provider": "resend"}


def send_smtp(*, host: str, port: int, user: str, password: str, from_email: str, to: str, subject: str, html: str, text: str) -> dict[str, Any]:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=60) as server:
            server.starttls(context=context)
            if user:
                server.login(user, password)
            server.sendmail(from_email, [to], msg.as_string())
        return {"ok": True, "provider": "smtp"}
    except OSError as exc:
        return {"ok": False, "error": str(exc), "provider": "smtp"}


def dispatch_one(
    row: dict[str, Any],
    *,
    dry_run: bool,
    verify_base: str,
    playground_base: str,
    from_email: str,
) -> dict[str, Any]:
    company = row["target"]["company_name"]
    recipient, intended, routed = resolve_recipient(row)
    message = build_message(row, verify_base=verify_base, playground_base=playground_base)

    record: dict[str, Any] = {
        "company_name": company,
        "intended_recipient": intended,
        "recipient": recipient,
        "routed_via_override": routed,
        "subject": message["subject"],
        "verification_url": verification_url(
            verify_base,
            row["evidence_bundle_sha256"],
            row["universal_action_receipt"]["receipt_id"],
        ),
        "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": "dry_run" if dry_run else "send",
    }

    if dry_run:
        record["status"] = "logged"
        record["payload_preview"] = message["text"][:500] + ("…" if len(message["text"]) > 500 else "")
        return record

    if not recipient:
        record["status"] = "skipped"
        record["error"] = "No outreach_email on target and no TROJAN_CAMPAIGN_RECIPIENT override"
        return record

    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    smtp_host = os.environ.get("SMTP_HOST", "").strip()

    if resend_key:
        result = send_resend(
            api_key=resend_key,
            from_email=from_email,
            to=recipient,
            subject=message["subject"],
            html=message["html"],
            text=message["text"],
        )
    elif smtp_host:
        result = send_smtp(
            host=smtp_host,
            port=int(os.environ.get("SMTP_PORT", "587")),
            user=os.environ.get("SMTP_USER", "").strip(),
            password=os.environ.get("SMTP_PASSWORD", "").strip(),
            from_email=from_email,
            to=recipient,
            subject=message["subject"],
            html=message["html"],
            text=message["text"],
        )
    else:
        record["status"] = "failed"
        record["error"] = "Configure RESEND_API_KEY or SMTP_HOST for --send"
        return record

    if result.get("ok"):
        record["status"] = "sent"
        record["provider"] = result.get("provider")
        record["message_id"] = result.get("message_id")
    else:
        record["status"] = "failed"
        record["error"] = result.get("error")
        record["provider"] = result.get("provider")
    return record


def confirm_next_set(set_index: int, total_sets: int) -> bool:
    prompt = (
        f"\nSet {set_index}/{total_sets} complete. "
        f"Type YES to dispatch set {set_index + 1}, or anything else to stop: "
    )
    try:
        answer = input(prompt).strip()
    except EOFError:
        return False
    return answer.upper() == "YES"


def append_log(log_path: Path, entry: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    existing: list[Any] = []
    if log_path.is_file():
        existing = json.loads(log_path.read_text(encoding="utf-8"))
    existing.append(entry)
    log_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Phased outreach dispatcher (dry-run by default).")
    parser.add_argument("--batch-file", type=Path, default=DEFAULT_BATCH)
    parser.add_argument("--log-file", type=Path, default=DEFAULT_LOG)
    parser.add_argument(
        "--verify-base-url",
        default=os.environ.get("NEXUS_VERIFY_BASE_URL", "https://api.nexusshield.ai/verify"),
        help="Base URL for receipt verification links",
    )
    parser.add_argument(
        "--playground-url",
        default=os.environ.get(
            "NEXUS_PLAYGROUND_URL",
            "https://nexus-shield-dashboard.vercel.app/#attack-simulator",
        ),
        help="Security Engines & Verification Playground URL",
    )
    parser.add_argument("--from-email", default=os.environ.get("OUTBOUND_FROM_EMAIL", "Nexus Shield Security <info@nexusshield.ai>"))
    parser.add_argument("--set", type=int, choices=range(1, SET_COUNT + 1), help="Dispatch only this set (1-5)")
    parser.add_argument("--send", action="store_true", help="Actually send email (default: dry-run)")
    parser.add_argument("--skip-set-confirm", action="store_true", help="Do not pause for confirmation between sets")
    parser.add_argument("--inter-set-delay", type=int, default=0, help="Seconds to wait between sets (after confirm)")
    args = parser.parse_args()

    dry_run = not args.send
    print(SAFETY_NOTICE)
    print(f"Mode: {'DRY-RUN (logging only)' if dry_run else 'LIVE SEND via Resend/SMTP'}")
    if not dry_run:
        override = os.environ.get("TROJAN_CAMPAIGN_RECIPIENT") or os.environ.get("DISCLOSURE_OUTBOUND_RECIPIENT")
        if override:
            print(f"Recipient override active: {override}")

    batch = load_batch(args.batch_file.resolve())
    sets = chunk_sets(batch["targets"])
    if len(sets) != SET_COUNT:
        raise SystemExit(f"Expected {SET_COUNT} sets, got {len(sets)}")

    set_range = range(args.set - 1, args.set) if args.set else range(SET_COUNT)

    for set_idx in set_range:
        set_num = set_idx + 1
        rows = sets[set_idx]
        start = set_idx * SET_SIZE + 1
        end = start + len(rows) - 1
        print(f"\n--- Dispatching Set {set_num}/{SET_COUNT}: companies {start}-{end} ---")

        set_log: dict[str, Any] = {
            "set": set_num,
            "companies_range": [start, end],
            "dry_run": dry_run,
            "started_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "results": [],
        }

        for i, row in enumerate(rows, start=start):
            company = row["target"]["company_name"]
            print(f"  [{i}/50] {company} …", end=" ", flush=True)
            result = dispatch_one(
                row,
                dry_run=dry_run,
                verify_base=args.verify_base_url,
                playground_base=args.playground_url,
                from_email=args.from_email,
            )
            set_log["results"].append(result)
            status = result["status"]
            extra = ""
            if result.get("routed_via_override") and result.get("intended_recipient"):
                extra = f" (intended: {result['intended_recipient']})"
            if result.get("verification_url"):
                extra += f"\n      verify: {result['verification_url']}"
            print(f"{status}{extra}")
            if dry_run and result.get("payload_preview"):
                print(f"      preview: {result['payload_preview'][:120]}…")

        set_log["finished_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        append_log(args.log_file.resolve(), set_log)

        if set_idx != set_range.stop - 1 and not args.skip_set_confirm:
            if not confirm_next_set(set_num, SET_COUNT):
                print("Stopped by operator before next set.")
                break
            if args.inter_set_delay > 0:
                print(f"Waiting {args.inter_set_delay}s before next set…")
                time.sleep(args.inter_set_delay)

    print(f"\nLog appended: {args.log_file.resolve()}")
    if dry_run:
        print("DRY-RUN complete. Re-run with --send after human approval and recipient configuration.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

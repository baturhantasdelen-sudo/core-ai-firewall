"""Stdout proof banner for nexus runtime / enterprise demo containers."""

from __future__ import annotations

import os

ENGINE_VERSION = os.getenv("NEXUS_ENGINE_VERSION", "2.6")


def emit_proof_banner(port: int | None = None) -> None:
    listen_port = port or int(os.getenv("NEXUS_RUNTIME_PORT", "8090"))
    airgap = os.getenv("NEXUS_AIRGAP", "true").lower() in ("1", "true", "yes")
    airlock = "AIR-GAPPED AIRLOCK ACTIVE" if airgap else "CONNECTED MODE"
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║  [🛡️  Nexus Shield Engine v{ENGINE_VERSION}]                          ║
║  Status: {airlock:<44} ║
║  Action Firewall: LISTENING on port {listen_port:<23} ║
║  UAR Engine: SHA-256 tamper-evident receipts (local)         ║
║  -> Ready to intercept agent tool calls and seal             ║
║     Universal Action Receipts on-box.                        ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner, flush=True)

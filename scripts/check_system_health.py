#!/usr/bin/env python3
"""Inspect Nexus Shield container logs and emit system health / alert summary."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from collections import Counter
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_API_BASE = "https://api.nexusshield.ai"
CONTAINERS = ("nexus-api-prod", "nexus-shield-api-prod", "nginx-gateway-prod")
JSON_LOG_RE = re.compile(r"^\s*\{.*\}\s*$")


def _run(cmd: list[str]) -> tuple[int, str]:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return proc.returncode, (proc.stdout or "") + (proc.stderr or "")
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return 1, str(exc)


def docker_container_status(name: str) -> dict[str, Any]:
    code, out = _run(
        ["docker", "inspect", "--format", "{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}", name]
    )
    if code != 0:
        return {"name": name, "running": False, "status": "missing", "health": "unknown", "restarts": -1}
    parts = out.strip().split("|")
    status = parts[0] if parts else "unknown"
    health = parts[1] if len(parts) > 1 and parts[1] else "none"
    restarts = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
    return {
        "name": name,
        "running": status == "running",
        "status": status,
        "health": health,
        "restarts": restarts,
    }


def parse_docker_json_logs(container: str, tail: int = 500) -> list[dict[str, Any]]:
    code, out = _run(["docker", "logs", "--tail", str(tail), container])
    if code != 0:
        return []
    entries: list[dict[str, Any]] = []
    for line in out.splitlines():
        line = line.strip()
        if not JSON_LOG_RE.match(line):
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries


def analyze_logs(entries: list[dict[str, Any]]) -> dict[str, Any]:
    if not entries:
        return {
            "sample_count": 0,
            "error_rate_5xx_pct": 0.0,
            "dlp_block_count": 0,
            "avg_latency_ms": 0.0,
        }
    recent = entries[-100:]
    status_codes = [int(e["status_code"]) for e in recent if isinstance(e.get("status_code"), int)]
    latencies = [float(e["latency_ms"]) for e in recent if isinstance(e.get("latency_ms"), (int, float))]
    violations = [
        e
        for e in recent
        if e.get("decision") == "BLOCK"
        or e.get("violation_type")
        or (isinstance(e.get("status_code"), int) and e["status_code"] == 403)
    ]
    total = len(status_codes) or 1
    errors_5xx = sum(1 for code in status_codes if code >= 500)
    return {
        "sample_count": len(recent),
        "error_rate_5xx_pct": round(errors_5xx / total * 100.0, 2),
        "dlp_block_count": len(violations),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
    }


def fetch_json(url: str, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None) -> tuple[int, Any]:
    req_headers = {"Accept": "application/json", "User-Agent": "nexus-check-system-health/1.0"}
    if headers:
        req_headers.update(headers)
    req = Request(url, data=body, method=method, headers=req_headers)
    try:
        with urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read().decode("utf-8") if exc.fp else ""
        try:
            body = json.loads(raw) if raw else {"detail": exc.reason}
        except json.JSONDecodeError:
            body = {"detail": raw or exc.reason}
        return exc.code, body
    except URLError as exc:
        return 0, {"error": str(exc)}


def run_live_batch(base_url: str, requests_count: int = 10) -> dict[str, Any]:
    health_url = f"{base_url.rstrip('/')}/api/health"
    dlp_url = f"{base_url.rstrip('/')}/v1/agent/action"
    dlp_body = json.dumps({"tool_name": "export_customer_pii", "arguments": {}}).encode()
    dlp_headers = {
        "Content-Type": "application/json",
        "X-Nexus-Agent-Id": "agent-finance-01",
        "X-Session-Id": "health-check-batch",
    }

    health_status: Counter[int] = Counter()
    dlp_status: Counter[int] = Counter()
    health_latencies: list[float] = []
    dlp_latencies: list[float] = []

    for _ in range(requests_count):
        t0 = time.perf_counter()
        code, _ = fetch_json(health_url)
        health_latencies.append((time.perf_counter() - t0) * 1000)
        health_status[code] += 1

        t0 = time.perf_counter()
        code, _ = fetch_json(dlp_url, method="POST", body=dlp_body, headers=dlp_headers)
        dlp_latencies.append((time.perf_counter() - t0) * 1000)
        dlp_status[code] += 1

    return {
        "health": {
            "status_distribution": dict(health_status),
            "avg_latency_ms": round(sum(health_latencies) / len(health_latencies), 2),
        },
        "dlp": {
            "status_distribution": dict(dlp_status),
            "avg_latency_ms": round(sum(dlp_latencies) / len(dlp_latencies), 2),
        },
    }


def emit_alerts(report: dict[str, Any]) -> list[str]:
    alerts: list[str] = []
    log_stats = report.get("log_analysis", {})
    live = report.get("live_batch", {})
    containers = report.get("containers", [])

    if log_stats.get("error_rate_5xx_pct", 0) > 5:
        alerts.append(f"5xx error rate {log_stats['error_rate_5xx_pct']}% exceeds 5% threshold")
    avg_latency = live.get("health", {}).get("avg_latency_ms") or log_stats.get("avg_latency_ms", 0)
    if avg_latency > 1500:
        alerts.append(f"Average health latency {avg_latency}ms exceeds 1500ms threshold")
    for container in containers:
        if not container.get("running"):
            alerts.append(f"Container {container['name']} is not running (status={container.get('status')})")
        elif container.get("health") not in ("healthy", "none", ""):
            alerts.append(f"Container {container['name']} health={container.get('health')}")
        elif container.get("restarts", 0) > 3:
            alerts.append(f"Container {container['name']} restart count={container.get('restarts')}")

    for alert in alerts:
        print(f"[SYSTEM_ALERT] {alert}", file=sys.stderr)
    return alerts


def main() -> int:
    parser = argparse.ArgumentParser(description="Nexus Shield system health inspector")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--requests", type=int, default=10)
    parser.add_argument("--skip-docker", action="store_true")
    parser.add_argument("--skip-live", action="store_true")
    args = parser.parse_args()

    report: dict[str, Any] = {"api_base": args.api_base}

    if not args.skip_docker:
        report["containers"] = [docker_container_status(name) for name in CONTAINERS]
        all_logs: list[dict[str, Any]] = []
        for name in ("nexus-api-prod", "nexus-shield-api-prod"):
            all_logs.extend(parse_docker_json_logs(name))
        report["log_analysis"] = analyze_logs(all_logs)
        report["log_samples"] = all_logs[-3:]
    else:
        report["containers"] = []
        report["log_analysis"] = {}
        report["log_samples"] = []

    if not args.skip_live:
        code, health_body = fetch_json(f"{args.api_base.rstrip('/')}/api/health")
        report["live_health"] = {"status_code": code, "body": health_body}
        report["live_batch"] = run_live_batch(args.api_base, args.requests)

    alerts = emit_alerts(report)
    report["alerts"] = alerts
    print(json.dumps(report, indent=2))
    return 1 if alerts else 0


if __name__ == "__main__":
    raise SystemExit(main())

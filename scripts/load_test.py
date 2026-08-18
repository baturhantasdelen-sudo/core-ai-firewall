#!/usr/bin/env python3
"""Lightweight concurrent load test for Nexus Shield production endpoints."""

from __future__ import annotations

import argparse
import asyncio
import statistics
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

import httpx

DEFAULT_BASE_URL = "https://api.nexusshield.ai"
HEALTH_PATH = "/api/health"
DLP_PATH = "/v1/agent/action"
DLP_PAYLOAD = {"tool_name": "export_customer_pii", "arguments": {}}
DLP_HEADERS = {
    "Content-Type": "application/json",
    "X-Nexus-Agent-Id": "agent-finance-01",
    "X-Session-Id": "load-test-session",
}


@dataclass
class ScenarioResult:
    name: str
    latencies_ms: list[float] = field(default_factory=list)
    status_codes: Counter[int] = field(default_factory=Counter)
    errors: list[str] = field(default_factory=list)

    def record(self, status_code: int, latency_ms: float, error: str | None = None) -> None:
        self.latencies_ms.append(latency_ms)
        self.status_codes[status_code] += 1
        if error:
            self.errors.append(error)

    def summary(self) -> dict[str, Any]:
        latencies = self.latencies_ms or [0.0]
        total = sum(self.status_codes.values())
        elapsed_s = max(sum(latencies) / 1000.0, 0.001)
        return {
            "scenario": self.name,
            "requests": total,
            "status_distribution": dict(sorted(self.status_codes.items())),
            "errors": len(self.errors),
            "latency_ms": {
                "min": round(min(latencies), 2),
                "p50": round(statistics.median(latencies), 2),
                "p95": round(statistics.quantiles(latencies, n=20)[-1], 2) if len(latencies) > 1 else round(latencies[0], 2),
                "max": round(max(latencies), 2),
                "avg": round(statistics.mean(latencies), 2),
            },
            "throughput_rps": round(total / elapsed_s, 2),
        }


async def run_health(client: httpx.AsyncClient, url: str, result: ScenarioResult) -> None:
    started = time.perf_counter()
    try:
        response = await client.get(url)
        latency_ms = (time.perf_counter() - started) * 1000
        result.record(response.status_code, latency_ms)
    except Exception as exc:  # noqa: BLE001
        latency_ms = (time.perf_counter() - started) * 1000
        result.record(0, latency_ms, str(exc))


async def run_dlp(client: httpx.AsyncClient, url: str, result: ScenarioResult) -> None:
    started = time.perf_counter()
    try:
        response = await client.post(url, json=DLP_PAYLOAD, headers=DLP_HEADERS)
        latency_ms = (time.perf_counter() - started) * 1000
        result.record(response.status_code, latency_ms)
    except Exception as exc:  # noqa: BLE001
        latency_ms = (time.perf_counter() - started) * 1000
        result.record(0, latency_ms, str(exc))


async def run_scenario(
    *,
    name: str,
    url: str,
    concurrency: int,
    requests: int,
    runner,
) -> ScenarioResult:
    result = ScenarioResult(name=name)
    semaphore = asyncio.Semaphore(concurrency)

    async def worker(client: httpx.AsyncClient) -> None:
        async with semaphore:
            await runner(client, url, result)

    limits = httpx.Limits(max_connections=concurrency, max_keepalive_connections=concurrency)
    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(limits=limits, timeout=timeout, follow_redirects=True) as client:
        await asyncio.gather(*(worker(client) for _ in range(requests)))
    return result


def print_summary(results: list[ScenarioResult]) -> None:
    print("\n=== Nexus Shield Load Test Summary ===")
    for result in results:
        summary = result.summary()
        print(f"\n[{summary['scenario']}]")
        print(f"  Requests:            {summary['requests']}")
        print(f"  Throughput (req/s):  {summary['throughput_rps']}")
        print(f"  Status distribution: {summary['status_distribution']}")
        print(f"  Latency ms (min/p50/p95/max/avg): "
              f"{summary['latency_ms']['min']} / {summary['latency_ms']['p50']} / "
              f"{summary['latency_ms']['p95']} / {summary['latency_ms']['max']} / "
              f"{summary['latency_ms']['avg']}")
        if summary["errors"]:
            print(f"  Errors:              {summary['errors']}")
            for err in result.errors[:3]:
                print(f"    - {err}")

    health = next((r for r in results if r.name == "health"), None)
    dlp = next((r for r in results if r.name == "dlp"), None)
    print("\n=== Expectations ===")
    if health:
        ok = health.status_codes.get(200, 0)
        print(f"  Health 200 OK: {ok}/{sum(health.status_codes.values())}")
    if dlp:
        blocked = dlp.status_codes.get(403, 0)
        print(f"  DLP 403 BLOCK: {blocked}/{sum(dlp.status_codes.values())}")


async def main_async(args: argparse.Namespace) -> int:
    base = args.base_url.rstrip("/")
    health_url = f"{base}{HEALTH_PATH}"
    dlp_url = f"{base}{DLP_PATH}"

    print(f"Target: {base}")
    print(f"Concurrency: {args.concurrency}, requests per scenario: {args.requests}")

    started = time.perf_counter()
    health_result, dlp_result = await asyncio.gather(
        run_scenario(
            name="health",
            url=health_url,
            concurrency=args.concurrency,
            requests=args.requests,
            runner=run_health,
        ),
        run_scenario(
            name="dlp",
            url=dlp_url,
            concurrency=args.concurrency,
            requests=args.requests,
            runner=run_dlp,
        ),
    )
    elapsed = time.perf_counter() - started
    print_summary([health_result, dlp_result])
    print(f"\nTotal elapsed: {elapsed:.2f}s")

    health_ok = health_result.status_codes.get(200, 0) == args.requests
    dlp_ok = dlp_result.status_codes.get(403, 0) == args.requests
    return 0 if health_ok and dlp_ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Nexus Shield production load test")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--requests", type=int, default=20)
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()

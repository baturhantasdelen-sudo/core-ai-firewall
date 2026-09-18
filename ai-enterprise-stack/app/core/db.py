"""SQLite telemetry persistence for NexusShield and ResoNet."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

import aiosqlite

from app.core.config import Settings, get_settings

TELEMETRY_SCHEMA = """
CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    module TEXT NOT NULL,
    route TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    water_saved_ml REAL DEFAULT 0,
    energy_saved_wh REAL DEFAULT 0,
    redactions_count INTEGER DEFAULT 0,
    threat_detected TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    carbon_saved_g REAL DEFAULT 0,
    compression_ratio_pct REAL DEFAULT 0,
    output_redactions_count INTEGER DEFAULT 0,
    output_violation TEXT
);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_module ON telemetry(module);
"""

_WAL_PRAGMAS = (
    "PRAGMA journal_mode=WAL;",
    "PRAGMA synchronous=NORMAL;",
    "PRAGMA busy_timeout=5000;",
    "PRAGMA temp_store=MEMORY;",
)

_EXTRA_COLUMNS: tuple[tuple[str, str], ...] = (
    ("carbon_saved_g", "REAL DEFAULT 0"),
    ("compression_ratio_pct", "REAL DEFAULT 0"),
    ("output_redactions_count", "INTEGER DEFAULT 0"),
    ("output_violation", "TEXT"),
)


def _db_path(settings: Settings | None = None) -> Path:
    cfg = settings or get_settings()
    path = Path(cfg.telemetry_db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _apply_pragmas_sync(conn: sqlite3.Connection) -> None:
    for pragma in _WAL_PRAGMAS:
        conn.execute(pragma)


async def _apply_pragmas_async(db: aiosqlite.Connection) -> None:
    for pragma in _WAL_PRAGMAS:
        await db.execute(pragma)


async def _migrate_columns(db: aiosqlite.Connection) -> None:
    cursor = await db.execute("PRAGMA table_info(telemetry)")
    existing = {row[1] for row in await cursor.fetchall()}
    for name, ddl in _EXTRA_COLUMNS:
        if name not in existing:
            await db.execute(f"ALTER TABLE telemetry ADD COLUMN {name} {ddl}")


def _connect_sync(settings: Settings | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(settings), timeout=5.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _apply_pragmas_sync(conn)
    return conn


async def init_db(settings: Settings | None = None) -> None:
    """Create telemetry table, enable WAL mode, and apply migrations."""
    db_file = _db_path(settings)
    async with aiosqlite.connect(db_file, timeout=5.0) as db:
        await _apply_pragmas_async(db)
        await db.executescript(TELEMETRY_SCHEMA)
        await _migrate_columns(db)
        await db.commit()


async def log_telemetry(
    *,
    module: str,
    route: str,
    status_code: int,
    water_saved_ml: float = 0.0,
    energy_saved_wh: float = 0.0,
    redactions_count: int = 0,
    threat_detected: str | None = None,
    prompt_tokens: int = 0,
    carbon_saved_g: float = 0.0,
    compression_ratio_pct: float = 0.0,
    output_redactions_count: int = 0,
    output_violation: str | None = None,
    settings: Settings | None = None,
) -> int:
    """Persist a single telemetry row and return its primary key."""
    db_file = _db_path(settings)
    async with aiosqlite.connect(db_file, timeout=5.0) as db:
        await _apply_pragmas_async(db)
        cursor = await db.execute(
            """
            INSERT INTO telemetry (
                module, route, status_code, water_saved_ml, energy_saved_wh,
                redactions_count, threat_detected, prompt_tokens,
                carbon_saved_g, compression_ratio_pct,
                output_redactions_count, output_violation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                module,
                route,
                status_code,
                water_saved_ml,
                energy_saved_wh,
                redactions_count,
                threat_detected,
                prompt_tokens,
                carbon_saved_g,
                compression_ratio_pct,
                output_redactions_count,
                output_violation,
            ),
        )
        await db.commit()
        return cursor.lastrowid or 0


def get_recent_metrics(limit: int = 100, settings: Settings | None = None) -> list[dict[str, Any]]:
    """Return the most recent telemetry rows for dashboard audit logs."""
    with _connect_sync(settings) as conn:
        rows = conn.execute(
            """
            SELECT
                id, timestamp, module, route, status_code,
                water_saved_ml, energy_saved_wh, redactions_count,
                threat_detected, prompt_tokens, carbon_saved_g,
                compression_ratio_pct, output_redactions_count, output_violation
            FROM telemetry
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_kpi_summary(settings: Settings | None = None) -> dict[str, float | int]:
    """Aggregate KPI metrics for the command center header cards."""
    with _connect_sync(settings) as conn:
        row = conn.execute(
            """
            SELECT
                COALESCE(SUM(water_saved_ml), 0) AS total_water_ml,
                COALESCE(SUM(energy_saved_wh), 0) AS total_energy_wh,
                COALESCE(SUM(carbon_saved_g), 0) AS total_carbon_g,
                COALESCE(SUM(
                    CASE
                        WHEN threat_detected IS NOT NULL OR status_code = 400
                             OR output_violation IS NOT NULL THEN 1
                        ELSE 0
                    END
                ), 0) AS threats_blocked,
                COALESCE(SUM(CASE WHEN module = 'ResoNet' THEN 1 ELSE 0 END), 0) AS resonet_total,
                COALESCE(SUM(
                    CASE WHEN module = 'ResoNet' AND route = 'ollama-local' THEN 1 ELSE 0 END
                ), 0) AS resonet_local
            FROM telemetry
            """
        ).fetchone()

    resonet_total = int(row["resonet_total"])
    resonet_local = int(row["resonet_local"])
    local_pct = (resonet_local / resonet_total * 100.0) if resonet_total else 0.0

    return {
        "total_water_ml": float(row["total_water_ml"]),
        "total_energy_wh": float(row["total_energy_wh"]),
        "total_carbon_g": float(row["total_carbon_g"]),
        "threats_blocked": int(row["threats_blocked"]),
        "local_offload_pct": round(local_pct, 1),
    }


def get_cumulative_esg(settings: Settings | None = None) -> list[dict[str, Any]]:
    """Return cumulative water and energy savings ordered chronologically."""
    with _connect_sync(settings) as conn:
        rows = conn.execute(
            """
            SELECT timestamp, water_saved_ml, energy_saved_wh, carbon_saved_g
            FROM telemetry
            WHERE module = 'ResoNet'
            ORDER BY timestamp ASC, id ASC
            """
        ).fetchall()

    cumulative_water = 0.0
    cumulative_energy = 0.0
    cumulative_carbon = 0.0
    series: list[dict[str, Any]] = []
    for row in rows:
        cumulative_water += float(row["water_saved_ml"])
        cumulative_energy += float(row["energy_saved_wh"])
        cumulative_carbon += float(row["carbon_saved_g"])
        series.append(
            {
                "timestamp": row["timestamp"],
                "water_saved_ml": round(cumulative_water, 4),
                "energy_saved_wh": round(cumulative_energy, 6),
                "carbon_saved_g": round(cumulative_carbon, 6),
            }
        )
    return series


def get_route_distribution(settings: Settings | None = None) -> list[dict[str, Any]]:
    """Return ResoNet route counts for donut chart visualization."""
    with _connect_sync(settings) as conn:
        rows = conn.execute(
            """
            SELECT route, COUNT(*) AS count
            FROM telemetry
            WHERE module = 'ResoNet'
              AND route IN ('ollama-local', 'cloud-provider')
            GROUP BY route
            ORDER BY count DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_threat_breakdown(settings: Settings | None = None) -> list[dict[str, Any]]:
    """Return NexusShield threat category counts for bar chart visualization."""
    with _connect_sync(settings) as conn:
        row = conn.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN threat_detected IS NOT NULL THEN 1 ELSE 0 END), 0)
                    AS prompt_injection,
                COALESCE(SUM(
                    CASE WHEN redactions_count > 0 OR output_redactions_count > 0 THEN 1 ELSE 0 END
                ), 0) AS pii_leakage,
                COALESCE(SUM(
                    CASE WHEN output_violation IS NOT NULL THEN 1 ELSE 0 END
                ), 0) AS output_violation,
                COALESCE(SUM(
                    CASE WHEN status_code >= 500 THEN 1 ELSE 0 END
                ), 0) AS upstream_failure
            FROM telemetry
            WHERE module = 'NexusShield'
            """
        ).fetchone()

    return [
        {"category": "Prompt Injection", "incidents": int(row["prompt_injection"])},
        {"category": "PII/PHI Leakage", "incidents": int(row["pii_leakage"])},
        {"category": "Output Violation", "incidents": int(row["output_violation"])},
        {"category": "Upstream Failure", "incidents": int(row["upstream_failure"])},
    ]

"""Nexus Enterprise Command Center — executive AI security & ESG dashboard."""

from __future__ import annotations

import sys
from datetime import timedelta
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import os

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from app.core.db import (
    get_cumulative_esg,
    get_kpi_summary,
    get_recent_metrics,
    get_route_distribution,
    get_threat_breakdown,
)

# ── Design tokens ─────────────────────────────────────────────────────────────
CYAN = "#06B6D4"
EMERALD = "#10B981"
CRIMSON = "#EF4444"
AMBER = "#F59E0B"
SLATE = "#0B0F19"
GLASS = "rgba(17, 24, 39, 0.72)"
BORDER = "rgba(59, 130, 246, 0.22)"

PLOTLY_DARK = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(color="#94A3B8", family="Inter, Segoe UI, Roboto, sans-serif", size=12),
    hoverlabel=dict(bgcolor="#111827", bordercolor=BORDER, font_color="#F8FAFC", font_size=12),
    xaxis=dict(gridcolor="rgba(59,130,246,0.07)", zerolinecolor="rgba(59,130,246,0.07)", linecolor="#1E293B"),
    yaxis=dict(gridcolor="rgba(59,130,246,0.07)", zerolinecolor="rgba(59,130,246,0.07)", linecolor="#1E293B"),
    margin=dict(l=28, r=28, t=52, b=28),
    legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="rgba(0,0,0,0)"),
)

st.set_page_config(
    page_title="NexusShield & ResoNet — Enterprise Gateway",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    f"""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    .stApp {{
        background: linear-gradient(165deg, {SLATE} 0%, #0F172A 45%, #111827 100%);
        font-family: 'Inter', 'Segoe UI', sans-serif;
    }}

    [data-testid="stHeader"] {{ background: rgba(0,0,0,0); }}
    [data-testid="stToolbar"] {{ visibility: hidden; height: 0; }}

    .block-container {{
        padding-top: 1.2rem;
        max-width: 1400px;
    }}

    .exec-header {{
        background: {GLASS};
        border: 1px solid {BORDER};
        border-radius: 16px;
        padding: 1.5rem 1.75rem;
        margin-bottom: 1rem;
        box-shadow: 0 0 40px rgba(6, 182, 212, 0.06);
        backdrop-filter: blur(12px);
    }}

    .exec-title {{
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #F1F5F9;
        margin: 0.75rem 0 0.35rem 0;
        text-transform: uppercase;
    }}

    .exec-subtitle {{
        font-size: 0.82rem;
        color: #64748B;
        letter-spacing: 0.04em;
        margin: 0;
    }}

    .badge-bar {{
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        margin-top: 1rem;
    }}

    .badge {{
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        border: 1px solid {BORDER};
        background: rgba(15, 23, 42, 0.85);
    }}

    .badge-online {{ color: {EMERALD}; border-color: rgba(16, 185, 129, 0.35); }}
    .badge-wal    {{ color: {CYAN}; border-color: rgba(6, 182, 212, 0.35); }}
    .badge-region {{ color: #93C5FD; border-color: rgba(147, 197, 253, 0.25); }}
    .badge-policy {{ color: {AMBER}; border-color: rgba(245, 158, 11, 0.35); }}

    .kpi-card {{
        background: {GLASS};
        border: 1px solid {BORDER};
        border-radius: 14px;
        padding: 1.1rem 1.25rem;
        min-height: 118px;
        backdrop-filter: blur(10px);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }}

    .kpi-label {{
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748B;
        margin-bottom: 0.45rem;
    }}

    .kpi-value {{
        font-size: 1.65rem;
        font-weight: 800;
        line-height: 1.1;
        margin: 0;
    }}

    .kpi-cyan    {{ color: {CYAN}; }}
    .kpi-emerald {{ color: {EMERALD}; }}
    .kpi-crimson {{ color: {CRIMSON}; }}
    .kpi-amber   {{ color: {AMBER}; }}

    .section-head {{
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #475569;
        margin: 0.5rem 0 0.75rem 0;
    }}

    .policy-card {{
        background: {GLASS};
        border: 1px solid {BORDER};
        border-radius: 12px;
        padding: 1rem 1.15rem;
        margin-bottom: 0.55rem;
        font-size: 0.82rem;
        color: #CBD5E1;
    }}

    .policy-active {{ border-left: 3px solid {EMERALD}; }}
    .policy-alert  {{ border-left: 3px solid {AMBER}; }}

    div[data-testid="stTabs"] button {{
        font-weight: 700;
        letter-spacing: 0.04em;
        font-size: 0.78rem;
    }}

    .stDataFrame {{ border: 1px solid {BORDER}; border-radius: 12px; overflow: hidden; }}

    hr {{ border-color: rgba(59,130,246,0.12); }}
</style>
""",
    unsafe_allow_html=True,
)

def _plot_layout(title: str, height: int = 340) -> dict:
    layout = dict(PLOTLY_DARK)
    layout["title"] = dict(text=title, font=dict(size=13, color="#E2E8F0", family="Inter"), x=0)
    layout["height"] = height
    return layout


def _kpi_card(label: str, value: str, css_class: str) -> str:
    return f"""
    <div class="kpi-card">
        <div class="kpi-label">{label}</div>
        <p class="kpi-value {css_class}">{value}</p>
    </div>
    """


AUDIT_COLUMNS = [
    "Timestamp",
    "Module",
    "Route Target",
    "HTTP Status",
    "PII Reductions",
    "Carbon Saved (gCO₂eq)",
    "Compression %",
    "Threat / Violation",
    "Latency",
]

AUDIT_COLUMN_MAPPING = {
    "timestamp": "Timestamp",
    "module": "Module",
    "route": "Route Target",
    "status_code": "HTTP Status",
    "carbon_saved_g": "Carbon Saved (gCO₂eq)",
    "compression_ratio_pct": "Compression %",
    "pii_redactions_count": "PII Redactions",
    "output_redactions_count": "Output Redactions",
}


def _numeric_col(frame: pd.DataFrame, column: str) -> pd.Series | int:
    if column in frame.columns:
        return pd.to_numeric(frame[column], errors="coerce").fillna(0)
    return 0


def _ensure_audit_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Insert defaults for any expected audit column missing after SQL fetch/rename."""
    defaults: dict[str, object] = {
        "Timestamp": "—",
        "Module": "—",
        "Route Target": "—",
        "HTTP Status": 0,
        "PII Reductions": 0,
        "Carbon Saved (gCO₂eq)": 0.0,
        "Compression %": 0.0,
        "Threat / Violation": "—",
        "Latency": "—",
    }
    for col, default in defaults.items():
        if col not in frame.columns:
            frame[col] = default
        elif isinstance(default, float):
            frame[col] = pd.to_numeric(frame[col], errors="coerce").fillna(default)
        elif isinstance(default, int):
            frame[col] = pd.to_numeric(frame[col], errors="coerce").fillna(default).astype(int)
    return frame


def build_banner_html(grid_region: str) -> str:
    """Executive header banner HTML (render with unsafe_allow_html=True)."""
    return f"""
<div style="
    background: linear-gradient(135deg, rgba(17, 24, 39, 0.8), rgba(30, 41, 59, 0.8));
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
">
    <div style="display: flex; align-items: center; gap: 20px;">
        <div style="flex-shrink: 0;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z"
                      fill="url(#paint0_linear)" stroke="#06B6D4" stroke-width="1.5"/>
                <circle cx="12" cy="12" r="3" fill="#10B981"/>
                <path d="M12 9V15M9 12H15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
                <defs>
                    <linearGradient id="paint0_linear" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#0F172A" stop-opacity="0.9"/>
                        <stop offset="1" stop-color="#1E293B" stop-opacity="0.9"/>
                    </linearGradient>
                </defs>
            </svg>
        </div>
        <div>
            <div style="font-size: 24px; font-weight: 700; color: #F8FAFC; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">
                NexusShield <span style="color: #06B6D4;">&amp;</span> ResoNet Enterprise Gateway
            </div>
            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px; font-family: 'Inter', sans-serif;">
                Real-Time AI Infrastructure Security, Governance &amp; Thermodynamic Efficiency Suite
            </div>
        </div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px;">
        <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(16, 185, 129, 0.35); background: rgba(15, 23, 42, 0.85); color: #10B981;">● SYSTEM ONLINE</span>
        <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(6, 182, 212, 0.35); background: rgba(15, 23, 42, 0.85); color: #06B6D4;">● TELEMETRY ACTIVE (WAL MODE)</span>
        <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(147, 197, 253, 0.25); background: rgba(15, 23, 42, 0.85); color: #93C5FD;">REGION: {grid_region}-GRID</span>
        <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(245, 158, 11, 0.35); background: rgba(15, 23, 42, 0.85); color: #F59E0B;">● POLICY ENFORCED</span>
    </div>
</div>
"""


@st.cache_data(ttl=2)
def load_kpis() -> dict[str, float | int]:
    return get_kpi_summary()


@st.cache_data(ttl=2)
def load_audit_logs(limit: int = 100) -> pd.DataFrame:
    rows = get_recent_metrics(limit=limit)
    if not rows:
        return pd.DataFrame(columns=AUDIT_COLUMNS)

    frame = pd.DataFrame(rows)
    existing_rename = {k: v for k, v in AUDIT_COLUMN_MAPPING.items() if k in frame.columns}
    frame = frame.rename(columns=existing_rename)

    frame["PII Reductions"] = (
        _numeric_col(frame, "redactions_count")
        + _numeric_col(frame, "output_redactions_count")
        + _numeric_col(frame, "pii_redactions_count")
    ).astype(int)

    if "threat_detected" in frame.columns or "output_violation" in frame.columns:

        def _threat_label(row: pd.Series) -> str:
            t = row["threat_detected"] if "threat_detected" in row.index and pd.notna(row["threat_detected"]) else None
            o = row["output_violation"] if "output_violation" in row.index and pd.notna(row["output_violation"]) else None
            return str(t or o or "—")

        frame["Threat / Violation"] = frame.apply(_threat_label, axis=1)

    frame = _ensure_audit_columns(frame)
    return frame[AUDIT_COLUMNS]


@st.cache_data(ttl=2)
def load_cumulative_esg() -> pd.DataFrame:
    series = get_cumulative_esg()
    if not series:
        return pd.DataFrame(
            {"water_saved_ml": [0.0], "energy_saved_wh": [0.0], "carbon_saved_g": [0.0]}
        )
    return pd.DataFrame(series)


@st.cache_data(ttl=2)
def load_route_distribution() -> pd.DataFrame:
    rows = get_route_distribution()
    if not rows:
        return pd.DataFrame({"Route": ["Awaiting Telemetry"], "Count": [1]})
    labels = {
        "ollama-local": "Ollama Local (Zero-Carbon Edge)",
        "cloud-provider": "Cloud Provider (Managed)",
    }
    return pd.DataFrame(
        {
            "Route": [labels.get(row["route"], row["route"]) for row in rows],
            "Count": [row["count"] for row in rows],
        }
    )


@st.cache_data(ttl=2)
def load_threat_breakdown() -> pd.DataFrame:
    return pd.DataFrame(get_threat_breakdown())


@st.cache_data(ttl=2)
def load_security_stats(_df: pd.DataFrame) -> dict[str, int]:
    if _df.empty:
        return {"pii_events": 0, "injections": 0, "output_violations": 0}
    pii = int((_df["PII Reductions"] > 0).sum()) if "PII Reductions" in _df.columns else 0
    threats = _df["Threat / Violation"].astype(str)
    injections = int(threats.str.contains("ignore|injection|disregard", case=False, na=False).sum())
    output_v = int(threats.str.contains("REDACTED|SECRET|CREDENTIAL", case=False, na=False).sum())
    return {"pii_events": pii, "injections": injections, "output_violations": output_v}


@st.cache_data(ttl=2)
def load_compression_avg(_df: pd.DataFrame) -> float:
    if _df.empty or "Compression %" not in _df.columns:
        return 0.0
    resonet = _df[_df["Module"] == "ResoNet"]["Compression %"]
    if resonet.empty:
        return 0.0
    return float(resonet.mean())


grid_region = os.environ.get("GRID_CARBON_REGION", "global").upper()
telemetry_path = os.environ.get("TELEMETRY_DB_PATH", "data/telemetry.db")


@st.fragment(run_every=timedelta(seconds=2))
def render_command_center() -> None:
    """Live telemetry panel — auto-refreshes every 2s (WAL-backed SQLite)."""
    kpis = load_kpis()
    df = load_audit_logs()
    cumulative = load_cumulative_esg()
    route_counts = load_route_distribution()
    threat_data = load_threat_breakdown()
    sec_stats = load_security_stats(df)
    compression_avg = load_compression_avg(df)
    carbon_total = kpis.get("total_carbon_g", 0.0)

    # ── Executive KPI row ─────────────────────────────────────────────────────
    k1, k2, k3, k4 = st.columns(4)
    with k1:
        st.markdown(
            _kpi_card(
                "Eco-Savings: Water Conservation (mL)",
                f"{kpis.get('total_water_ml', 0):.2f}",
                "kpi-emerald",
            ),
            unsafe_allow_html=True,
        )
    with k2:
        st.markdown(
            _kpi_card(
                "Grid Efficiency: Energy Off-Loaded (Wh)",
                f"{kpis.get('total_energy_wh', 0):.2f}",
                "kpi-emerald",
            ),
            unsafe_allow_html=True,
        )
    with k3:
        st.markdown(
            _kpi_card(
                "Cyber Threat Preventions &amp; PII Redactions",
                f"{kpis.get('threats_blocked', 0):,}",
                "kpi-crimson",
            ),
            unsafe_allow_html=True,
        )
    with k4:
        st.markdown(
            _kpi_card(
                "Local Model Delegation Ratio",
                f"{kpis.get('local_offload_pct', 0):.1f}%",
                "kpi-cyan",
            ),
            unsafe_allow_html=True,
        )

    st.markdown(
        f'<p class="section-head">Aggregate Carbon Avoidance: <span style="color:{EMERALD}">'
        f"{carbon_total:.4f} gCO₂eq</span> &nbsp;|&nbsp; Telemetry: "
        f'<span style="color:#475569">{telemetry_path}</span></p>',
        unsafe_allow_html=True,
    )

    st.markdown("---")

    # ── Executive tabs ────────────────────────────────────────────────────────
    tab_nexus, tab_resonet, tab_audit = st.tabs(
        [
            "🛡️ NexusShield Security & Data Protection",
            "🌱 ResoNet Dynamic ESG & Token Compression",
            "📋 Real-Time Compliance & Audit Telemetry",
        ]
    )

    with tab_nexus:
        st.markdown(
            '<p class="section-head">Security Operations Center — Live Governance Metrics</p>',
            unsafe_allow_html=True,
        )
        n1, n2, n3 = st.columns(3)
        with n1:
            st.markdown(
                _kpi_card("PII / PHI Masking Events", f"{sec_stats['pii_events']:,}", "kpi-crimson"),
                unsafe_allow_html=True,
            )
        with n2:
            st.markdown(
                _kpi_card("Prompt Injection Interceptions", f"{sec_stats['injections']:,}", "kpi-crimson"),
                unsafe_allow_html=True,
            )
        with n3:
            st.markdown(
                _kpi_card("Output Guardrail Violations", f"{sec_stats['output_violations']:,}", "kpi-crimson"),
                unsafe_allow_html=True,
            )

        col_bar, col_policy = st.columns([1.4, 1])
        with col_bar:
            fig_bar = px.bar(
                threat_data,
                x="incidents",
                y="category",
                orientation="h",
                color="incidents",
                color_continuous_scale=["#450A0A", "#EF4444", "#FECACA"],
            )
            fig_bar.update_layout(**_plot_layout("Threat Vector Interception Matrix"))
            fig_bar.update_coloraxes(showscale=False)
            fig_bar.update_traces(
                hovertemplate="<b>%{y}</b><br>Incidents: %{x}<extra></extra>"
            )
            st.plotly_chart(fig_bar, width="stretch")

        with col_policy:
            st.markdown('<p class="section-head">Active Policy Enforcement Controls</p>', unsafe_allow_html=True)
            st.markdown(
                '<div class="policy-card policy-active">✓ Contextual PII/PHI Anonymization — <b>ACTIVE</b></div>',
                unsafe_allow_html=True,
            )
            st.markdown(
                '<div class="policy-card policy-active">✓ Adversarial Injection Engine v2 — <b>ACTIVE</b></div>',
                unsafe_allow_html=True,
            )
            st.markdown(
                '<div class="policy-card policy-active">✓ LLM Output Guardrail Scanner — <b>ACTIVE</b></div>',
                unsafe_allow_html=True,
            )
            st.markdown(
                '<div class="policy-card policy-active">✓ Corporate DLP Ruleset (ISO 27001 / GDPR) — <b>ACTIVE</b></div>',
                unsafe_allow_html=True,
            )
            st.markdown(
                '<div class="policy-card policy-alert">⚠ Token Overhead Threshold — 500 tokens (monitoring)</div>',
                unsafe_allow_html=True,
            )

    with tab_resonet:
        st.markdown(
            '<p class="section-head">Thermodynamic Efficiency & Semantic Compression Analytics</p>',
            unsafe_allow_html=True,
        )
        r1, r2 = st.columns(2)
        with r1:
            st.markdown(
                _kpi_card("Semantic Compression Savings (Avg %)", f"{compression_avg:.1f}%", "kpi-cyan"),
                unsafe_allow_html=True,
            )
        with r2:
            st.markdown(
                _kpi_card("Cumulative Carbon Avoidance (gCO₂eq)", f"{carbon_total:.4f}", "kpi-emerald"),
                unsafe_allow_html=True,
            )

        col_esg, col_route = st.columns(2)
        with col_esg:
            fig_esg = go.Figure()
            fig_esg.add_trace(
                go.Scatter(
                    y=cumulative.get("water_saved_ml", [0]),
                    name="Water (mL)",
                    line=dict(color=EMERALD, width=2.5),
                    fill="tozeroy",
                    fillcolor="rgba(16,185,129,0.08)",
                    hovertemplate="Water: %{y:.4f} mL<extra></extra>",
                )
            )
            fig_esg.add_trace(
                go.Scatter(
                    y=cumulative.get("energy_saved_wh", [0]),
                    name="Energy (Wh)",
                    line=dict(color=CYAN, width=2.5),
                    hovertemplate="Energy: %{y:.6f} Wh<extra></extra>",
                )
            )
            if "carbon_saved_g" in cumulative.columns:
                fig_esg.add_trace(
                    go.Scatter(
                        y=cumulative["carbon_saved_g"],
                        name="Carbon (gCO₂eq)",
                        line=dict(color="#34D399", width=2, dash="dot"),
                        hovertemplate="Carbon: %{y:.6f} gCO₂eq<extra></extra>",
                    )
                )
            fig_esg.update_layout(**_plot_layout("Cumulative ESG Impact Trajectory"))
            st.plotly_chart(fig_esg, width="stretch")

        with col_route:
            fig_donut = px.pie(
                route_counts,
                values="Count",
                names="Route",
                hole=0.58,
                color_discrete_sequence=[EMERALD, "#3B82F6", CYAN],
            )
            fig_donut.update_traces(
                textposition="inside",
                textinfo="percent+label",
                hovertemplate="<b>%{label}</b><br>Requests: %{value}<br>Share: %{percent}<extra></extra>",
                marker=dict(line=dict(color=SLATE, width=2)),
            )
            fig_donut.update_layout(**_plot_layout("Inference Route Delegation — Ollama vs Cloud"))
            st.plotly_chart(fig_donut, width="stretch")

        if not df.empty and "Compression %" in df.columns:
            comp_series = df[df["Module"] == "ResoNet"][["Timestamp", "Compression %"]].head(30)
            if not comp_series.empty:
                fig_comp = px.area(
                    comp_series,
                    x="Timestamp",
                    y="Compression %",
                    color_discrete_sequence=[CYAN],
                )
                fig_comp.update_traces(
                    hovertemplate="Compression: %{y:.2f}%<br>Time: %{x}<extra></extra>"
                )
                fig_comp.update_layout(**_plot_layout("Token Compression Ratio — Recent Sessions"))
                st.plotly_chart(fig_comp, width="stretch")

    with tab_audit:
        st.markdown(
            '<p class="section-head">Compliance Audit Trail — Auto-Refresh 2s — Immutable WAL Telemetry</p>',
            unsafe_allow_html=True,
        )
        audit_display_cols = [
            c
            for c in (
                "Timestamp",
                "Module",
                "Route Target",
                "PII Reductions",
                "Carbon Saved (gCO₂eq)",
                "Latency",
            )
            if c in df.columns
        ]
        audit_view = df[audit_display_cols] if audit_display_cols else df
        column_config: dict[str, st.column_config.Column] = {}
        if "Carbon Saved (gCO₂eq)" in audit_view.columns:
            column_config["Carbon Saved (gCO₂eq)"] = st.column_config.NumberColumn(format="%.6f")
        if "PII Reductions" in audit_view.columns:
            column_config["PII Reductions"] = st.column_config.NumberColumn(format="%d")
        st.dataframe(
            audit_view,
            width="stretch",
            hide_index=True,
            column_config=column_config or None,
        )

        c_refresh, c_info = st.columns([1, 4])
        with c_refresh:
            if st.button("⟳ Force Telemetry Sync", width="stretch"):
                st.cache_data.clear()
                st.rerun()
        with c_info:
            st.caption(
                f"Displaying {len(df)} most recent events · "
                f"Grid region {grid_region} · "
                "Latency column reserved for future distributed tracing integration."
            )


# ── Header banner ─────────────────────────────────────────────────────────────
header_html = build_banner_html(grid_region)
st.markdown(header_html, unsafe_allow_html=True)

render_command_center()

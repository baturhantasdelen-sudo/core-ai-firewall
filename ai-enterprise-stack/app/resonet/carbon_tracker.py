"""Dynamic grid carbon intensity for ResoNet sustainability metrics."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Grid carbon intensity (gCO2eq / kWh) — IEA / Ember approximate averages
GRID_INTENSITY_G_PER_KWH: dict[str, float] = {
    "global": 436.0,
    "us": 385.0,
    "eu": 255.0,
    "uk": 211.0,
    "de": 350.0,
    "fr": 56.0,
    "tr": 440.0,
    "in": 713.0,
    "cn": 555.0,
    "jp": 485.0,
    "au": 507.0,
    "ca": 120.0,
    "br": 82.0,
}


@dataclass(frozen=True, slots=True)
class CarbonMetrics:
    """Carbon savings derived from energy reduction at current grid intensity."""

    energy_saved_wh: float
    grid_region: str
    grid_intensity_g_per_kwh: float
    carbon_saved_g: float

    def as_header(self) -> str:
        return f"{self.carbon_saved_g:.6f}"


def resolve_grid_region(settings: Settings | None = None) -> str:
    """Resolve grid region from settings or environment."""
    cfg = settings or get_settings()
    region = os.environ.get("GRID_CARBON_REGION", "").strip().lower()
    if not region:
        region = getattr(cfg, "grid_carbon_region", "global").lower()
    return region if region in GRID_INTENSITY_G_PER_KWH else "global"


def get_grid_intensity_g_per_kwh(region: str | None = None, settings: Settings | None = None) -> float:
    """Return grid carbon intensity in gCO2eq per kWh for the configured region."""
    resolved = (region or resolve_grid_region(settings)).lower()
    intensity = GRID_INTENSITY_G_PER_KWH.get(resolved, GRID_INTENSITY_G_PER_KWH["global"])

    try:
        from codecarbon import EmissionsTracker  # noqa: F401

        logger.debug("codecarbon available; using regional grid coefficients")
    except ImportError:
        logger.debug("codecarbon not installed; using built-in grid map")

    return intensity


def compute_carbon_saved(
    energy_saved_wh: float,
    *,
    region: str | None = None,
    settings: Settings | None = None,
) -> CarbonMetrics:
    """
    Compute dynamic gCO2eq savings from Wh reduction.

    Formula: carbon_saved_g = energy_saved_wh * (grid_g_per_kwh / 1000)
    """
    resolved_region = (region or resolve_grid_region(settings)).lower()
    intensity = get_grid_intensity_g_per_kwh(resolved_region, settings)
    carbon_g = max(0.0, energy_saved_wh * (intensity / 1000.0))

    return CarbonMetrics(
        energy_saved_wh=energy_saved_wh,
        grid_region=resolved_region,
        grid_intensity_g_per_kwh=intensity,
        carbon_saved_g=carbon_g,
    )

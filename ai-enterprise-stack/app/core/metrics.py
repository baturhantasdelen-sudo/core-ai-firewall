"""Sustainability metrics: water, energy, and dynamic carbon savings."""

from dataclasses import dataclass

from app.core.config import Settings, get_settings
from app.core.tokens import estimate_token_count


@dataclass(frozen=True, slots=True)
class SustainabilityMetrics:
    """Computed environmental savings from token reduction."""

    saved_input_tokens: int
    water_saved_ml: float
    energy_saved_wh: float
    carbon_saved_g: float
    compression_ratio_pct: float = 0.0
    grid_region: str = "global"

    def as_response_headers(self) -> dict[str, str]:
        """Serialize metrics as HTTP response headers."""
        return {
            "X-Resonet-Tokens-Saved": str(self.saved_input_tokens),
            "X-Resonet-Water-Saved-mL": f"{self.water_saved_ml:.4f}",
            "X-Resonet-Energy-Saved-Wh": f"{self.energy_saved_wh:.6f}",
            "X-Resonet-Carbon-Saved-g": f"{self.carbon_saved_g:.6f}",
            "X-Resonet-Compression-Ratio-Pct": f"{self.compression_ratio_pct:.2f}",
            "X-Resonet-Grid-Region": self.grid_region,
        }


def compute_sustainability_metrics(
    original_text: str,
    compressed_text: str,
    settings: Settings | None = None,
    *,
    compression_ratio_pct: float = 0.0,
) -> SustainabilityMetrics:
    """Calculate saved water, energy, and dynamic carbon from token reduction."""
    from app.resonet.carbon_tracker import compute_carbon_saved

    cfg = settings or get_settings()
    original_tokens = estimate_token_count(original_text)
    compressed_tokens = estimate_token_count(compressed_text)
    saved = max(0, original_tokens - compressed_tokens)

    water = saved * cfg.water_ml_per_token
    energy = saved * cfg.energy_wh_per_token
    carbon = compute_carbon_saved(energy, settings=cfg)

    if compression_ratio_pct <= 0 and original_tokens:
        compression_ratio_pct = round(saved / original_tokens * 100.0, 2)

    return SustainabilityMetrics(
        saved_input_tokens=saved,
        water_saved_ml=water,
        energy_saved_wh=energy,
        carbon_saved_g=carbon.carbon_saved_g,
        compression_ratio_pct=compression_ratio_pct,
        grid_region=carbon.grid_region,
    )

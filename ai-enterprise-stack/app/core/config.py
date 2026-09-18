"""Application configuration via Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for NexusShield and ResoNet modules."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "AI Enterprise Stack"
    app_version: str = "0.1.0"
    debug: bool = False

    # Shared upstream LLM credentials
    openai_api_key: str = Field(default="", description="API key for cloud LLM provider")
    openai_base_url: HttpUrl = Field(
        default="https://api.openai.com/v1",
        description="Cloud LLM base URL (OpenAI-compatible)",
    )
    default_model: str = "gpt-4o-mini"

    # NexusShield
    nexus_upstream_url: HttpUrl | None = Field(
        default=None,
        description="Override upstream URL for NexusShield; defaults to openai_base_url",
    )
    nexus_upstream_api_key: str | None = Field(
        default=None,
        description="Override API key for NexusShield; defaults to openai_api_key",
    )
    nexus_injection_block: bool = True

    # ResoNet
    ollama_base_url: HttpUrl = Field(
        default="http://localhost:11434/v1",
        description="Local Ollama OpenAI-compatible endpoint",
    )
    ollama_model: str = "llama3.2"
    resonet_cloud_base_url: HttpUrl | None = Field(
        default=None,
        description="Override cloud URL for ResoNet; defaults to openai_base_url",
    )
    resonet_cloud_api_key: str | None = Field(
        default=None,
        description="Override API key for ResoNet cloud route; defaults to openai_api_key",
    )
    resonet_simple_char_threshold: int = 100
    resonet_request_timeout_seconds: float = 120.0

    # Sustainability coefficients
    water_ml_per_token: float = 0.002
    energy_wh_per_token: float = 0.0003
    carbon_g_per_token: float = 0.0001
    grid_carbon_region: str = Field(
        default="global",
        description="Grid region code for dynamic carbon intensity (us, eu, tr, ...)",
    )

    # V2 ResoNet compression
    resonet_compression_token_threshold: int = 200
    resonet_use_llmlingua: bool = Field(
        default=False,
        description="Enable LLMLingua semantic compression (requires heavy ML deps)",
    )

    # V2 NexusShield output guard
    nexus_output_guard_enabled: bool = True

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # Telemetry & dashboard
    telemetry_db_path: str = "data/telemetry.db"
    streamlit_port: int = 8501
    streamlit_base_path: str = "dashboard"
    streamlit_enabled: bool = Field(
        default=False,
        description=(
            "Mount Streamlit behind /dashboard via reverse proxy. "
            "For local dev, run Streamlit separately on :8501 (recommended)."
        ),
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()

"""Unit tests for V2 security/ESG features."""

from app.nexusshield.output_guard import scan_and_sanitize_completion
from app.resonet.carbon_tracker import compute_carbon_saved
from app.resonet.compressor import compress_messages


def test_output_guard_redacts_secrets():
    payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Your key is sk-abcdefghijklmnopqrstuvwxyz1234567890",
                }
            }
        ]
    }
    result = scan_and_sanitize_completion(payload)
    assert result.redaction_count >= 1
    assert "[REDACTED_SECRET]" in result.payload["choices"][0]["message"]["content"]


def test_compression_ratio_for_verbose_prompt():
    messages = [
        {
            "role": "user",
            "content": "Please note that   what is Python? " * 60,
        }
    ]
    result = compress_messages(messages, token_threshold=50, use_llmlingua=False)
    assert result.compressed_tokens <= result.original_tokens
    assert result.method in {"semantic_prune", "none", "mixed"}


def test_dynamic_carbon_from_energy():
    carbon = compute_carbon_saved(1.0, region="eu")
    assert carbon.carbon_saved_g > 0
    assert carbon.grid_region == "eu"

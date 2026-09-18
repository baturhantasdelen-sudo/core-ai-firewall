"""Semantic intent validation via SentenceTransformer cosine similarity."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("nexus.intent_engine")


def _numpy():
    try:
        import numpy as np
    except ImportError:
        return None
    return np


class IntentEngine:
    def __init__(self, model=None, similarity_threshold: float = 0.35):
        """
        :param model: SentenceTransformer loaded by the host app (e.g. nexus_shield_api)
        :param similarity_threshold: Minimum acceptable semantic similarity (0.0 - 1.0)
        """
        self.model = model
        self.similarity_threshold = similarity_threshold

    def _cosine_similarity(self, vec_a, vec_b) -> float:
        """Compute cosine similarity between two embedding vectors."""
        np = _numpy()
        if np is None:
            return 0.0
        dot_product = np.dot(vec_a, vec_b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(dot_product / (norm_a * norm_b))

    def validate_intent(
        self,
        user_prompt: str,
        tool_name: str,
        tool_purpose: str = "",
    ) -> tuple[bool, float, dict[str, Any]]:
        """Check semantic alignment between the user prompt and the requested tool."""
        np = _numpy()
        if not self.model or np is None:
            logger.warning(
                "SentenceTransformer model not loaded in IntentEngine. Pass-through enabled."
            )
            return True, 1.0, {
                "status": "SKIPPED",
                "reason": "Model not loaded" if self.model else "numpy unavailable",
            }

        tool_text = f"Tool call for {tool_name}. {tool_purpose}".strip()

        embeddings = self.model.encode([user_prompt, tool_text])
        prompt_vec = embeddings[0]
        tool_vec = embeddings[1]

        similarity_score = self._cosine_similarity(prompt_vec, tool_vec)
        is_valid = similarity_score >= self.similarity_threshold

        analysis_details = {
            "similarity_score": round(similarity_score, 4),
            "threshold": self.similarity_threshold,
            "intent_matched": is_valid,
            "flag": None if is_valid else "INTENT_MISMATCH",
        }

        if not is_valid:
            logger.warning(
                "[INTENT MISMATCH DETECTED] Score: %.4f < Threshold: %.4f | "
                "Prompt: '%s' vs Tool: '%s'",
                similarity_score,
                self.similarity_threshold,
                user_prompt,
                tool_name,
            )

        return is_valid, similarity_score, analysis_details

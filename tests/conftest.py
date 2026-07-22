"""CI ortamında ağır ML modeli indirmesini önlemek için mock enjekte eder."""

from __future__ import annotations

import sys
from typing import Any
from unittest.mock import MagicMock

import numpy as np


def _mock_encode(texts: Any, *args: Any, **kwargs: Any) -> np.ndarray:
    """Batch boyutuna uygun sahte embedding vektörleri üretir."""
    if isinstance(texts, str):
        batch = [texts]
    else:
        batch = list(texts)
    return np.array([[0.1, 0.2, 0.3] for _ in batch], dtype=np.float32)


_mock_model = MagicMock(
    encode=MagicMock(side_effect=_mock_encode),
    get_sentence_embedding_dimension=MagicMock(return_value=3),
)

_mock_sentence_transformers = MagicMock()
_mock_sentence_transformers.SentenceTransformer = MagicMock(return_value=_mock_model)

_mock_torch = MagicMock()
_mock_torch.set_num_threads = MagicMock()

# setdefault yerine zorla override — gerçek paket kurulu olsa bile mock kullanılır
sys.modules["sentence_transformers"] = _mock_sentence_transformers
sys.modules["torch"] = _mock_torch

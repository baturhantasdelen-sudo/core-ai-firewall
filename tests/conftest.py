"""CI ortamında ağır ML modeli indirmesini önlemek için mock enjekte eder."""

from __future__ import annotations

import sys
from unittest.mock import MagicMock

_mock_sentence_transformers = MagicMock()
_mock_sentence_transformers.SentenceTransformer = MagicMock(
    return_value=MagicMock(
        encode=MagicMock(return_value=[[0.1, 0.2, 0.3]]),
        get_sentence_embedding_dimension=MagicMock(return_value=3),
    )
)
sys.modules.setdefault("sentence_transformers", _mock_sentence_transformers)

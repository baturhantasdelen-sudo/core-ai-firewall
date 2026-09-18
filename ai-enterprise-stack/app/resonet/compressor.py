"""Prompt compression — lightweight + optional LLMLingua semantic pruning."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from app.core.tokens import estimate_token_count

logger = logging.getLogger(__name__)

MULTI_SPACE = re.compile(r"[ \t]{2,}")
MULTI_NEWLINE = re.compile(r"\n{3,}")
FILLER_PHRASES = re.compile(
    r"\b("
    r"please note that|"
    r"it is important to note that|"
    r"as mentioned (?:earlier|before|above)|"
    r"in conclusion,?|"
    r"to summarize,?|"
    r"kindly be advised that|"
    r"for your information,?|"
    r"at this point in time|"
    r"in order to"
    r")\b",
    re.IGNORECASE,
)

LOW_VALUE_SENTENCE = re.compile(
    r"^(?:thanks|thank you|hello|hi|dear|regards|best)[\s,.!]*$",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class CompressionResult:
    """Outcome of prompt compression with savings metadata."""

    messages: list[dict[str, Any]]
    original_tokens: int
    compressed_tokens: int
    compression_ratio_pct: float
    method: str

    @property
    def tokens_saved(self) -> int:
        return max(0, self.original_tokens - self.compressed_tokens)


def _compress_text(text: str) -> str:
    """Trim redundant filler and collapse excessive whitespace."""
    compressed = text.strip()
    compressed = FILLER_PHRASES.sub("", compressed)
    compressed = MULTI_NEWLINE.sub("\n\n", compressed)
    compressed = MULTI_SPACE.sub(" ", compressed)
    compressed = re.sub(r" ?([,.;:!?])", r"\1", compressed)
    return compressed.strip()


def _semantic_prune_sentences(text: str) -> str:
    """Lightweight semantic pruning — drop low-information sentences."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    kept: list[str] = []
    for sentence in sentences:
        stripped = sentence.strip()
        if not stripped:
            continue
        if LOW_VALUE_SENTENCE.match(stripped):
            continue
        if len(stripped.split()) <= 2 and stripped.endswith("?"):
            kept.append(stripped)
            continue
        if len(stripped) > 12:
            kept.append(stripped)
    return " ".join(kept) if kept else text


def _llmlingua_compress(text: str, target_rate: float = 0.5) -> str | None:
    """Attempt LLMLingua compression; return None if unavailable or failing."""
    try:
        from llmlingua import PromptCompressor

        compressor = PromptCompressor(
            model_name="NousResearch/Llama-2-7b-chat-hf",
            use_llmlingua2=True,
        )
        result = compressor.compress_prompt(text, rate=target_rate)
        if isinstance(result, dict):
            return str(result.get("compressed_prompt", "")).strip() or None
        return str(result).strip() or None
    except Exception as exc:
        logger.debug("LLMLingua unavailable or failed: %s", exc)
        return None


def compress_text_advanced(
    text: str,
    *,
    token_threshold: int = 200,
    use_llmlingua: bool = True,
) -> tuple[str, str]:
    """
    Compress a single text blob.

    Returns (compressed_text, method).
    """
    base = _compress_text(text)
    tokens = estimate_token_count(base)
    if tokens <= token_threshold:
        return base, "none"

    if use_llmlingua:
        lingual = _llmlingua_compress(base)
        if lingual:
            return lingual, "llmlingua"

    return _semantic_prune_sentences(base), "semantic_prune"


def flatten_message_text(messages: list[dict[str, Any]]) -> str:
    """Concatenate textual content from chat messages for analysis."""
    parts: list[str] = []
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    parts.append(str(item.get("text", "")))
    return "\n".join(parts)


def compress_message_content(
    content: str | list[Any] | None,
    *,
    token_threshold: int = 200,
    use_llmlingua: bool = True,
) -> str | list[Any] | None:
    """Compress a single message content field."""
    if content is None:
        return None
    if isinstance(content, str):
        compressed, _method = compress_text_advanced(
            content,
            token_threshold=token_threshold,
            use_llmlingua=use_llmlingua,
        )
        return compressed
    if not isinstance(content, list):
        return content

    compressed_parts: list[Any] = []
    for part in content:
        if isinstance(part, dict) and part.get("type") == "text":
            text_value = str(part.get("text", ""))
            compressed, _method = compress_text_advanced(
                text_value,
                token_threshold=token_threshold,
                use_llmlingua=use_llmlingua,
            )
            compressed_parts.append({**part, "text": compressed})
        else:
            compressed_parts.append(part)
    return compressed_parts


def compress_messages(
    messages: list[dict[str, Any]],
    *,
    token_threshold: int = 200,
    use_llmlingua: bool = True,
) -> CompressionResult:
    """Return compressed messages plus token savings metadata."""
    original_text = flatten_message_text(messages)
    original_tokens = estimate_token_count(original_text)

    compressed: list[dict[str, Any]] = []
    methods: set[str] = set()

    for message in messages:
        msg = dict(message)
        content = msg.get("content")
        if isinstance(content, str):
            new_content, method = compress_text_advanced(
                content,
                token_threshold=token_threshold,
                use_llmlingua=use_llmlingua,
            )
            methods.add(method)
            msg["content"] = new_content
        elif isinstance(content, list):
            new_parts: list[Any] = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    new_text, method = compress_text_advanced(
                        str(part.get("text", "")),
                        token_threshold=token_threshold,
                        use_llmlingua=use_llmlingua,
                    )
                    methods.add(method)
                    new_parts.append({**part, "text": new_text})
                else:
                    new_parts.append(part)
            msg["content"] = new_parts
        compressed.append(msg)

    compressed_text = flatten_message_text(compressed)
    compressed_tokens = estimate_token_count(compressed_text)
    saved = max(0, original_tokens - compressed_tokens)
    ratio = (saved / original_tokens * 100.0) if original_tokens else 0.0

    method = "mixed" if len(methods) > 1 else (next(iter(methods)) if methods else "none")

    return CompressionResult(
        messages=compressed,
        original_tokens=original_tokens,
        compressed_tokens=compressed_tokens,
        compression_ratio_pct=round(ratio, 2),
        method=method,
    )

"""Token estimation helpers (heuristic, no external tokenizer)."""


def estimate_token_count(text: str) -> int:
    """
    Approximate token count without a tokenizer.

    Uses ~4 characters per token for Latin text, minimum 1 for non-empty strings.
    """
    stripped = text.strip()
    if not stripped:
        return 0
    return max(1, len(stripped) // 4)


def estimate_messages_tokens(messages: list[dict]) -> int:
    """Approximate total prompt tokens across OpenAI-style chat messages."""
    total = 0
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            total += estimate_token_count(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    total += estimate_token_count(str(part.get("text", "")))
    return total

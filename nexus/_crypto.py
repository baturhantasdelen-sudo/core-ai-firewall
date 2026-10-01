"""Local-only payload sealing (stdlib, air-gapped)."""

from __future__ import annotations

import base64
import hashlib
import os
from pathlib import Path


def derive_key(seed: bytes, *, salt: bytes = b"nexus-shield-memory-v1") -> bytes:
    return hashlib.pbkdf2_hmac("sha256", seed, salt, 120_000, dklen=32)


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = b""
    counter = 0
    while len(out) < length:
        out += hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:length]


def encrypt_blob(plaintext: bytes, key: bytes) -> str:
    nonce = os.urandom(16)
    stream = _keystream(key, nonce, len(plaintext))
    ciphertext = bytes(a ^ b for a, b in zip(plaintext, stream, strict=True))
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt_blob(token: str, key: bytes) -> bytes:
    raw = base64.urlsafe_b64decode(token.encode("ascii"))
    nonce, ciphertext = raw[:16], raw[16:]
    stream = _keystream(key, nonce, len(ciphertext))
    return bytes(a ^ b for a, b in zip(ciphertext, stream, strict=True))


def load_or_create_memory_key(data_dir: Path) -> bytes:
    key_file = data_dir / ".memory.key"
    if key_file.is_file():
        return derive_key(key_file.read_bytes())
    seed = os.urandom(32)
    key_file.write_bytes(seed)
    try:
        os.chmod(key_file, 0o600)
    except OSError:
        pass
    return derive_key(seed)


def sha256_hex(payload: str | bytes) -> str:
    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    return hashlib.sha256(payload).hexdigest()

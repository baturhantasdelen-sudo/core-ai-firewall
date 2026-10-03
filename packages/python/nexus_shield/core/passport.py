"""Agent Authority Passport — portable scoped identity for governed agents."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .aar import AARSigningKeyPair, canonical_json_bytes, compute_evidence_hash


class PassportError(ValueError):
    """Invalid passport or action outside passport bounds."""


class AgentPassportRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    passport_id: str = Field(pattern=r"^pas_[a-z]+_[a-z0-9]+$")
    identity: str = Field(min_length=1, max_length=256)
    owner: str = Field(min_length=1, max_length=256)
    allowed_scopes: list[str] = Field(min_length=1)
    financial_limit: float = Field(ge=0.0)
    delegation_depth: int = Field(ge=0, le=32)
    issuer: str = Field(default="nexus-shield-root", min_length=1)
    evidence_hash: str | None = Field(default=None, pattern=r"^sha256:[a-f0-9]{64}$")
    signature: str | None = None

    @field_validator("allowed_scopes")
    @classmethod
    def _normalize_scopes(cls, scopes: list[str]) -> list[str]:
        normalized = [s.strip() for s in scopes if s.strip()]
        if not normalized:
            raise ValueError("allowed_scopes must not be empty")
        return normalized

    def canonical_payload(self) -> dict[str, Any]:
        return self.model_dump(mode="json", exclude={"evidence_hash", "signature"})

    def seal(self, signing_key: AARSigningKeyPair) -> AgentPassportRecord:
        payload = self.canonical_payload()
        evidence_hash = compute_evidence_hash(payload)
        signature = signing_key.sign_payload(payload)
        return self.model_copy(update={"evidence_hash": evidence_hash, "signature": signature})

    def verify_integrity(self, signing_key: AARSigningKeyPair) -> bool:
        if not self.evidence_hash or not self.signature:
            return False
        payload = self.canonical_payload()
        if compute_evidence_hash(payload) != self.evidence_hash:
            return False
        return signing_key.verify_payload(payload, self.signature)


def _scope_covers(granted: str, required: str) -> bool:
    if granted == required:
        return True
    if granted.endswith(":*"):
        prefix = granted[:-2]
        return required.startswith(prefix + ":") or required == prefix
    return False


def validate_passport_action(
    passport: AgentPassportRecord,
    *,
    required_scopes: list[str],
    amount: float | None = None,
    signing_key: AARSigningKeyPair | None = None,
) -> None:
    """
    Raise PassportError if scopes or financial limit are violated.

    When ``signing_key`` is provided, passport cryptographic integrity is enforced.
    """
    if signing_key is not None and not passport.verify_integrity(signing_key):
        raise PassportError("passport signature or evidence hash is invalid")

    for required in required_scopes:
        if not any(_scope_covers(granted, required) for granted in passport.allowed_scopes):
            raise PassportError(f"scope {required!r} not granted on passport {passport.passport_id}")

    if amount is not None and amount > passport.financial_limit:
        raise PassportError(
            f"amount {amount} exceeds passport financial_limit {passport.financial_limit}"
        )


def passport_fingerprint(passport: AgentPassportRecord) -> str:
    digest = hashlib.sha256(canonical_json_bytes(passport.canonical_payload())).hexdigest()[:16]
    return f"pas_fp_{digest}"

"""Universal Action Receipt (AAR 2.0) — strict schema and Ed25519 signing."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AAR_SCHEMA_ID = "https://nexusshield.ai/schemas/aar-v1.json"
SIGNATURE_PREFIX = "sig_nexus_ed25519_"

VerificationStatus = Literal["VERIFIED", "UNVERIFIED", "DISCREPANCY", "FAILED"]
PolicyEvaluation = Literal["ALLOW", "BLOCK", "REQUIRE_APPROVAL", "READ_ONLY"]
VerificationMethod = Literal[
    "DB_STATE_AND_LEDGER_CROSS_CHECK",
    "API_ONLY",
    "MANUAL_AUDIT",
    "HASH_CHAIN",
]


def build_aar_receipt_id() -> str:
    return f"aar_{uuid.uuid4().hex[:16]}"


def _utc_timestamp_ms() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class AgentReceiptBlock(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    identity: str = Field(min_length=1, max_length=256)
    passport_id: str = Field(min_length=1, pattern=r"^pas_[a-z]+_[a-z0-9]+$")
    owner: str = Field(min_length=1, max_length=256)


class IntentBlock(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    raw_prompt: str = Field(min_length=1)
    parsed_intent: str = Field(min_length=1, max_length=128)
    target_resource: str = Field(min_length=1, max_length=256)


class AuthorityBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    allowed_scopes: list[str] = Field(min_length=1)
    financial_limit: float = Field(ge=0.0)
    delegation_depth: int = Field(ge=0, le=32)
    verified_by_graph: bool

    @field_validator("allowed_scopes")
    @classmethod
    def _scopes_non_empty(cls, scopes: list[str]) -> list[str]:
        cleaned = [s.strip() for s in scopes if s.strip()]
        if not cleaned:
            raise ValueError("allowed_scopes must contain at least one scope")
        return cleaned


class PolicyBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str = Field(min_length=1, max_length=64)
    evaluation: PolicyEvaluation
    risk_score: float = Field(ge=0.0, le=1.0)


class ApiResponseBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status_code: int = Field(ge=100, le=599)
    raw_body: str = Field(min_length=1)


class ExecutionBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool_called: str = Field(min_length=1, max_length=128)
    request_payload: dict[str, Any]
    api_response: ApiResponseBlock


class OutcomeVerificationBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: VerificationStatus
    verification_method: VerificationMethod
    state_before: dict[str, Any]
    state_after: dict[str, Any]
    discrepancy_detected: bool


class CryptographicProof(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_hash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    signature: str = Field(min_length=1)


class UniversalActionReceipt(BaseModel):
    """Canonical AAR document (AAR 2.0)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    schema_ref: str = Field(alias="$schema", default=AAR_SCHEMA_ID)
    receipt_id: str = Field(pattern=r"^aar_[a-f0-9]{16}$")
    timestamp: str = Field(min_length=20)
    agent: AgentReceiptBlock
    intent: IntentBlock
    authority: AuthorityBlock
    policy: PolicyBlock
    execution: ExecutionBlock
    outcome_verification: OutcomeVerificationBlock
    cryptographic_proof: CryptographicProof

    @field_validator("timestamp")
    @classmethod
    def _timestamp_iso8601(cls, value: str) -> str:
        normalized = value.replace("Z", "+00:00")
        datetime.fromisoformat(normalized)
        return value

    def canonical_payload(self) -> dict[str, Any]:
        """Deterministic dict used for hashing and signing (excludes cryptographic_proof)."""
        data = self.model_dump(by_alias=True, mode="json")
        data.pop("cryptographic_proof", None)
        return data

    def model_dump_document(self) -> dict[str, Any]:
        return self.model_dump(by_alias=True, mode="json")


def canonical_json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_evidence_hash(payload: dict[str, Any]) -> str:
    digest = hashlib.sha256(canonical_json_bytes(payload)).hexdigest()
    return f"sha256:{digest}"


class AARSigningKeyPair:
    """Ed25519 key material for sealing AAR receipts."""

    def __init__(self, private_key: Any | None = None) -> None:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives.serialization import (
            Encoding,
            NoEncryption,
            PrivateFormat,
            PublicFormat,
        )

        if private_key is None:
            private_key = Ed25519PrivateKey.generate()
        self._private_key = private_key
        self._public_key = private_key.public_key()
        self.public_key_bytes = self._public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
        self.private_key_pem = private_key.private_bytes(
            Encoding.PEM,
            PrivateFormat.PKCS8,
            NoEncryption(),
        ).decode("ascii")

    @classmethod
    def generate(cls) -> AARSigningKeyPair:
        return cls()

    @classmethod
    def from_private_pem(cls, pem: str | bytes) -> AARSigningKeyPair:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key

        key = load_pem_private_key(pem if isinstance(pem, bytes) else pem.encode(), password=None)
        return cls(private_key=key)

    def sign_payload(self, payload: dict[str, Any]) -> str:
        signature_bytes = self._private_key.sign(canonical_json_bytes(payload))
        return f"{SIGNATURE_PREFIX}{signature_bytes.hex()}"

    def verify_payload(self, payload: dict[str, Any], signature: str) -> bool:
        if not signature.startswith(SIGNATURE_PREFIX):
            return False
        from cryptography.exceptions import InvalidSignature

        sig_hex = signature.removeprefix(SIGNATURE_PREFIX)
        try:
            sig_bytes = bytes.fromhex(sig_hex)
        except ValueError:
            return False
        try:
            self._public_key.verify(sig_bytes, canonical_json_bytes(payload))
        except InvalidSignature:
            return False
        return True


class AAREngine:
    """Build, seal, and verify Universal Action Receipts."""

    def __init__(self, signing_key: AARSigningKeyPair | None = None) -> None:
        self._signing_key = signing_key or AARSigningKeyPair.generate()

    @property
    def signing_key(self) -> AARSigningKeyPair:
        return self._signing_key

    def seal(
        self,
        *,
        agent: AgentReceiptBlock,
        intent: IntentBlock,
        authority: AuthorityBlock,
        policy: PolicyBlock,
        execution: ExecutionBlock,
        outcome_verification: OutcomeVerificationBlock,
        receipt_id: str | None = None,
        timestamp: str | None = None,
    ) -> UniversalActionReceipt:
        rid = receipt_id or build_aar_receipt_id()
        ts = timestamp or _utc_timestamp_ms()
        payload = {
            "$schema": AAR_SCHEMA_ID,
            "receipt_id": rid,
            "timestamp": ts,
            "agent": agent.model_dump(mode="json"),
            "intent": intent.model_dump(mode="json"),
            "authority": authority.model_dump(mode="json"),
            "policy": policy.model_dump(mode="json"),
            "execution": execution.model_dump(mode="json"),
            "outcome_verification": outcome_verification.model_dump(mode="json"),
        }
        evidence_hash = compute_evidence_hash(payload)
        signature = self._signing_key.sign_payload(payload)
        return UniversalActionReceipt(
            receipt_id=rid,
            timestamp=ts,
            agent=agent,
            intent=intent,
            authority=authority,
            policy=policy,
            execution=execution,
            outcome_verification=outcome_verification,
            cryptographic_proof=CryptographicProof(
                evidence_hash=evidence_hash,
                signature=signature,
            ),
        )

    def verify(self, receipt: UniversalActionReceipt) -> dict[str, Any]:
        payload = receipt.canonical_payload()
        expected_hash = compute_evidence_hash(payload)
        hash_ok = receipt.cryptographic_proof.evidence_hash == expected_hash
        sig_ok = self._signing_key.verify_payload(payload, receipt.cryptographic_proof.signature)
        return {
            "valid": hash_ok and sig_ok,
            "evidence_hash_match": hash_ok,
            "signature_valid": sig_ok,
            "receipt_id": receipt.receipt_id,
        }


def verify_aar_integrity(receipt: UniversalActionReceipt, signing_key: AARSigningKeyPair) -> bool:
    result = AAREngine(signing_key).verify(receipt)
    return bool(result["valid"])


def deterministic_demo_receipt_id(seed: str) -> str:
    """Stable receipt id for tests (still matches aar_ + 16 hex pattern)."""
    digest = hashlib.sha256(seed.encode()).hexdigest()[:16]
    return f"aar_{digest}"

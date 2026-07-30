# -*- coding: utf-8 -*-
"""Nexus Shield — Trial registration, tiered API keys, payment webhooks."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Final, Literal

import json as _json

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

logger = logging.getLogger("NexusAuth")

Tier = Literal["trial", "pro"]
TRIAL_DAYS: Final[int] = int(os.getenv("NEXUS_TRIAL_DAYS", "14"))
API_KEYS_FILE: Final[Path] = Path(
    os.getenv("NEXUS_API_KEYS_FILE", "data/api_keys.json")
)
STRIPE_WEBHOOK_SECRET: Final[str] = os.getenv("STRIPE_WEBHOOK_SECRET", "")
LEMON_WEBHOOK_SECRET: Final[str] = os.getenv("LEMON_WEBHOOK_SECRET", "")

TIER_LIMITS: Final[dict[str, dict[str, int]]] = {
    "trial": {
        "requests_per_minute": int(os.getenv("NEXUS_TRIAL_RPM", "60")),
        "requests_per_day": int(os.getenv("NEXUS_TRIAL_RPD", "5000")),
    },
    "pro": {
        "requests_per_minute": int(os.getenv("NEXUS_PRO_RPM", "600")),
        "requests_per_day": int(os.getenv("NEXUS_PRO_RPD", "500000")),
    },
}


@dataclass
class ApiKeyRecord:
    api_key: str
    email: str
    tier: Tier
    created_at: str
    expires_at: str | None
    requests_per_minute: int
    requests_per_day: int
    stripe_customer_id: str | None = None
    lemon_subscription_id: str | None = None

    def is_expired(self) -> bool:
        if not self.expires_at:
            return False
        expiry = datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) >= expiry

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "tier": self.tier,
            "email": self.email,
            "expires_at": self.expires_at,
            "requests_per_minute": self.requests_per_minute,
            "requests_per_day": self.requests_per_day,
        }


class ApiKeyStore:
    """JSON-backed API key registry with in-memory rate-limit counters."""

    def __init__(self, path: Path = API_KEYS_FILE) -> None:
        self._path = path
        self._lock = asyncio.Lock()
        self._keys: dict[str, ApiKeyRecord] = {}
        self._email_index: dict[str, str] = {}
        self._minute_counts: dict[str, list[float]] = {}
        self._day_counts: dict[str, list[float]] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.is_file():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            for item in raw.get("keys", []):
                record = ApiKeyRecord(**item)
                self._keys[record.api_key] = record
                self._email_index[record.email.lower()] = record.api_key
        except Exception as exc:
            logger.warning("API key store load failed: %s", exc)

    def _save_unlocked(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"keys": [asdict(r) for r in self._keys.values()]}
        self._path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @staticmethod
    def generate_api_key() -> str:
        return f"nx_live_{secrets.token_hex(16)}"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    async def register_trial(self, email: str) -> ApiKeyRecord:
        normalized = email.strip().lower()
        async with self._lock:
            existing_key = self._email_index.get(normalized)
            if existing_key:
                record = self._keys[existing_key]
                if not record.is_expired():
                    return record

            limits = TIER_LIMITS["trial"]
            expires = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)
            record = ApiKeyRecord(
                api_key=self.generate_api_key(),
                email=normalized,
                tier="trial",
                created_at=self._now_iso(),
                expires_at=expires.isoformat(),
                requests_per_minute=limits["requests_per_minute"],
                requests_per_day=limits["requests_per_day"],
            )
            self._keys[record.api_key] = record
            self._email_index[normalized] = record.api_key
            self._save_unlocked()
            logger.info("Trial registered for %s", normalized)
            return record

    async def upgrade_to_pro(
        self,
        email: str,
        *,
        stripe_customer_id: str | None = None,
        lemon_subscription_id: str | None = None,
    ) -> ApiKeyRecord:
        normalized = email.strip().lower()
        async with self._lock:
            key = self._email_index.get(normalized)
            if not key:
                limits = TIER_LIMITS["pro"]
                record = ApiKeyRecord(
                    api_key=self.generate_api_key(),
                    email=normalized,
                    tier="pro",
                    created_at=self._now_iso(),
                    expires_at=None,
                    requests_per_minute=limits["requests_per_minute"],
                    requests_per_day=limits["requests_per_day"],
                    stripe_customer_id=stripe_customer_id,
                    lemon_subscription_id=lemon_subscription_id,
                )
                self._keys[record.api_key] = record
                self._email_index[normalized] = record.api_key
            else:
                record = self._keys[key]
                limits = TIER_LIMITS["pro"]
                record.tier = "pro"
                record.expires_at = None
                record.requests_per_minute = limits["requests_per_minute"]
                record.requests_per_day = limits["requests_per_day"]
                if stripe_customer_id:
                    record.stripe_customer_id = stripe_customer_id
                if lemon_subscription_id:
                    record.lemon_subscription_id = lemon_subscription_id
            self._save_unlocked()
            logger.info("Upgraded to PRO: %s", normalized)
            return record

    def get(self, api_key: str) -> ApiKeyRecord | None:
        return self._keys.get(api_key)

    async def check_rate_limit(self, api_key: str, record: ApiKeyRecord) -> None:
        now = time.time()
        async with self._lock:
            minute_window = self._minute_counts.setdefault(api_key, [])
            day_window = self._day_counts.setdefault(api_key, [])
            minute_window[:] = [t for t in minute_window if now - t < 60]
            day_window[:] = [t for t in day_window if now - t < 86400]

            if len(minute_window) >= record.requests_per_minute:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded (per minute)",
                )
            if len(day_window) >= record.requests_per_day:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded (per day)",
                )
            minute_window.append(now)
            day_window.append(now)


api_key_store = ApiKeyStore()


def verify_stripe_signature(payload: bytes, sig_header: str | None) -> bool:
    if not STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET not set — skipping signature check")
        return True
    if not sig_header:
        return False
    parts = dict(p.split("=", 1) for p in sig_header.split(",") if "=" in p)
    timestamp = parts.get("t")
    v1 = parts.get("v1")
    if not timestamp or not v1:
        return False
    signed = f"{timestamp}.{payload.decode('utf-8')}".encode()
    expected = hmac.new(
        STRIPE_WEBHOOK_SECRET.encode(),
        signed,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, v1)


def verify_lemon_signature(payload: bytes, sig_header: str | None) -> bool:
    if not LEMON_WEBHOOK_SECRET:
        logger.warning("LEMON_WEBHOOK_SECRET not set — skipping signature check")
        return True
    if not sig_header:
        return False
    digest = hmac.new(
        LEMON_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, sig_header)


def extract_email_from_stripe_event(body: dict[str, Any]) -> str | None:
    obj = body.get("data", {}).get("object", {})
    details = obj.get("customer_details") or {}
    email = details.get("email") or obj.get("customer_email")
    if email:
        return str(email)
    customer = obj.get("customer")
    if isinstance(customer, dict):
        return customer.get("email")
    return None


def extract_email_from_lemon_event(body: dict[str, Any]) -> str | None:
    attrs = body.get("data", {}).get("attributes", {})
    email = attrs.get("user_email") or attrs.get("customer_email")
    if email:
        return str(email)
    meta = attrs.get("custom_data") or {}
    if meta.get("email"):
        return str(meta["email"])
    return None


STRIPE_UPGRADE_EVENTS: Final[frozenset[str]] = frozenset(
    {
        "checkout.session.completed",
        "invoice.paid",
        "customer.subscription.created",
    }
)

LEMON_UPGRADE_EVENTS: Final[frozenset[str]] = frozenset(
    {
        "order_created",
        "subscription_created",
        "subscription_payment_success",
    }
)


class TrialRegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254, pattern=r"^[^@]+@[^@]+\.[^@]+$")


auth_router = APIRouter(prefix="/v1/auth", tags=["auth"])


@auth_router.post("/register-trial")
async def register_trial(body: TrialRegisterRequest) -> dict[str, Any]:
    record = await api_key_store.register_trial(body.email)
    return {
        "api_key": record.api_key,
        "tier": record.tier,
        "email": record.email,
        "expires_at": record.expires_at,
        "requests_per_minute": record.requests_per_minute,
        "requests_per_day": record.requests_per_day,
        "message": f"{TRIAL_DAYS}-day free trial activated",
    }


@auth_router.post("/stripe-webhook")
async def stripe_webhook(request: Request) -> dict[str, bool]:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not verify_stripe_signature(payload, sig_header):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe webhook signature",
        )
    try:
        event = _json.loads(payload)
    except _json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        ) from exc

    event_type = event.get("type", "")
    if event_type in STRIPE_UPGRADE_EVENTS:
        email = extract_email_from_stripe_event(event)
        if email:
            customer_id = event.get("data", {}).get("object", {}).get("customer")
            await api_key_store.upgrade_to_pro(
                email,
                stripe_customer_id=str(customer_id) if customer_id else None,
            )
    return {"received": True}


@auth_router.post("/lemon-webhook")
async def lemon_webhook(request: Request) -> dict[str, bool]:
    payload = await request.body()
    sig_header = request.headers.get("x-signature")
    if not verify_lemon_signature(payload, sig_header):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Lemon Squeezy webhook signature",
        )
    try:
        event = _json.loads(payload)
    except _json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        ) from exc

    event_name = event.get("meta", {}).get("event_name", "")
    if event_name in LEMON_UPGRADE_EVENTS:
        email = extract_email_from_lemon_event(event)
        if email:
            sub_id = event.get("data", {}).get("id")
            await api_key_store.upgrade_to_pro(
                email,
                lemon_subscription_id=str(sub_id) if sub_id else None,
            )
    return {"received": True}

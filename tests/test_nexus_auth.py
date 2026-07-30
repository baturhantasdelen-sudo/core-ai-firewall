"""Nexus Shield — trial registration and payment webhook tests."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from nexus_auth import ApiKeyStore, TIER_LIMITS
import nexus_auth
import nexus_shield_fast_api


@pytest.fixture
def isolated_key_store(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> ApiKeyStore:
    store = ApiKeyStore(tmp_path / "api_keys.json")
    monkeypatch.setattr(nexus_auth, "api_key_store", store)
    monkeypatch.setattr(nexus_shield_fast_api, "api_key_store", store)
    return store


@pytest.fixture
def auth_client(isolated_key_store: ApiKeyStore) -> TestClient:
    with TestClient(nexus_shield_fast_api.app) as client:
        yield client


def test_register_trial_returns_nx_live_key(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/v1/auth/register-trial",
        json={"email": "trial.user@example.com"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["api_key"].startswith("nx_live_")
    assert body["tier"] == "trial"
    assert body["email"] == "trial.user@example.com"
    assert body["expires_at"] is not None
    assert body["requests_per_minute"] == TIER_LIMITS["trial"]["requests_per_minute"]


def test_register_trial_idempotent_for_same_email(auth_client: TestClient) -> None:
    first = auth_client.post(
        "/v1/auth/register-trial",
        json={"email": "same@example.com"},
    ).json()
    second = auth_client.post(
        "/v1/auth/register-trial",
        json={"email": "same@example.com"},
    ).json()
    assert first["api_key"] == second["api_key"]


def test_trial_key_works_on_shield_endpoint(auth_client: TestClient) -> None:
    trial = auth_client.post(
        "/v1/auth/register-trial",
        json={"email": "shield@example.com"},
    ).json()
    response = auth_client.post(
        "/v1/shield",
        headers={"X-API-Key": trial["api_key"]},
        json={"user_input": "Hello world", "session_id": "trial-test"},
    )
    assert response.status_code == 200


def test_stripe_webhook_upgrades_to_pro(auth_client: TestClient) -> None:
    trial = auth_client.post(
        "/v1/auth/register-trial",
        json={"email": "paying@example.com"},
    ).json()
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer_details": {"email": "paying@example.com"},
                "customer": "cus_test123",
            }
        },
    }
    response = auth_client.post("/v1/auth/stripe-webhook", json=event)
    assert response.status_code == 200
    record = nexus_auth.api_key_store.get(trial["api_key"])
    assert record is not None
    assert record.tier == "pro"
    assert record.expires_at is None
    assert record.requests_per_day == TIER_LIMITS["pro"]["requests_per_day"]


def test_lemon_webhook_upgrades_to_pro(auth_client: TestClient) -> None:
    trial = auth_client.post(
        "/v1/auth/register-trial",
        json={"email": "lemon@example.com"},
    ).json()
    event = {
        "meta": {"event_name": "subscription_payment_success"},
        "data": {
            "id": "sub_lemon_1",
            "attributes": {"user_email": "lemon@example.com"},
        },
    }
    response = auth_client.post("/v1/auth/lemon-webhook", json=event)
    assert response.status_code == 200
    record = nexus_auth.api_key_store.get(trial["api_key"])
    assert record is not None
    assert record.tier == "pro"


def test_register_trial_rejects_invalid_email(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/v1/auth/register-trial",
        json={"email": "not-an-email"},
    )
    assert response.status_code == 422

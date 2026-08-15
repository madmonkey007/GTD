from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from lifetrace.schemas.auth import UserResponse
from lifetrace.services.auth_service import (
    AuthTokenError,
    AuthTokenExpiredError,
    create_access_token,
    hash_password,
    normalize_email,
    verify_access_token,
    verify_password,
)
from lifetrace.storage.models import User

USER_ID = 42


def test_normalize_email_trims_and_lowercases() -> None:
    assert normalize_email("  User@Example.COM  ") == "user@example.com"


def test_password_hash_is_not_plaintext_and_verifies() -> None:
    password_hash = hash_password("correct horse battery staple")

    assert "correct horse battery staple" not in password_hash
    assert verify_password("correct horse battery staple", password_hash)
    assert not verify_password("wrong password", password_hash)


def test_access_token_round_trip_contains_user_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")

    token = create_access_token(
        user_id=USER_ID,
        email="user@example.com",
        expires_delta=timedelta(minutes=5),
    )

    claims = verify_access_token(token)

    assert claims.user_id == USER_ID
    assert claims.email == "user@example.com"


def test_expired_access_token_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")
    token = create_access_token(
        user_id=USER_ID,
        email="user@example.com",
        expires_delta=timedelta(seconds=-1),
    )

    with pytest.raises(AuthTokenExpiredError):
        verify_access_token(token, now=datetime.now(UTC))


def test_tampered_access_token_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")
    token = create_access_token(
        user_id=USER_ID,
        email="user@example.com",
        expires_delta=timedelta(minutes=5),
    )
    tampered = f"{token[:-1]}x"

    with pytest.raises(AuthTokenError):
        verify_access_token(tampered)


def test_user_model_and_response_shape() -> None:
    user = User(
        id=1,
        email="user@example.com",
        password_hash="hash",
        display_name="User",
    )

    response = UserResponse.model_validate(user)

    assert response.model_dump() == {
        "id": 1,
        "email": "user@example.com",
        "display_name": "User",
    }

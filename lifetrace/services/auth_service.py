from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from sqlalchemy.exc import IntegrityError

from lifetrace.schemas.auth import AccessTokenClaims
from lifetrace.storage.models import User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

_HASH_ALGORITHM = "pbkdf2_sha256"
_HASH_ITERATIONS = 210_000
_TOKEN_VERSION = 1


class AuthTokenError(Exception):
    """Raised when an access token is malformed or has an invalid signature."""


class AuthTokenExpiredError(AuthTokenError):
    """Raised when an access token is valid but expired."""


class DuplicateUserEmailError(Exception):
    """Raised when registering an email that already exists."""


class InvalidCredentialsError(Exception):
    """Raised when login credentials do not match any account."""


class AuthService:
    """Database-backed user registration and login service."""

    def __init__(self, session: Session):
        self.session = session

    def register_user(
        self,
        *,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> User:
        normalized = normalize_email(email)
        existing = self.get_user_by_email(normalized)
        if existing:
            raise DuplicateUserEmailError(normalized)
        user = User(
            email=normalized,
            password_hash=hash_password(password),
            display_name=display_name.strip() if display_name else None,
        )
        self.session.add(user)
        try:
            self.session.flush()
        except IntegrityError as exc:
            raise DuplicateUserEmailError(normalized) from exc
        self.session.refresh(user)
        return user

    def authenticate_user(self, *, email: str, password: str) -> User:
        user = self.get_user_by_email(normalize_email(email))
        if not user or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError("invalid email or password")
        return user

    def get_user_by_email(self, email: str) -> User | None:
        return (
            self.session.query(User)
            .filter(User.email == normalize_email(email), User.deleted_at.is_(None))
            .first()
        )

    def get_user_by_id(self, user_id: int) -> User | None:
        return (
            self.session.query(User)
            .filter(User.id == user_id, User.deleted_at.is_(None))
            .first()
        )

    def update_display_name(self, user: User, *, display_name: str | None) -> User:
        user.display_name = display_name.strip() if display_name else None
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user

    def update_avatar(self, user: User, *, data: bytes, mime: str) -> User:
        user.avatar_data = data
        user.avatar_mime = mime
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user

    def clear_avatar(self, user: User) -> User:
        user.avatar_data = None
        user.avatar_mime = None
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user

    def change_password(
        self, user: User, *, old_password: str, new_password: str
    ) -> User:
        if not verify_password(old_password, user.password_hash):
            raise InvalidCredentialsError("incorrect old password")
        user.password_hash = hash_password(new_password)
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _HASH_ITERATIONS,
    )
    return "$".join(
        [
            _HASH_ALGORITHM,
            str(_HASH_ITERATIONS),
            _b64encode(salt),
            _b64encode(digest),
        ]
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = password_hash.split("$", 3)
        if algorithm != _HASH_ALGORITHM:
            return False
        iterations = int(iterations_text)
        salt = _b64decode(salt_text)
        expected = _b64decode(digest_text)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual, expected)


def create_access_token(
    *,
    user_id: int,
    email: str,
    expires_delta: timedelta | None = None,
    now: datetime | None = None,
) -> str:
    issued_at = now or datetime.now(UTC)
    expires_at = issued_at + (expires_delta or timedelta(minutes=_token_expire_minutes()))
    payload = {
        "v": _TOKEN_VERSION,
        "sub": str(user_id),
        "email": normalize_email(email),
        "exp": int(expires_at.timestamp()),
    }
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = ".".join(
        [
            _b64encode_json(header),
            _b64encode_json(payload),
        ]
    )
    signature = _sign(signing_input)
    return f"{signing_input}.{signature}"


def verify_access_token(token: str, *, now: datetime | None = None) -> AccessTokenClaims:
    try:
        header_text, payload_text, signature = token.split(".", 2)
    except ValueError as exc:
        raise AuthTokenError("invalid token format") from exc

    signing_input = f"{header_text}.{payload_text}"
    if not hmac.compare_digest(signature, _sign(signing_input)):
        raise AuthTokenError("invalid token signature")

    try:
        header = _json_from_b64(header_text)
        payload = _json_from_b64(payload_text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise AuthTokenError("invalid token payload") from exc

    if header.get("alg") != "HS256" or header.get("typ") != "JWT":
        raise AuthTokenError("unsupported token header")

    expires_at = int(payload["exp"])
    current_time = int((now or datetime.now(UTC)).timestamp())
    if expires_at <= current_time:
        raise AuthTokenExpiredError("token expired")

    return AccessTokenClaims(
        user_id=int(payload["sub"]),
        email=str(payload["email"]),
        expires_at=expires_at,
    )


def _token_expire_minutes() -> int:
    raw = os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080")
    try:
        return int(raw)
    except ValueError:
        return 10080


def _secret_key() -> bytes:
    secret = os.environ.get("JWT_SECRET_KEY", "").strip()
    if not secret:
        secret = "lifetrace-dev-only-secret"
    return secret.encode("utf-8")


def _sign(signing_input: str) -> str:
    digest = hmac.new(_secret_key(), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return _b64encode(digest)


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _b64encode_json(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return _b64encode(raw)


def _json_from_b64(value: str) -> dict[str, Any]:
    decoded = _b64decode(value).decode("utf-8")
    data = json.loads(decoded)
    if not isinstance(data, dict):
        raise ValueError("token JSON payload must be an object")
    return data

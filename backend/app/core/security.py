import hashlib
import secrets
import time

from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import get_settings

ALGORITHM = "HS256"


class InvalidTokenError(Exception):
    pass


class AccessTokenClaims(BaseModel):
    sub: str
    workspace_id: str | None = None
    role: str | None = None
    iat: int
    exp: int


def create_access_token(
    user_id: str, workspace_id: str | None = None, role: str | None = None
) -> str:
    """Access JWT (13-Authentication.md §13.3). workspace_id/role are None until
    the member has selected a workspace via POST /auth/switch-workspace."""
    settings = get_settings()
    now = int(time.time())
    claims = {
        "sub": user_id,
        "workspace_id": workspace_id,
        "role": role,
        "iat": now,
        "exp": now + settings.jwt_access_ttl_minutes * 60,
    }
    token: str = jwt.encode(claims, settings.jwt_signing_key, algorithm=ALGORITHM)
    return token


def decode_access_token(token: str) -> AccessTokenClaims:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_signing_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise InvalidTokenError(str(exc)) from exc
    return AccessTokenClaims.model_validate(payload)


def generate_opaque_token() -> str:
    """High-entropy opaque token for refresh tokens and guest session tokens."""
    return secrets.token_urlsafe(32)


def hash_secret(value: str) -> str:
    """One-way hash for values we only ever need to compare, never recover
    (refresh tokens, OTP codes) - 13-Authentication.md §13.1/§13.2, 11-Database.md §11.14/§11.15."""
    settings = get_settings()
    return hashlib.sha256(f"{settings.jwt_signing_key}:{value}".encode()).hexdigest()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

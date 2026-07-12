from dataclasses import dataclass
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.email import send_email
from app.core.errors import AuthenticationError, PermissionDeniedError, ValidationError
from app.core.security import (
    create_access_token,
    generate_opaque_token,
    generate_otp_code,
    hash_secret,
)
from app.modules.auth.google_oauth import exchange_code_for_user_info
from app.modules.auth.repository import OtpRepository, RefreshTokenRepository, UserRepository
from app.modules.auth.schemas import UserOut
from app.modules.workspaces.repository import MembershipRepository


@dataclass(frozen=True)
class IssuedTokens:
    """Internal to the auth module - the router splits this into the JSON body
    (access_token + user) and an httpOnly cookie (refresh_token), never both in
    the body (13-Authentication.md §13.6)."""

    access_token: str
    refresh_token: str
    user: UserOut


def _user_out(doc: dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        email=doc["email"],
        name=doc["name"],
        avatar_url=doc.get("avatar_url"),
    )


async def _issue_tokens(
    db: AsyncIOMotorDatabase[dict[str, Any]], user_doc: dict[str, Any]
) -> IssuedTokens:
    """Raw login always returns a workspace-less token (13-Authentication.md §13.3) -
    the client calls /auth/switch-workspace next (auto-selecting if there's exactly
    one membership, or prompting if there are several / none yet)."""
    user_id = str(user_doc["_id"])
    access_token = create_access_token(user_id)

    refresh_repo = RefreshTokenRepository(db)
    raw_refresh = generate_opaque_token()
    family_id = generate_opaque_token()
    settings = get_settings()
    await refresh_repo.create(
        user_id=user_doc["_id"],
        token_hash=hash_secret(raw_refresh),
        family_id=family_id,
        ttl_days=settings.jwt_refresh_ttl_days,
    )

    return IssuedTokens(
        access_token=access_token, refresh_token=raw_refresh, user=_user_out(user_doc)
    )


async def login_with_google(db: AsyncIOMotorDatabase[dict[str, Any]], code: str) -> IssuedTokens:
    user_info = await exchange_code_for_user_info(code)
    if not user_info.email_verified:
        raise ValidationError("Google account email is not verified.")

    user_repo = UserRepository(db)
    existing = await user_repo.find_by_email(user_info.email)
    if existing is None:
        existing = await user_repo.create(
            email=user_info.email,
            name=user_info.name,
            avatar_url=user_info.avatar_url,
            auth_provider="google",
        )
    else:
        await user_repo.touch_login(existing["_id"], "google")

    return await _issue_tokens(db, existing)


async def request_otp(db: AsyncIOMotorDatabase[dict[str, Any]], email: str) -> None:
    otp_repo = OtpRepository(db)
    settings = get_settings()
    code = generate_otp_code()
    await otp_repo.create(
        email=email, code_hash=hash_secret(code), ttl_minutes=settings.otp_ttl_minutes
    )
    await send_email(
        to=email,
        subject="Your Backline sign-in code",
        html=f"<p>Your sign-in code is <strong>{code}</strong>. It expires in "
        f"{settings.otp_ttl_minutes} minutes.</p>",
    )


async def verify_otp(
    db: AsyncIOMotorDatabase[dict[str, Any]], email: str, code: str
) -> IssuedTokens:
    otp_repo = OtpRepository(db)
    settings = get_settings()
    otp_doc = await otp_repo.find_latest_active(email)
    if otp_doc is None:
        raise ValidationError("No active code for this email. Request a new one.")

    if otp_doc["attempts"] >= settings.otp_max_attempts:
        raise ValidationError("Too many attempts. Request a new code.")

    if otp_doc["code_hash"] != hash_secret(code):
        await otp_repo.increment_attempts(otp_doc["_id"])
        raise ValidationError("Incorrect code.")

    await otp_repo.mark_consumed(otp_doc["_id"])

    user_repo = UserRepository(db)
    existing = await user_repo.find_by_email(email)
    if existing is None:
        existing = await user_repo.create(
            email=email, name=email.split("@")[0], avatar_url=None, auth_provider="email_otp"
        )
    else:
        await user_repo.touch_login(existing["_id"], "email_otp")

    return await _issue_tokens(db, existing)


async def refresh_tokens(
    db: AsyncIOMotorDatabase[dict[str, Any]], raw_refresh_token: str
) -> IssuedTokens:
    refresh_repo = RefreshTokenRepository(db)
    token_hash = hash_secret(raw_refresh_token)
    token_doc = await refresh_repo.find_by_hash(token_hash)

    if token_doc is None:
        raise AuthenticationError("Invalid refresh token.")

    if token_doc["revoked_at"] is not None:
        # Reuse of an already-rotated token: theft detection (13-Authentication.md §13.6).
        await refresh_repo.revoke_family(token_doc["family_id"])
        raise AuthenticationError("Refresh token has already been used. Session revoked.")

    user_repo = UserRepository(db)
    user_doc = await user_repo.find_by_id(str(token_doc["user_id"]))
    if user_doc is None:
        raise AuthenticationError("User no longer exists.")

    new_raw = generate_opaque_token()
    new_hash = hash_secret(new_raw)
    settings = get_settings()
    await refresh_repo.create(
        user_id=token_doc["user_id"],
        token_hash=new_hash,
        family_id=token_doc["family_id"],
        ttl_days=settings.jwt_refresh_ttl_days,
    )
    await refresh_repo.rotate(old_token_hash=token_hash, new_token_hash=new_hash)

    access_token = create_access_token(str(user_doc["_id"]))
    return IssuedTokens(access_token=access_token, refresh_token=new_raw, user=_user_out(user_doc))


async def logout(db: AsyncIOMotorDatabase[dict[str, Any]], raw_refresh_token: str) -> None:
    refresh_repo = RefreshTokenRepository(db)
    await refresh_repo.revoke_by_hash(hash_secret(raw_refresh_token))


async def switch_workspace(
    db: AsyncIOMotorDatabase[dict[str, Any]], user_id: str, workspace_id: str
) -> str:
    membership_repo = MembershipRepository(db)
    membership = await membership_repo.find(workspace_id=workspace_id, user_id=user_id)
    if membership is None:
        raise PermissionDeniedError("Not a member of this workspace.")

    return create_access_token(user_id, workspace_id=workspace_id, role=membership["role"])

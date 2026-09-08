"""Profile and login-session operations; users are global, never guest accounts."""

from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.core.db import get_db
from app.core.errors import NotFoundError, ValidationError
from app.core.session import Session, get_current_session
from app.modules.auth.repository import RefreshTokenRepository, UserRepository

router = APIRouter(prefix="/auth/account", tags=["account"])


class Preferences(BaseModel):
    locale: Literal["en", "hi-IN"] = "en"
    timezone: str = "UTC"
    email_on_comment: bool = True
    email_on_mention: bool = True
    daily_digest: bool = True
    weekly_summary: bool = False

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError) as exc:
            raise ValueError("Choose a valid timezone.") from exc
        return value


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    professional_role: str = Field(default="", max_length=100)
    preferences: Preferences = Field(default_factory=Preferences)

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Your name is required.")
        return value.strip()


class ProfileOut(ProfileUpdate):
    id: str
    email: str
    avatar_url: str | None = None


class SessionOut(BaseModel):
    id: str
    current: bool
    last_active_at: datetime
    expires_at: datetime


def profile_out(doc: dict[str, Any]) -> ProfileOut:
    return ProfileOut(
        id=str(doc["_id"]),
        email=doc["email"],
        name=doc["name"],
        avatar_url=doc.get("avatar_url"),
        professional_role=doc.get("professional_role", ""),
        preferences=Preferences(**doc.get("preferences", {})),
    )


@router.get("", response_model=ProfileOut)
async def profile(session: Session = Depends(get_current_session)) -> ProfileOut:
    doc = await UserRepository(get_db()).find_by_id(session.user_id)
    if doc is None:
        raise NotFoundError("Account not found.")
    return profile_out(doc)


@router.patch("", response_model=ProfileOut)
async def update_profile(
    body: ProfileUpdate, session: Session = Depends(get_current_session)
) -> ProfileOut:
    repo = UserRepository(get_db())
    await repo.update_profile(session.user_id, body.model_dump())
    return await profile(session)


@router.get("/sessions", response_model=list[SessionOut])
async def sessions(session: Session = Depends(get_current_session)) -> list[SessionOut]:
    rows = await RefreshTokenRepository(get_db()).list_active(session.user_id)
    return [
        SessionOut(
            id=row["family_id"],
            current=row["family_id"] == session.sid,
            last_active_at=row["issued_at"],
            expires_at=row["expires_at"],
        )
        for row in rows
    ]


@router.delete("/sessions/others", status_code=204)
async def revoke_other_sessions(session: Session = Depends(get_current_session)) -> None:
    if not session.sid:
        raise ValidationError("Sign in again before managing sessions.")
    await RefreshTokenRepository(get_db()).revoke_other_sessions(session.user_id, session.sid)


@router.delete("/sessions/{family_id}", status_code=204)
async def revoke_session(family_id: str, session: Session = Depends(get_current_session)) -> None:
    repo = RefreshTokenRepository(get_db())
    if not await repo.family_is_active(session.user_id, family_id):
        raise NotFoundError("Session not found.")
    await repo.revoke_family(family_id)

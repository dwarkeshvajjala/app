from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, Request

from app.core.db import get_db
from app.core.session import Session, get_current_session
from app.modules.feature_flags.repository import FeatureFlagRepository


async def load_feature_flags(db: Any, workspace_id: str | None) -> dict[str, bool]:
    """18-Storage-Deployment.md §18.7: global default first, then a workspace-specific
    row overrides it - never the other way around, or a workspace opted into an early
    flag would silently lose it the moment someone flips the global default."""
    docs = await FeatureFlagRepository(db).list_for_workspace(workspace_id)
    flags: dict[str, bool] = {}
    for doc in sorted(docs, key=lambda d: d["workspace_id"] is not None):
        flags[doc["key"]] = doc["enabled"]
    return flags


def use_feature_flag(key: str) -> Callable[..., Coroutine[Any, Any, bool]]:
    """`use_feature_flag("some-flag")` as a route dependency, per §18.7 - "read once at
    request-start into a request-scoped context": every flag check within the same
    request shares one cached lookup (`request.state`), so a route depending on several
    flags doesn't re-query per flag."""

    async def _dependency(
        request: Request, session: Session = Depends(get_current_session)
    ) -> bool:
        cache: dict[str | None, dict[str, bool]] | None = getattr(
            request.state, "feature_flags", None
        )
        if cache is None:
            cache = {}
            request.state.feature_flags = cache
        if session.workspace_id not in cache:
            cache[session.workspace_id] = await load_feature_flags(get_db(), session.workspace_id)
        return cache[session.workspace_id].get(key, False)

    return _dependency

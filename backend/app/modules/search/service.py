from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.search.repository import SearchRepository
from app.modules.search.schemas import SearchOut, SearchResult


async def search(
    db: AsyncIOMotorDatabase[dict[str, Any]], workspace_id: str, q: str, limit: int
) -> SearchOut:
    if len(q.strip()) < 2:
        return SearchOut(items=[])
    rows = await SearchRepository(db).search(workspace_id, q.strip(), limit)
    return SearchOut(
        items=[SearchResult(**row) for row in rows[:limit]],
        has_more=len(rows) > limit,
    )

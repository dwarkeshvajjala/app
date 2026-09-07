"""Inspect the login-startup index fix; pass --apply to create it additively.

Run from backend: python -m scripts.migrate_comment_request_index [--apply]
No documents or existing indexes are changed or deleted.
"""

import argparse
import asyncio
import json
from typing import Any

from app.core.db import close_client, get_db
from app.core.indexes import AUDIT_BATCH_03_INDEXES, ensure_additive_indexes


async def inspect(*, apply: bool) -> dict[str, Any]:
    db = get_db()
    spec = AUDIT_BATCH_03_INDEXES[0]
    indexes = await db.comments.index_information()
    present = spec.name in indexes
    if apply:
        await ensure_additive_indexes(db, AUDIT_BATCH_03_INDEXES)
    return {
        "mode": "apply" if apply else "dry-run",
        "existing_indexes_preserved": True,
        "legacy_sparse_index_present": "comments_workspace_client_request_id" in indexes,
        "present": present,
        "would_create": [] if present else [
            {"name": spec.name, "keys": list(spec.keys), "options": spec.options}
        ],
        "created": [spec.name] if apply and not present else [],
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Create the missing index.")
    args = parser.parse_args()
    try:
        print(json.dumps(await inspect(apply=args.apply), indent=2))
    finally:
        await close_client()


if __name__ == "__main__":
    asyncio.run(main())

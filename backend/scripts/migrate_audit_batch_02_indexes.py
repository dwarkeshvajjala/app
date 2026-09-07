"""Dry-run-first additive index migration for audit batch 02.

Usage:
    python scripts/migrate_audit_batch_02_indexes.py
    python scripts/migrate_audit_batch_02_indexes.py --apply
"""

import argparse
import asyncio
import json
from typing import Any

from app.core.db import close_client, get_db
from app.core.indexes import AUDIT_BATCH_02_INDEXES, ensure_additive_indexes


async def inspect(*, apply: bool) -> dict[str, Any]:
    db = get_db()
    missing: list[dict[str, Any]] = []
    present: list[str] = []
    for spec in AUDIT_BATCH_02_INDEXES:
        indexes = await db[spec.collection].index_information()
        if spec.name in indexes:
            present.append(spec.name)
        else:
            missing.append(
                {
                    "collection": spec.collection,
                    "name": spec.name,
                    "keys": list(spec.keys),
                    "options": spec.options,
                }
            )
    if apply:
        await ensure_additive_indexes(db, AUDIT_BATCH_02_INDEXES)
    return {
        "mode": "apply" if apply else "dry-run",
        "existing_indexes_preserved": True,
        "present": present,
        "would_create": missing,
        "created": [row["name"] for row in missing] if apply else [],
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create missing indexes. Omit for the default read-only dry-run.",
    )
    args = parser.parse_args()
    try:
        print(json.dumps(await inspect(apply=args.apply), indent=2, default=str))
    finally:
        await close_client()


if __name__ == "__main__":
    asyncio.run(main())

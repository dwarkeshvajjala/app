from bson import ObjectId
from bson.errors import InvalidId


def to_object_id(value: str) -> ObjectId | None:
    """Repositories look up documents by a string id (path params, JWT claims); this
    turns a possibly-malformed string into `None` instead of letting bson raise, so
    callers can treat "not a valid id" and "valid id, not found" the same way (both
    become NotFoundError, never a 500)."""
    try:
        return ObjectId(value)
    except InvalidId:
        return None

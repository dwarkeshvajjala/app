from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

NotificationType = Literal["comment_assigned", "integration_disconnected"]


class NotificationOut(BaseModel):
    id: str
    type: NotificationType
    payload: dict[str, Any]
    read_at: datetime | None
    created_at: datetime

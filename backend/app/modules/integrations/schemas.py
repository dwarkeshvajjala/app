from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

IntegrationType = Literal["slack", "clickup", "trello"]


class SlackIntegrationCreate(BaseModel):
    type: Literal["slack"] = "slack"
    webhook_url: str = Field(min_length=1)
    notify_status_changes: bool = True
    # 17.2: "team-only comments never post to a shared Slack channel unless the admin
    # explicitly configures a private channel" - there's no way to detect from a webhook
    # URL alone whether the channel behind it is private, so this is an explicit opt-in
    # the connect-flow UI must warn about, not an automatic detection.
    notify_team_layer: bool = False


class TrelloIntegrationCreate(BaseModel):
    type: Literal["trello"] = "trello"
    api_key: str = Field(min_length=1)
    token: str = Field(min_length=1)
    list_id: str = Field(min_length=1)


class ClickUpIntegrationCreate(BaseModel):
    type: Literal["clickup"] = "clickup"
    oauth_code: str = Field(min_length=1)
    list_id: str = Field(min_length=1)


IntegrationCreate = Annotated[
    SlackIntegrationCreate | TrelloIntegrationCreate | ClickUpIntegrationCreate,
    Field(discriminator="type"),
]


class IntegrationOut(BaseModel):
    id: str
    workspace_id: str
    type: IntegrationType
    # Never the secret (webhook_url, api_key/token, oauth_token_encrypted) - just enough
    # non-sensitive config to render the connected state in the UI.
    config_summary: dict[str, Any]
    connected_by: str
    created_at: datetime


class CreateClickUpTaskResult(BaseModel):
    task_url: str
    task_id: str


class CreateTrelloCardResult(BaseModel):
    card_url: str
    card_id: str

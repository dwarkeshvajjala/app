from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import NotFoundError, ValidationError
from app.core.events import append_event
from app.modules.clients.repository import ClientRepository
from app.modules.clients.schemas import ClientCreate, ClientOut, ClientUpdate


def client_out(doc: dict[str, Any]) -> ClientOut:
    return ClientOut(**{**doc, "id": str(doc["_id"])})


async def list_clients(
    db: AsyncIOMotorDatabase[dict[str, Any]], workspace_id: str
) -> list[ClientOut]:
    return [client_out(doc) for doc in await ClientRepository(db).list(workspace_id)]


async def create_client(
    db: AsyncIOMotorDatabase[dict[str, Any]], workspace_id: str, actor_id: str, body: ClientCreate
) -> ClientOut:
    if not body.name.strip():
        raise ValidationError("Client name is required.")
    fields = body.model_dump()
    fields.update(name=body.name.strip(), created_by=actor_id)
    doc = await ClientRepository(db).create(workspace_id, fields)
    await append_event(
        db,
        workspace_id=workspace_id,
        type="client.created",
        actor_type="member",
        actor_id=actor_id,
        payload={"client_id": str(doc["_id"]), "name": doc["name"]},
    )
    return client_out(doc)


async def update_client(
    db: AsyncIOMotorDatabase[dict[str, Any]],
    workspace_id: str,
    client_id: str,
    actor_id: str,
    body: ClientUpdate | None,
) -> ClientOut:
    repo = ClientRepository(db)
    doc = await repo.find(workspace_id, client_id)
    if doc is None:
        raise NotFoundError("Client not found.")
    fields = body.model_dump(exclude_unset=True) if body else {"archived_at": datetime.now(UTC)}
    if "name" in fields:
        if not fields["name"] or not fields["name"].strip():
            raise ValidationError("Client name is required.")
        fields["name"] = fields["name"].strip()
    if "contact_name" in fields and fields["contact_name"] is None:
        raise ValidationError("Contact name cannot be null.")
    await repo.update(workspace_id, client_id, fields)
    await append_event(
        db,
        workspace_id=workspace_id,
        type="client.updated" if body else "client.archived",
        actor_type="member",
        actor_id=actor_id,
        payload={"client_id": client_id, "name": doc["name"]},
    )
    return client_out({**doc, **fields, "updated_at": datetime.now(UTC)})

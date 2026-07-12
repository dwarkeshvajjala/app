from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.core.session import Actor, get_current_actor
from app.modules.storage import service as storage_service
from app.modules.storage.schemas import UploadOut, UploadRequest

router = APIRouter(tags=["storage"])


@router.post("/uploads", response_model=UploadOut, status_code=201)
async def create_upload(
    body: UploadRequest, actor: Actor = Depends(get_current_actor)
) -> UploadOut:
    return await storage_service.create_upload_url(
        get_db(), actor=actor, project_id=body.project_id, content_type=body.content_type
    )

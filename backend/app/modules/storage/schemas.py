from pydantic import BaseModel, Field


class UploadRequest(BaseModel):
    project_id: str
    content_type: str = Field(pattern="^image/(jpeg|png|webp)$")


class UploadOut(BaseModel):
    upload_url: str
    key: str

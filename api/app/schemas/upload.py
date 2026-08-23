from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    url: str
    size: int
    mime_type: str
    created_at: datetime


class UploadOut(BaseModel):
    url: str
    kind: str
    size: int
    mime_type: str

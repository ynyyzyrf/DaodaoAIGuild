from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class TutorialCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    summary: str = ""
    content: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1, max_length=64)


class TutorialOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    author_id: int
    title: str
    slug: str
    summary: str
    category: str
    status: str
    view_count: int
    like_count: int
    created_at: datetime
    updated_at: datetime
    author: UserOut | None = None


class TutorialDetailOut(TutorialOut):
    content: str

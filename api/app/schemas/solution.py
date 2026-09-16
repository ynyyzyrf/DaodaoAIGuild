from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EnterpriseSolutionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    subtitle: str = ""
    category: str = Field("", max_length=64)
    industry: str = Field("", max_length=64)
    scenario: str = Field("", max_length=64)
    delivery_cycle: str = Field("", max_length=64)
    budget_range: str = Field("", max_length=64)
    cover_image_url: str = Field("", max_length=512)
    tags: list[str] = Field(default_factory=list, max_length=8)
    case_count: int = Field(0, ge=0)


class EnterpriseSolutionReview(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    reason: str = Field(..., min_length=1, max_length=500)


class EnterpriseSolutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    company_name: str = ""
    creator_id: int
    title: str
    subtitle: str
    category: str
    industry: str
    scenario: str
    delivery_cycle: str
    budget_range: str
    cover_image_url: str
    tags: list[str] = Field(default_factory=list)
    case_count: int
    status: str
    review_note: str
    created_at: datetime
    updated_at: datetime

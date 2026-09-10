from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    logo_url: str = ""
    description: str = ""
    location: str = ""
    contact_name: str = Field("", max_length=64)
    contact_email: str = Field("", max_length=128)
    service_fields: str = ""
    strengths: str = ""
    cases: str = ""


class CompanyReview(BaseModel):
    status: str = Field(pattern="^(requires_changes|approved|rejected)$")
    reason: str = Field(..., min_length=1, max_length=500)


class CompanyMemberUserOut(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: str
    company_role: str = "none"
    fde_status: str = "none"


class CompanyJoinRequestUserOut(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: str


class CompanyMembersOut(BaseModel):
    owner: CompanyMemberUserOut | None = None
    admins: list[CompanyMemberUserOut] = []
    lobster_knights: list[CompanyMemberUserOut] = []


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    applicant_id: int
    name: str
    logo_url: str
    description: str
    location: str
    contact_name: str
    contact_email: str
    service_fields: str
    strengths: str
    cases: str
    status: str
    review_note: str
    lobster_knight_count: int = 0
    members: CompanyMembersOut = Field(default_factory=CompanyMembersOut)
    created_at: datetime
    updated_at: datetime


class CompanyJoinRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    user_id: int
    status: str
    requested_at: datetime
    processed_at: datetime | None = None
    processed_by: int | None = None


class CompanyJoinRequestWithUserOut(CompanyJoinRequestOut):
    user: CompanyJoinRequestUserOut


class CompanyMyStateOut(BaseModel):
    active_company: CompanyOut | None = None
    pending_join_request: CompanyJoinRequestOut | None = None
    managed_companies: list[CompanyOut] = Field(default_factory=list)


class CompanyAdminAdd(BaseModel):
    user_id: int

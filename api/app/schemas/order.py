from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DemandOrderCreate(BaseModel):
    enterprise_name: str = Field(min_length=1, max_length=128)
    contact_name: str = Field("", max_length=64)
    contact_email: str = Field("", max_length=128)
    product_name: str = Field("", max_length=128)
    pmdesktop_product_id: str = Field("", max_length=128)
    budget_amount: int = Field(0, ge=0)
    budget_note: str = ""
    expected_delivery_at: datetime | None = None
    title: str = Field(min_length=1, max_length=160)
    description: str = ""
    business_background: str = ""
    deliverable_expectation: str = ""
    attachments: str = ""


class DemandOrderReview(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    reason: str = Field(..., min_length=1, max_length=500)


class DemandOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creator_id: int
    enterprise_name: str
    contact_name: str
    contact_email: str
    product_name: str
    pmdesktop_product_id: str
    pmdesktop_sync_status: str
    pmdesktop_requirement_id: str
    pmdesktop_user_voice_id: str
    pmdesktop_sync_error: str
    pmdesktop_synced_at: datetime | None = None
    budget_amount: int
    budget_note: str
    expected_delivery_at: datetime | None = None
    title: str
    description: str
    business_background: str
    deliverable_expectation: str
    attachments: str
    status: str
    review_note: str
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    claimed_company_id: int | None = None
    claimed_company_name: str = ""
    assigned_fde_user_id: int | None = None
    created_at: datetime
    updated_at: datetime


class ExternalOrderCreateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    enterprise_name: str
    contact_name: str
    contact_email: str
    title: str
    status: str
    next_step: str = "platform_review"
    created_at: datetime


class OrderClaimCreate(BaseModel):
    company_id: int
    claim_note: str = ""


class OrderClaimSelect(BaseModel):
    claim_id: int


class OrderClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    company_id: int
    operator_user_id: int
    status: str
    claim_note: str
    created_at: datetime
    updated_at: datetime


class AssignFde(BaseModel):
    fde_user_id: int


class OrderWorkStatusUpdate(BaseModel):
    status: str = Field(pattern="^(following|completed)$")


class OrderQuoteCreate(BaseModel):
    amount: int = Field(0, ge=0)
    currency: str = Field("CNY", max_length=16)
    start_at: datetime | None = None
    delivery_at: datetime | None = None
    scope: str = ""
    deliverables: str = ""
    exclusions: str = ""
    risks: str = ""
    enterprise_dependencies: str = ""


class OrderQuoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    company_id: int
    amount: int
    currency: str
    start_at: datetime | None = None
    delivery_at: datetime | None = None
    scope: str
    deliverables: str
    exclusions: str
    risks: str
    enterprise_dependencies: str
    owner_user_id: int
    status: str
    created_at: datetime
    updated_at: datetime


class SimulatedPaymentMark(BaseModel):
    note: str = ""


class OrderDeliveryCreate(BaseModel):
    summary: str = ""
    deliverable_urls: str = ""


class OrderDeliveryAccept(BaseModel):
    acceptance_note: str = ""


class OrderDeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    company_id: int
    submitted_by: int
    summary: str
    deliverable_urls: str
    status: str
    acceptance_note: str
    accepted_by: int | None = None
    accepted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class OrderSettle(BaseModel):
    note: str = ""


class OrderReviewCreate(BaseModel):
    target_type: str = Field(pattern="^(company|fde|delivery)$")
    target_id: int
    score: int = Field(ge=1, le=5)
    content: str = ""
    is_public: bool = False


class OrderReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    reviewer_id: int
    reviewer_role: str
    target_type: str
    target_id: int
    score: int
    content: str
    is_public: bool
    created_at: datetime


class FdeProjectRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    fde_user_id: int
    company_id: int
    project_title: str
    product_name: str
    role: str
    skill_tags: str
    enterprise_score: int | None = None
    company_score: int | None = None
    is_public_case: bool
    completed_at: datetime | None = None
    created_at: datetime

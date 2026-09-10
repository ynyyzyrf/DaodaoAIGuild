from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    applicant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    logo_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    contact_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    contact_email: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    service_fields: Mapped[str] = mapped_column(Text, nullable=False, default="")
    strengths: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cases: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    review_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CompanyMember(Base):
    __tablename__ = "company_members"
    __table_args__ = (UniqueConstraint("company_id", "user_id", name="uq_company_members_company_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    company_role: Mapped[str] = mapped_column(String(16), nullable=False, default="none")
    fde_status: Mapped[str] = mapped_column(String(16), nullable=False, default="none", index=True)
    role_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fde_joined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fde_exited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CompanyJoinRequest(Base):
    __tablename__ = "company_join_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    processed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

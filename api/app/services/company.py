from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import to_naive_utc, utc_now
from app.core.exceptions import ApiError
from app.models.company import Company, CompanyJoinRequest, CompanyMember
from app.models.user import User
from app.schemas.company import (
    CompanyJoinRequestOut,
    CompanyJoinRequestUserOut,
    CompanyJoinRequestWithUserOut,
    CompanyMembersOut,
    CompanyMemberUserOut,
    CompanyMyStateOut,
    CompanyOut,
)

ENDED_REQUEST_STATUSES = {"approved", "rejected", "cancelled", "expired"}


class CompanyService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_company(self, applicant: User, data) -> Company:
        company = Company(applicant_id=applicant.id, **data.model_dump())
        self.session.add(company)
        await self.session.commit()
        await self.session.refresh(company)
        return company

    async def submit_company(self, company_id: int, actor: User) -> Company:
        company = await self._get_company(company_id)
        if company.applicant_id != actor.id:
            raise ApiError(code=43003, message="只有入驻申请人可以提交公司资料", status_code=403)
        if company.status not in ("draft", "requires_changes", "rejected"):
            raise ApiError(code=43004, message="当前公司状态不可提交", status_code=409)
        company.status = "pending"
        company.submitted_at = to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(company)
        return company

    async def review_company(self, company_id: int, admin: User, status: str, reason: str) -> Company:
        company = await self._get_company(company_id)
        if company.status not in ("pending", "requires_changes") and status != "approved":
            raise ApiError(code=43004, message="当前公司状态不可审核", status_code=409)
        company.status = status
        company.review_note = reason
        company.reviewed_by = admin.id
        company.reviewed_at = to_naive_utc(utc_now())
        if status == "approved":
            await self._ensure_exact_owner(company, company.applicant_id)
        await self.session.commit()
        await self.session.refresh(company)
        return company

    async def add_admin(self, company_id: int, actor: User, user_id: int) -> CompanyMember:
        company = await self._get_company(company_id)
        self._require_approved(company)
        await self._require_company_role(company_id, actor.id)
        target = await self.session.get(User, user_id)
        if target is None:
            raise ApiError(code=40002, message="用户不存在", status_code=404)
        await self._ensure_alignment_for_company_role(company_id, user_id)
        member = await self._get_member(company_id, user_id)
        if member is None:
            member = CompanyMember(
                company_id=company_id,
                user_id=user_id,
                company_role="admin",
                fde_status="none",
                role_started_at=to_naive_utc(utc_now()),
            )
            self.session.add(member)
        elif member.company_role != "owner":
            member.company_role = "admin"
            member.role_started_at = member.role_started_at or to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def create_join_request(self, company_id: int, actor: User) -> CompanyJoinRequest:
        company = await self._get_company(company_id)
        self._require_approved(company)
        if not actor.is_verified_fde:
            raise ApiError(code=43010, message="只有已确认的龙虾骑士可以申请加入公司", status_code=403)
        if await self._active_fde_member(actor.id) is not None:
            raise ApiError(code=43011, message="你已有正式所属咨询公司", status_code=409)
        if await self._pending_join_request(actor.id) is not None:
            raise ApiError(code=43012, message="你已有待处理加入申请", status_code=409)
        await self._ensure_alignment_for_fde_belonging(company_id, actor.id)

        req = CompanyJoinRequest(company_id=company_id, user_id=actor.id, status="pending")
        self.session.add(req)
        await self.session.commit()
        await self.session.refresh(req)
        return req

    async def approve_join_request(self, company_id: int, request_id: int, actor: User) -> CompanyMember:
        company = await self._get_company(company_id)
        self._require_approved(company)
        await self._require_company_role(company_id, actor.id)
        req = await self._get_join_request(company_id, request_id)
        if req.status != "pending":
            raise ApiError(code=43013, message="加入申请已结束", status_code=409)
        target = await self.session.get(User, req.user_id)
        if target is None or not target.is_verified_fde:
            raise ApiError(code=43010, message="只有已确认的龙虾骑士可以加入公司", status_code=403)
        if await self._active_fde_member(req.user_id) is not None:
            raise ApiError(code=43011, message="该龙虾骑士已有正式所属咨询公司", status_code=409)
        await self._ensure_alignment_for_fde_belonging(company_id, req.user_id)

        member = await self._get_member(company_id, req.user_id)
        if member is None:
            member = CompanyMember(company_id=company_id, user_id=req.user_id, company_role="none")
            self.session.add(member)
        member.fde_status = "active"
        member.fde_joined_at = to_naive_utc(utc_now())
        member.fde_exited_at = None
        req.status = "approved"
        req.processed_by = actor.id
        req.processed_at = to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def reject_join_request(self, company_id: int, request_id: int, actor: User) -> CompanyJoinRequest:
        await self._require_company_role(company_id, actor.id)
        req = await self._get_join_request(company_id, request_id)
        if req.status != "pending":
            raise ApiError(code=43013, message="加入申请已结束", status_code=409)
        req.status = "rejected"
        req.processed_by = actor.id
        req.processed_at = to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(req)
        return req

    async def release_fde_belonging(self, company_id: int, user_id: int, actor: User) -> CompanyMember:
        member = await self._get_member(company_id, user_id)
        if member is None or member.fde_status != "active":
            raise ApiError(code=43015, message="龙虾骑士正式所属关系不存在", status_code=404)
        if actor.id == user_id:
            raise ApiError(code=43016, message="龙虾骑士暂不支持自行解除公司归属", status_code=403)
        await self._require_company_role(company_id, actor.id)
        member.fde_status = "released"
        member.fde_exited_at = to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def get_company_out(self, company_id: int) -> CompanyOut:
        company = await self._get_company(company_id)
        return await self.to_out(company)

    async def list_approved_companies(self, page: int, page_size: int) -> tuple[list[CompanyOut], int]:
        base = select(Company).where(Company.status == "approved")
        total = (await self.session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
        result = await self.session.execute(
            base.order_by(Company.created_at.desc(), Company.id.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        companies = list(result.scalars().all())
        return [await self.to_out(company) for company in companies], total

    async def list_companies_for_admin(
        self,
        page: int,
        page_size: int,
        status: str | None = None,
    ) -> tuple[list[CompanyOut], int]:
        base = select(Company)
        if status:
            base = base.where(Company.status == status)
        total = (await self.session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
        result = await self.session.execute(
            base.order_by(Company.created_at.desc(), Company.id.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        companies = list(result.scalars().all())
        return [await self.to_out(company) for company in companies], total

    async def get_my_state(self, user_id: int) -> CompanyMyStateOut:
        active_member = await self._active_fde_member(user_id)
        active_company = None
        if active_member is not None:
            active_company = await self.get_company_out(active_member.company_id)
        pending = await self._pending_join_request(user_id)
        managed_companies = await self.list_managed_companies(user_id)
        return CompanyMyStateOut(
            active_company=active_company,
            pending_join_request=CompanyJoinRequestOut.model_validate(pending) if pending else None,
            managed_companies=managed_companies,
        )

    async def list_managed_companies(self, user_id: int) -> list[CompanyOut]:
        result = await self.session.execute(
            select(Company)
            .join(CompanyMember, CompanyMember.company_id == Company.id)
            .where(
                CompanyMember.user_id == user_id,
                CompanyMember.company_role.in_(["owner", "admin"]),
            )
            .order_by(Company.created_at.desc(), Company.id.desc())
        )
        return [await self.to_out(company) for company in result.scalars().all()]

    async def list_join_requests(
        self,
        company_id: int,
        actor: User,
        status: str | None = "pending",
    ) -> list[CompanyJoinRequestWithUserOut]:
        company = await self._get_company(company_id)
        self._require_approved(company)
        await self._require_company_role(company_id, actor.id)

        stmt = (
            select(CompanyJoinRequest, User)
            .join(User, User.id == CompanyJoinRequest.user_id)
            .where(CompanyJoinRequest.company_id == company_id)
            .order_by(CompanyJoinRequest.requested_at.desc(), CompanyJoinRequest.id.desc())
        )
        if status:
            stmt = stmt.where(CompanyJoinRequest.status == status)
        rows = (await self.session.execute(stmt)).all()
        items = []
        for req, user in rows:
            base = CompanyJoinRequestOut.model_validate(req).model_dump()
            items.append(
                CompanyJoinRequestWithUserOut(
                    **base,
                    user=CompanyJoinRequestUserOut(
                        id=user.id,
                        username=user.username,
                        display_name=user.display_name,
                        avatar_url=user.avatar_url,
                    ),
                )
            )
        return items

    async def to_out(self, company: Company) -> CompanyOut:
        members = await self._members_out(company.id)
        count = len(members.lobster_knights)
        return CompanyOut.model_validate(company).model_copy(
            update={"members": members, "lobster_knight_count": count}
        )

    async def _members_out(self, company_id: int) -> CompanyMembersOut:
        stmt = (
            select(CompanyMember, User)
            .join(User, User.id == CompanyMember.user_id)
            .where(CompanyMember.company_id == company_id)
            .order_by(CompanyMember.id.asc())
        )
        rows = (await self.session.execute(stmt)).all()
        out = CompanyMembersOut()
        for member, user in rows:
            item = CompanyMemberUserOut(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                avatar_url=user.avatar_url,
                company_role=member.company_role,
                fde_status=member.fde_status,
            )
            if member.company_role == "owner":
                out.owner = item
            elif member.company_role == "admin":
                out.admins.append(item)
            if member.fde_status == "active":
                out.lobster_knights.append(item)
        return out

    async def _get_company(self, company_id: int) -> Company:
        company = await self.session.get(Company, company_id)
        if company is None:
            raise ApiError(code=43001, message="公司不存在", status_code=404)
        return company

    async def _get_member(self, company_id: int, user_id: int) -> CompanyMember | None:
        result = await self.session.execute(
            select(CompanyMember).where(
                CompanyMember.company_id == company_id,
                CompanyMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _get_join_request(self, company_id: int, request_id: int) -> CompanyJoinRequest:
        req = await self.session.get(CompanyJoinRequest, request_id)
        if req is None or req.company_id != company_id:
            raise ApiError(code=43014, message="加入申请不存在", status_code=404)
        return req

    def _require_approved(self, company: Company) -> None:
        if company.status != "approved":
            raise ApiError(code=43005, message="只有已通过审核的公司可以建立龙虾骑士关系", status_code=409)

    async def _require_company_role(self, company_id: int, user_id: int) -> CompanyMember:
        member = await self._get_member(company_id, user_id)
        if member is None or member.company_role not in ("owner", "admin"):
            raise ApiError(code=43006, message="只有公司 Owner / Admin 可以执行该操作", status_code=403)
        return member

    async def _ensure_exact_owner(self, company: Company, owner_id: int) -> None:
        owner_count = (
            await self.session.execute(
                select(func.count())
                .select_from(CompanyMember)
                .where(CompanyMember.company_id == company.id, CompanyMember.company_role == "owner")
            )
        ).scalar_one()
        if owner_count > 1:
            raise ApiError(code=43007, message="公司只能有一个 Owner", status_code=409)
        member = await self._get_member(company.id, owner_id)
        if member is None:
            member = CompanyMember(
                company_id=company.id,
                user_id=owner_id,
                company_role="owner",
                fde_status="none",
                role_started_at=to_naive_utc(utc_now()),
            )
            self.session.add(member)
        else:
            member.company_role = "owner"
            member.role_started_at = member.role_started_at or to_naive_utc(utc_now())
        owner = await self.session.get(User, owner_id)
        if owner is not None and owner.is_verified_fde and member.fde_status == "none":
            member.fde_status = "active"
            member.fde_joined_at = member.fde_joined_at or to_naive_utc(utc_now())
            member.fde_exited_at = None

    async def _active_fde_member(self, user_id: int) -> CompanyMember | None:
        result = await self.session.execute(
            select(CompanyMember).where(CompanyMember.user_id == user_id, CompanyMember.fde_status == "active")
        )
        return result.scalar_one_or_none()

    async def _pending_join_request(self, user_id: int) -> CompanyJoinRequest | None:
        result = await self.session.execute(
            select(CompanyJoinRequest).where(
                CompanyJoinRequest.user_id == user_id,
                CompanyJoinRequest.status == "pending",
            )
        )
        return result.scalar_one_or_none()

    async def _ensure_alignment_for_company_role(self, company_id: int, user_id: int) -> None:
        active = await self._active_fde_member(user_id)
        if active is not None and active.company_id != company_id:
            raise ApiError(code=43008, message="公司角色与龙虾骑士正式归属必须在同一家公司", status_code=409)

    async def _ensure_alignment_for_fde_belonging(self, company_id: int, user_id: int) -> None:
        result = await self.session.execute(
            select(CompanyMember).where(
                CompanyMember.user_id == user_id,
                CompanyMember.company_role.in_(["owner", "admin"]),
                CompanyMember.company_id != company_id,
            )
        )
        if result.scalar_one_or_none() is not None:
            raise ApiError(code=43008, message="公司角色与龙虾骑士正式归属必须在同一家公司", status_code=409)

import json

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import to_naive_utc, utc_now
from app.core.exceptions import ApiError
from app.models.company import Company, CompanyMember
from app.models.solution import EnterpriseSolution
from app.models.user import User
from app.schemas.solution import EnterpriseSolutionCreate, EnterpriseSolutionOut


class EnterpriseSolutionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_solution(
        self, company_id: int, actor: User, payload: EnterpriseSolutionCreate
    ) -> EnterpriseSolution:
        company = await self._get_company(company_id)
        if company.status != "approved":
            raise ApiError(code=44005, message="只有已通过审核的咨询公司可以提交企业方案", status_code=409)
        await self._require_company_role(company_id, actor.id)
        solution = EnterpriseSolution(
            company_id=company_id,
            creator_id=actor.id,
            **payload.model_dump(exclude={"tags"}),
            tags=json.dumps(payload.tags, ensure_ascii=False),
        )
        self.session.add(solution)
        await self.session.commit()
        await self.session.refresh(solution)
        return solution

    async def submit_solution(self, company_id: int, solution_id: int, actor: User) -> EnterpriseSolution:
        solution = await self._get_solution(solution_id)
        if solution.company_id != company_id:
            raise ApiError(code=44001, message="企业方案不存在", status_code=404)
        await self._require_company_role(company_id, actor.id)
        if solution.status not in ("draft", "rejected"):
            raise ApiError(code=44004, message="当前方案状态不可提交", status_code=409)
        solution.status = "pending"
        solution.submitted_at = to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(solution)
        return solution

    async def review_solution(self, solution_id: int, admin: User, status: str, reason: str) -> EnterpriseSolution:
        solution = await self._get_solution(solution_id)
        if solution.status not in ("pending", "rejected") and status != "approved":
            raise ApiError(code=44004, message="当前方案状态不可审核", status_code=409)
        solution.status = status
        solution.review_note = reason
        solution.reviewed_by = admin.id
        solution.reviewed_at = to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(solution)
        return solution

    async def list_public_solutions(
        self,
        page: int,
        page_size: int,
        q: str | None = None,
        category: str | None = None,
        industry: str | None = None,
        scenario: str | None = None,
        sort: str = "recommended",
    ) -> tuple[list[EnterpriseSolutionOut], int]:
        stmt = select(EnterpriseSolution, Company).join(Company, Company.id == EnterpriseSolution.company_id).where(
            EnterpriseSolution.status == "approved"
        )
        stmt = self._apply_public_filters(stmt, q, category, industry, scenario)
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        order_by = (
            (EnterpriseSolution.case_count.desc(), EnterpriseSolution.updated_at.desc(), EnterpriseSolution.id.desc())
            if sort == "cases"
            else (EnterpriseSolution.updated_at.desc(), EnterpriseSolution.id.desc())
        )
        rows = (
            await self.session.execute(stmt.order_by(*order_by).offset((page - 1) * page_size).limit(page_size))
        ).all()
        return [self.to_out(solution, company.name) for solution, company in rows], total

    async def list_home_solutions(self, limit: int) -> list[EnterpriseSolutionOut]:
        rows = (
            await self.session.execute(
                select(EnterpriseSolution, Company)
                .join(Company, Company.id == EnterpriseSolution.company_id)
                .where(EnterpriseSolution.status == "approved")
                .order_by(EnterpriseSolution.case_count.desc(), EnterpriseSolution.updated_at.desc())
                .limit(limit)
            )
        ).all()
        return [self.to_out(solution, company.name) for solution, company in rows]

    async def get_public_solution(self, solution_id: int) -> EnterpriseSolutionOut:
        row = (
            await self.session.execute(
                select(EnterpriseSolution, Company)
                .join(Company, Company.id == EnterpriseSolution.company_id)
                .where(EnterpriseSolution.id == solution_id, EnterpriseSolution.status == "approved")
            )
        ).one_or_none()
        if row is None:
            raise ApiError(code=44001, message="企业方案不存在", status_code=404)
        solution, company = row
        return self.to_out(solution, company.name)

    async def list_company_solutions(
        self, company_id: int, actor: User, page: int, page_size: int
    ) -> tuple[list[EnterpriseSolutionOut], int]:
        company = await self._get_company(company_id)
        await self._require_company_role(company_id, actor.id)
        stmt = select(EnterpriseSolution).where(EnterpriseSolution.company_id == company_id)
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        result = await self.session.execute(
            stmt.order_by(EnterpriseSolution.created_at.desc(), EnterpriseSolution.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return [self.to_out(solution, company.name) for solution in result.scalars().all()], total

    async def list_admin_solutions(
        self, page: int, page_size: int, status: str | None = None
    ) -> tuple[list[EnterpriseSolutionOut], int]:
        stmt = select(EnterpriseSolution, Company).join(Company, Company.id == EnterpriseSolution.company_id)
        if status:
            stmt = stmt.where(EnterpriseSolution.status == status)
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows = (
            await self.session.execute(
                stmt.order_by(EnterpriseSolution.created_at.desc(), EnterpriseSolution.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
        return [self.to_out(solution, company.name) for solution, company in rows], total

    def to_out(self, solution: EnterpriseSolution, company_name: str = "") -> EnterpriseSolutionOut:
        try:
            tags = json.loads(solution.tags or "[]")
        except json.JSONDecodeError:
            tags = []
        return EnterpriseSolutionOut(
            id=solution.id,
            company_id=solution.company_id,
            company_name=company_name,
            creator_id=solution.creator_id,
            title=solution.title,
            subtitle=solution.subtitle,
            category=solution.category,
            industry=solution.industry,
            scenario=solution.scenario,
            delivery_cycle=solution.delivery_cycle,
            budget_range=solution.budget_range,
            cover_image_url=solution.cover_image_url,
            tags=tags if isinstance(tags, list) else [],
            case_count=solution.case_count,
            status=solution.status,
            review_note=solution.review_note,
            created_at=solution.created_at,
            updated_at=solution.updated_at,
        )

    async def _get_company(self, company_id: int) -> Company:
        company = await self.session.get(Company, company_id)
        if company is None:
            raise ApiError(code=43001, message="公司不存在", status_code=404)
        return company

    async def _get_solution(self, solution_id: int) -> EnterpriseSolution:
        solution = await self.session.get(EnterpriseSolution, solution_id)
        if solution is None:
            raise ApiError(code=44001, message="企业方案不存在", status_code=404)
        return solution

    async def _require_company_role(self, company_id: int, user_id: int) -> CompanyMember:
        result = await self.session.execute(
            select(CompanyMember).where(
                CompanyMember.company_id == company_id,
                CompanyMember.user_id == user_id,
                CompanyMember.company_role.in_(["owner", "admin"]),
            )
        )
        member = result.scalar_one_or_none()
        if member is None:
            raise ApiError(code=43006, message="只有公司 Owner / Admin 可以执行该操作", status_code=403)
        return member

    def _apply_public_filters(self, stmt, q, category, industry, scenario):
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                EnterpriseSolution.title.ilike(pattern)
                | EnterpriseSolution.subtitle.ilike(pattern)
                | EnterpriseSolution.tags.ilike(pattern)
                | EnterpriseSolution.category.ilike(pattern)
                | EnterpriseSolution.industry.ilike(pattern)
                | EnterpriseSolution.scenario.ilike(pattern)
            )
        if category:
            stmt = stmt.where(EnterpriseSolution.category == category)
        if industry:
            stmt = stmt.where(EnterpriseSolution.industry == industry)
        if scenario:
            stmt = stmt.where(EnterpriseSolution.scenario == scenario)
        return stmt

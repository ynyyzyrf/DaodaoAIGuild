from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import to_naive_utc, utc_now
from app.core.exceptions import ApiError
from app.models.company import Company, CompanyMember
from app.models.order import (
    DemandOrder,
    FdeProjectRecord,
    OrderClaim,
    OrderDelivery,
    OrderPayment,
    OrderQuote,
    OrderReview,
)
from app.models.user import User
from app.schemas.order import (
    DemandOrderCreate,
    DemandOrderOut,
    FdeProjectRecordOut,
    OrderClaimOut,
    OrderDeliveryOut,
    OrderQuoteCreate,
    OrderQuoteOut,
    OrderReviewCreate,
    OrderReviewOut,
)
from app.services.pmdesktop import sync_order_to_pmdesktop


class OrderService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_order(self, actor: User, data: DemandOrderCreate) -> DemandOrder:
        order = DemandOrder(creator_id=actor.id, **data.model_dump())
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def submit_order(self, order_id: int, actor: User) -> DemandOrder:
        order = await self._get_order(order_id)
        self._require_creator(order, actor)
        if order.status not in ("draft", "review_rejected"):
            raise ApiError(code=44002, message="当前订单状态不可提交", status_code=409)
        order.status = "pending_review"
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def review_order(self, order_id: int, admin: User, status: str, reason: str) -> DemandOrder:
        order = await self._get_order(order_id)
        if order.status != "pending_review":
            raise ApiError(code=44003, message="当前订单状态不可审核", status_code=409)
        order.status = "opportunity_pool" if status == "approved" else "review_rejected"
        order.review_note = reason
        order.reviewed_by = admin.id
        order.reviewed_at = to_naive_utc(utc_now())
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def list_my_orders(self, actor: User, page: int, page_size: int) -> tuple[list[DemandOrderOut], int]:
        base = select(DemandOrder).where(DemandOrder.creator_id == actor.id)
        return await self._paginate_orders(base, page, page_size)

    async def get_my_order(self, order_id: int, actor: User) -> DemandOrder:
        order = await self._get_order(order_id)
        self._require_creator(order, actor)
        return order

    async def list_admin_orders(
        self, page: int, page_size: int, status: str | None = None
    ) -> tuple[list[DemandOrderOut], int]:
        base = select(DemandOrder)
        if status:
            base = base.where(DemandOrder.status == status)
        return await self._paginate_orders(base, page, page_size)

    async def list_opportunities(self, page: int, page_size: int) -> tuple[list[DemandOrderOut], int]:
        base = select(DemandOrder).where(DemandOrder.status == "opportunity_pool")
        return await self._paginate_orders(base, page, page_size)

    async def list_company_orders(
        self, company_id: int, actor: User, page: int, page_size: int, status: str | None = None
    ) -> tuple[list[DemandOrderOut], int]:
        await self._require_company_operator(company_id, actor.id)
        base = select(DemandOrder).where(DemandOrder.claimed_company_id == company_id)
        if status:
            base = base.where(DemandOrder.status == status)
        return await self._paginate_orders(base, page, page_size)

    async def create_claim(
        self, order_id: int, actor: User, company_id: int, claim_note: str = ""
    ) -> DemandOrder:
        order = await self._get_order(order_id)
        if order.status != "opportunity_pool":
            raise ApiError(code=44004, message="只有机会池中的订单可以接单", status_code=409)
        company = await self.session.get(Company, company_id)
        if company is None:
            raise ApiError(code=43001, message="公司不存在", status_code=404)
        if company.status != "approved":
            raise ApiError(code=44005, message="只有已审核通过的咨询公司可以承接订单", status_code=409)
        await self._require_company_operator(company_id, actor.id)

        existing = await self.session.execute(
            select(OrderClaim).where(OrderClaim.order_id == order_id, OrderClaim.company_id == company_id)
        )
        claim = existing.scalar_one_or_none()
        if claim is None:
            claim = OrderClaim(
                order_id=order_id,
                company_id=company_id,
                operator_user_id=actor.id,
                claim_note=claim_note,
                status="selected",
            )
            self.session.add(claim)
        else:
            claim.status = "selected"
            claim.operator_user_id = actor.id
            claim.claim_note = claim_note
        order.status = "claimed"
        order.claimed_company_id = company_id
        order.pmdesktop_sync_status = "pending"
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def select_claim(self, order_id: int, claim_id: int) -> DemandOrder:
        order = await self._get_order(order_id)
        if order.status != "opportunity_pool":
            raise ApiError(code=44006, message="当前订单状态不可确认承接方", status_code=409)
        claim = await self.session.get(OrderClaim, claim_id)
        if claim is None or claim.order_id != order_id:
            raise ApiError(code=44007, message="承接意向不存在", status_code=404)
        claim.status = "selected"
        order.status = "claimed"
        order.claimed_company_id = claim.company_id
        order.pmdesktop_sync_status = "pending"

        result = await self.session.execute(
            select(OrderClaim).where(OrderClaim.order_id == order_id, OrderClaim.id != claim_id)
        )
        for other in result.scalars().all():
            if other.status == "interested":
                other.status = "rejected"
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def assign_fde(self, company_id: int, order_id: int, actor: User, fde_user_id: int) -> DemandOrder:
        order = await self._get_company_order(company_id, order_id, "claimed")
        await self._require_company_operator(company_id, actor.id)
        member = await self._get_active_company_fde(company_id, fde_user_id)
        if member is None:
            raise ApiError(code=44009, message="只能分配本公司 active 龙虾骑士", status_code=409)
        order.assigned_fde_user_id = fde_user_id
        order.status = "requirement_following"
        await sync_order_to_pmdesktop(order)
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def create_quote(
        self, company_id: int, order_id: int, actor: User, data: OrderQuoteCreate
    ) -> OrderQuote:
        order = await self._get_company_order(company_id, order_id, "requirement_following")
        await self._require_company_operator(company_id, actor.id)
        quote = OrderQuote(
            order_id=order_id,
            company_id=company_id,
            owner_user_id=actor.id,
            **data.model_dump(),
        )
        self.session.add(quote)
        order.status = "quoted"
        await self.session.commit()
        await self.session.refresh(quote)
        return quote

    async def confirm_quote(self, order_id: int, actor: User) -> DemandOrder:
        order = await self._get_order(order_id)
        self._require_creator(order, actor)
        if order.status != "quoted":
            raise ApiError(code=44010, message="当前订单状态不可确认报价", status_code=409)
        quote = await self._latest_quote(order_id)
        if quote is None:
            raise ApiError(code=44011, message="报价不存在", status_code=404)
        quote.status = "accepted"
        payment = OrderPayment(
            order_id=order_id,
            amount=quote.amount,
            currency=quote.currency,
            status="pending",
            method="simulated",
        )
        self.session.add(payment)
        order.status = "pending_payment"
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def simulate_payment(self, order_id: int, admin: User, note: str = "") -> DemandOrder:
        order = await self._get_order(order_id)
        if order.status != "pending_payment":
            raise ApiError(code=44012, message="当前订单状态不可标记支付", status_code=409)
        payment = await self._latest_payment(order_id)
        if payment is None:
            raise ApiError(code=44013, message="支付记录不存在", status_code=404)
        payment.status = "paid"
        payment.paid_at = to_naive_utc(utc_now())
        payment.operated_by = admin.id
        payment.note = note
        order.status = "paid"
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def create_delivery(
        self, company_id: int, order_id: int, actor: User, summary: str, deliverable_urls: str
    ) -> OrderDelivery:
        order = await self._get_company_order(company_id, order_id, "paid")
        await self._require_company_operator(company_id, actor.id)
        delivery = OrderDelivery(
            order_id=order_id,
            company_id=company_id,
            submitted_by=actor.id,
            summary=summary,
            deliverable_urls=deliverable_urls,
        )
        self.session.add(delivery)
        order.status = "pending_acceptance"
        await self.session.commit()
        await self.session.refresh(delivery)
        return delivery

    async def accept_delivery(self, order_id: int, actor: User, acceptance_note: str = "") -> DemandOrder:
        order = await self._get_order(order_id)
        self._require_creator(order, actor)
        if order.status != "pending_acceptance":
            raise ApiError(code=44014, message="当前订单状态不可验收", status_code=409)
        delivery = await self._latest_delivery(order_id)
        if delivery is None:
            raise ApiError(code=44015, message="交付记录不存在", status_code=404)
        delivery.status = "accepted"
        delivery.acceptance_note = acceptance_note
        delivery.accepted_by = actor.id
        delivery.accepted_at = to_naive_utc(utc_now())
        order.status = "accepted"
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def settle_order(self, order_id: int, note: str = "") -> DemandOrder:
        order = await self._get_order(order_id)
        if order.status != "accepted":
            raise ApiError(code=44016, message="当前订单状态不可结算", status_code=409)
        order.status = "settled"
        order.review_note = note or order.review_note
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def create_review(self, order_id: int, actor: User, data: OrderReviewCreate) -> DemandOrder:
        order = await self._get_order(order_id)
        self._require_creator(order, actor)
        if order.status not in ("settled", "rated"):
            raise ApiError(code=44017, message="当前订单状态不可评价", status_code=409)
        review = OrderReview(
            order_id=order_id,
            reviewer_id=actor.id,
            reviewer_role="enterprise",
            **data.model_dump(),
        )
        self.session.add(review)
        if data.target_type == "fde" and order.assigned_fde_user_id == data.target_id and order.claimed_company_id:
            await self._upsert_fde_project_record(order, data.score, data.is_public)
        order.status = "rated"
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def list_fde_project_records(self, user_id: int) -> list[FdeProjectRecordOut]:
        result = await self.session.execute(
            select(FdeProjectRecord)
            .where(FdeProjectRecord.fde_user_id == user_id)
            .order_by(FdeProjectRecord.created_at.desc(), FdeProjectRecord.id.desc())
        )
        return [FdeProjectRecordOut.model_validate(row) for row in result.scalars().all()]

    async def to_order_out(self, order: DemandOrder) -> DemandOrderOut:
        order_out = DemandOrderOut.model_validate(order)
        if order.claimed_company_id:
            company = await self.session.get(Company, order.claimed_company_id)
            if company:
                order_out.claimed_company_name = company.name
        return order_out

    async def to_claim_out(self, claim: OrderClaim) -> OrderClaimOut:
        return OrderClaimOut.model_validate(claim)

    async def to_quote_out(self, quote: OrderQuote) -> OrderQuoteOut:
        return OrderQuoteOut.model_validate(quote)

    async def to_delivery_out(self, delivery: OrderDelivery) -> OrderDeliveryOut:
        return OrderDeliveryOut.model_validate(delivery)

    async def to_review_out(self, review: OrderReview) -> OrderReviewOut:
        return OrderReviewOut.model_validate(review)

    async def _paginate_orders(self, base, page: int, page_size: int) -> tuple[list[DemandOrderOut], int]:
        total = (await self.session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
        result = await self.session.execute(
            base.order_by(DemandOrder.created_at.desc(), DemandOrder.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return [await self.to_order_out(order) for order in result.scalars().all()], total

    async def _get_order(self, order_id: int) -> DemandOrder:
        order = await self.session.get(DemandOrder, order_id)
        if order is None:
            raise ApiError(code=44001, message="订单不存在", status_code=404)
        return order

    async def _get_company_order(self, company_id: int, order_id: int, expected_status: str) -> DemandOrder:
        order = await self._get_order(order_id)
        if order.claimed_company_id != company_id:
            raise ApiError(code=44018, message="订单不属于该咨询公司", status_code=403)
        if order.status != expected_status:
            raise ApiError(code=44019, message="当前订单状态不可执行该操作", status_code=409)
        return order

    def _require_creator(self, order: DemandOrder, actor: User) -> None:
        if order.creator_id != actor.id:
            raise ApiError(code=44008, message="只能操作自己的订单", status_code=403)

    async def _require_company_operator(self, company_id: int, user_id: int) -> CompanyMember:
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

    async def _get_active_company_fde(self, company_id: int, user_id: int) -> CompanyMember | None:
        result = await self.session.execute(
            select(CompanyMember).where(
                CompanyMember.company_id == company_id,
                CompanyMember.user_id == user_id,
                CompanyMember.fde_status == "active",
            )
        )
        return result.scalar_one_or_none()

    async def _latest_quote(self, order_id: int) -> OrderQuote | None:
        result = await self.session.execute(
            select(OrderQuote)
            .where(OrderQuote.order_id == order_id, OrderQuote.status == "submitted")
            .order_by(OrderQuote.created_at.desc(), OrderQuote.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _latest_payment(self, order_id: int) -> OrderPayment | None:
        result = await self.session.execute(
            select(OrderPayment)
            .where(OrderPayment.order_id == order_id, OrderPayment.status == "pending")
            .order_by(OrderPayment.created_at.desc(), OrderPayment.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _latest_delivery(self, order_id: int) -> OrderDelivery | None:
        result = await self.session.execute(
            select(OrderDelivery)
            .where(OrderDelivery.order_id == order_id, OrderDelivery.status == "submitted")
            .order_by(OrderDelivery.created_at.desc(), OrderDelivery.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _upsert_fde_project_record(self, order: DemandOrder, score: int, is_public: bool) -> None:
        result = await self.session.execute(
            select(FdeProjectRecord).where(
                FdeProjectRecord.order_id == order.id,
                FdeProjectRecord.fde_user_id == order.assigned_fde_user_id,
            )
        )
        record = result.scalar_one_or_none()
        if record is None:
            record = FdeProjectRecord(
                order_id=order.id,
                fde_user_id=order.assigned_fde_user_id,
                company_id=order.claimed_company_id,
                project_title=order.title,
                product_name=order.product_name,
                enterprise_score=score,
                is_public_case=is_public,
                completed_at=to_naive_utc(utc_now()),
            )
            self.session.add(record)
        else:
            record.enterprise_score = score
            record.is_public_case = is_public
            record.completed_at = record.completed_at or to_naive_utc(utc_now())

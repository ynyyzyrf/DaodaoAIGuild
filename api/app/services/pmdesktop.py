from datetime import datetime
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.datetime_utils import to_naive_utc, utc_now
from app.core.exceptions import ApiError
from app.models.order import DemandOrder


class PmDesktopClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.pm_desktop_api_base.rstrip("/")
        self.timeout = self.settings.pm_desktop_request_timeout_seconds

    async def list_products(
        self,
        search: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "pageSize": page_size}
        if search:
            params["search"] = search
        data = await self._request("GET", "/api/products", params=params)
        items = data.get("items") or data.get("data") if isinstance(data, dict) else data
        if not isinstance(items, list):
            items = []
        return {
            "items": [self._normalize_product(item) for item in items],
            "total": data.get("total", len(items)) if isinstance(data, dict) else len(items),
            "page": data.get("page", page) if isinstance(data, dict) else page,
            "page_size": data.get("pageSize", data.get("page_size", page_size)) if isinstance(data, dict) else page_size,
        }

    async def create_product_requirement(self, order: DemandOrder) -> dict[str, Any]:
        payload = {
            "title": order.title,
            "description": self._compose_description(order),
            "priority": "P2",
            "status": "PENDING",
            "demandType": "DaoStore",
            "externalId": f"daostore-order-{order.id}",
            "submitterName": order.contact_name or order.enterprise_name,
            "submitterDept": order.enterprise_name,
            "expectedReqDate": self._date_or_none(order.expected_delivery_at),
        }
        return await self._request(
            "POST",
            f"/api/products/{order.pmdesktop_product_id}/requirements",
            json={key: value for key, value in payload.items() if value not in (None, "")},
        )

    async def create_user_voice(self, order: DemandOrder) -> dict[str, Any]:
        payload = {
            "title": order.title,
            "category": "需求",
            "description": self._compose_description(order),
            "reqStatus": "PENDING",
            "resolutionStatus": "PENDING",
            "submitterName": order.contact_name or order.enterprise_name,
            "submittedAt": utc_now().isoformat(),
            "source": "MANUAL",
        }
        return await self._request("POST", "/api/user-voices", json=payload)

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        api_key = self.settings.pm_desktop_api_key.strip()
        if not api_key:
            raise ApiError(code=45001, message="PM Desktop API key 未配置", status_code=503)

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(method, f"{self.base_url}{path}", headers=headers, **kwargs)
        except httpx.HTTPError as exc:
            raise ApiError(code=45002, message=f"PM Desktop API 调用失败：{exc.__class__.__name__}", status_code=502) from exc

        if response.status_code >= 400:
            raise ApiError(code=45003, message=f"PM Desktop API 返回错误：HTTP {response.status_code}", status_code=502)
        if not response.content:
            return {}
        return response.json()

    def _normalize_product(self, item: Any) -> dict[str, str]:
        if not isinstance(item, dict):
            return {"id": "", "name": "", "status": ""}
        return {
            "id": str(item.get("id") or ""),
            "name": str(item.get("name") or ""),
            "status": str(item.get("status") or ""),
        }

    def _compose_description(self, order: DemandOrder) -> str:
        parts = [
            ("需求说明", order.description),
            ("业务背景", order.business_background),
            ("交付物期望", order.deliverable_expectation),
            ("企业", order.enterprise_name),
            ("联系人", order.contact_name),
            ("联系方式", order.contact_email),
        ]
        detail = "\n\n".join(f"{label}：{value}" for label, value in parts if value)
        return "\n\n".join(part for part in ["这是从 DaoStore 过来的订单。", detail] if part)

    def _date_or_none(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return to_naive_utc(value).date().isoformat()


async def sync_order_to_pmdesktop(order: DemandOrder) -> None:
    client = PmDesktopClient()
    order.pmdesktop_sync_status = "syncing"
    order.pmdesktop_sync_error = ""
    try:
        if order.pmdesktop_product_id:
            result = await client.create_product_requirement(order)
            result_data = result.get("data", result) if isinstance(result, dict) else {}
            order.pmdesktop_requirement_id = str(result_data.get("id") or result_data.get("requirementId") or "")
            order.pmdesktop_user_voice_id = ""
        else:
            result = await client.create_user_voice(order)
            result_data = result.get("data", result) if isinstance(result, dict) else {}
            order.pmdesktop_user_voice_id = str(result_data.get("id") or result_data.get("userVoiceId") or "")
            order.pmdesktop_requirement_id = ""
        order.pmdesktop_sync_status = "synced"
        order.pmdesktop_synced_at = to_naive_utc(utc_now())
    except Exception as exc:
        order.pmdesktop_sync_status = "failed"
        order.pmdesktop_sync_error = str(exc)[:500]

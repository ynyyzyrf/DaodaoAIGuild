"""lobster-sdk 邊界 datetime 規則（status endpoint tz drift 修復）。

**單一不變量：DB 內所有 naive datetime 一律代表 UTC。**

| 方向 | 規則 |
|---|---|
| write | aware datetime → normalize 到 UTC → strip tzinfo → 持久化 |
| read  | DB naive datetime → attach UTC → 應用層一律用 aware |

**禁止**：
- 對「來源不明」的 naive datetime 盲目 `.replace(tzinfo=UTC)`
- 在 endpoint 末尾 append "Z" workaround
- 改 DB schema / alembic migration（M1 階段不做）

任何跨 DB ↔ application 的 datetime 流動**都必須**走 `to_naive_utc` /
`from_naive_utc`；這樣 invariant 集中、不會散落在各 endpoint。
"""
from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    """應用層「現在」：永遠回 tz-aware UTC。"""
    return datetime.now(timezone.utc)


def to_naive_utc(value: datetime) -> datetime:
    """aware datetime → naive UTC（寫入 DB 前 normalize）。

    對已 naive 的 datetime 直接回傳，不做盲目 attach（避免「來源不明 naive 被誤標 UTC」）。
    """
    if value.tzinfo is None:
        # 已是 naive — 假設為 UTC（DB invariant）
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def from_naive_utc(value: datetime | None) -> datetime | None:
    """DB naive datetime（已鎖定為 UTC）→ aware UTC。

    None 直接傳遞（schema 允許 null 的欄位）。對已 aware 的 datetime 強制 normalize
    到 UTC 再回傳。
    """
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc)
    return value.replace(tzinfo=timezone.utc)


def isoformat_utc(value: datetime | None) -> str | None:
    """wire 輸出：aware datetime → ISO 8601 with +00:00。"""
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat()

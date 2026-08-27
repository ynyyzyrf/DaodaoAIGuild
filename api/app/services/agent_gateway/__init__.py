"""Agent Gateway 模組入口（docs/3.3.md §十二）。

包含：
- ``ConnectionManager``：單 process 內 in-memory WSS 連線狀態追蹤
- 事件合約（events.py）
- Phase B 將加入的：MessageRouter、PermissionPolicy

本目錄是「未來拆 Gateway 服務」時唯一需要搬遷的程式碼。
當前設計（Round 3 Q3 鎖定）：只對外契約（事件 schema）做抽象，內部邏輯
直接寫在 native 實作，不預先 fake Adapter。
"""
from app.services.agent_gateway.manager import (
    ConnectionManager,
    ConnectionState,
    manager,
)

__all__ = [
    "ConnectionManager",
    "ConnectionState",
    "manager",
]

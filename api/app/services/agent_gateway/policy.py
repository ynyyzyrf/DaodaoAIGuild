"""Trigger Policy — 決定「被 @ 的 Agent 是否真的收到並觸發」（docs/3.3.md §十九）。

v0.1 規則（文件 §十九 鎖定）：
- 人類 @Agent → 允許觸發
- Agent @Agent → 默認不觸發（防 Agent Loop）

設計（Round 3 Q4 改良）：Parser 只解析 @ 對象，Policy 決定觸發與否，
兩者分離。未來 v0.3 加「Allow Agent-to-Agent Trigger」時只改這裡。
"""
from __future__ import annotations

from app.models.agent import Agent


def apply_trigger_policy(*, sender_type: str, mentioned_agents: list[Agent]) -> list[Agent]:
    """對已解析的 mention 套用觸發策略，回傳真正要推送的 Agent 清單。

    - sender_type == 'user' → 全部觸發
    - sender_type == 'agent' → 全部不觸發（防止 Agent A → Agent B → A 無限循環）
    """
    if sender_type == "agent":
        return []
    return mentioned_agents

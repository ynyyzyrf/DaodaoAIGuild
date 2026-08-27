"""@mention Parser — 從消息文本解析被 @ 的 Agent（docs/3.3.md §十八、§三十五）。

設計（Round 3 Q4 改良：Parser 與 Trigger Policy 分離）：
- 本模組只負責「找出文本裡 @ 了誰」，不決定「是否觸發」。
- 觸發與否由 ``policy.py`` 的 TriggerPolicy 決定。

v0.1 匹配規則（簡單、可預期）：
- 掃描 ``@Name``，Name 為連續非空白字符
- 與房間內 Agent 的 ``display_name`` 或 ``agent_id`` 精確匹配
- 大小寫不敏感（對英文名較友善）
"""
from __future__ import annotations

import re

from app.models.agent import Agent

_MENTION_PATTERN = re.compile(r"@([^\s@]{1,64})")


def parse_mentions(content: str, agents: list[Agent]) -> list[Agent]:
    """掃描內容，回傳被 @ 的 Agent（按出現順序、去重）。

    ``agents`` 為房間內成員 Agent。未匹配任何 Agent 則回空表。
    """
    if not agents:
        return []
    tokens = {t.lower() for t in _MENTION_PATTERN.findall(content)}
    if not tokens:
        return []

    matched: list[Agent] = []
    seen: set[int] = set()
    for agent in agents:
        key = (agent.display_name or "").strip().lower()
        if key and key in tokens and agent.id not in seen:
            matched.append(agent)
            seen.add(agent.id)
            continue
        if agent.agent_id.lower() in tokens and agent.id not in seen:
            matched.append(agent)
            seen.add(agent.id)
    return matched

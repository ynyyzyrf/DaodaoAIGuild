from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.user import UserRepository

# 騎士等級：累計聲望門檻制，數值可調
LEVEL_NAMES = {1: "小龍蝦", 2: "銅鉗騎士", 3: "銀鉗騎士", 4: "黃金騎士", 5: "龍蝦領主"}
LEVEL_THRESHOLDS = {2: 30, 3: 100, 4: 300, 5: 800}

# 声望事件 → 加分（value 为内容作者所得）
REPUTATION_EVENTS = {
    "question_created": 2,
    "answer_created": 5,
    "answer_accepted": 20,
    "tutorial_created": 10,
    "content_favorited": 3,
    "content_voted": 1,
}


def level_for_reputation(rep: int) -> int:
    """声望 → 等级（1..5）。"""
    level = 1
    for lv, threshold in sorted(LEVEL_THRESHOLDS.items()):
        if rep >= threshold:
            level = lv
        else:
            break
    return level


async def apply_reputation(session: AsyncSession, user_id: int | None, event: str) -> None:
    """给某用户累计声望并同步等级。在已有事务内调用即可。"""
    if user_id is None:
        return
    delta = REPUTATION_EVENTS.get(event)
    if delta is None:
        return
    user = await UserRepository(session).get_by_id(user_id)
    if user is None:
        return
    user.reputation += delta
    user.level = level_for_reputation(user.reputation)
    await session.commit()

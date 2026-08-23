"""龍蝦騎士遊戲化：成就 / 称号 / 装备目录 + 规则引擎。

设计原则（docs/2.0.md §3、§16）：
- 目录以代码常量维护（code 驱动），DB 只存「已解锁」记录（models/gamification.py）
- 声望 = 帮助了多少人（沿用 reputation.py 的数值与门槛，数值不变）
- EXP = 参与了多少，独立累计展示，不参与等级计算
- 装备只代表成就/身份/稀有度，不产生战斗力；同槽位互斥穿戴（docs/2.0.md §11）
"""
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.repositories.favorite import FavoriteRepository
from app.repositories.gamification import GamificationRepository
from app.repositories.user import UserRepository
from app.repositories.vote import VoteRepository
from app.schemas.gamification import AchievementOut, EquipmentOut, RecentUnlockOut, TitleOut
from app.schemas.user import MeOut, UserProfileOut
from app.services.reputation import REPUTATION_EVENTS, level_for_reputation

RARITY_COMMON = "common"
RARITY_RARE = "rare"
RARITY_EPIC = "epic"
RARITY_LEGENDARY = "legendary"

# 事件 → 经验值（与声望 REPUTATION_EVENTS 并列，代表「参与度」）
EXP_EVENTS = {
    "question_created": 5,
    "answer_created": 3,
    "answer_accepted": 10,
    "tutorial_created": 15,
    "content_favorited": 1,
    "content_voted": 1,
}

DEFAULT_TITLE_CODE = "sea_novice"


@dataclass
class UserStats:
    """用户在游戏化规则中可见的统计快照（纯数据，供条件函数判断）。"""

    questions_count: int = 0
    answers_count: int = 0
    accepted_count: int = 0
    tutorials_count: int = 0
    favorites_received: int = 0
    votes_received: int = 0
    reputation: int = 0
    level: int = 1


@dataclass(frozen=True)
class Achievement:
    code: str
    name: str
    description: str
    icon: str
    rarity: str
    condition: Callable[[UserStats], bool]


@dataclass(frozen=True)
class Title:
    code: str
    name: str
    description: str
    icon: str
    rarity: str
    condition: Callable[[UserStats], bool]


@dataclass(frozen=True)
class Equipment:
    code: str
    name: str
    slot: str
    rarity: str
    icon: str
    description: str
    condition: Callable[[UserStats], bool]


T = TypeVar("T", Achievement, Title, Equipment)


def _ge(field: str, threshold: int) -> Callable[[UserStats], bool]:
    return lambda s: getattr(s, field) >= threshold


# ---- 成就目录（docs/2.0.md §14）----
ACHIEVEMENTS: dict[str, Achievement] = {
    "first_question": Achievement(
        "first_question", "初出茅庐", "发布第一个问题", "📮", RARITY_COMMON, _ge("questions_count", 1)
    ),
    "first_answer": Achievement(
        "first_answer", "首次亮鉗", "回答第一个问题", "🦞", RARITY_COMMON, _ge("answers_count", 1)
    ),
    "first_rescue": Achievement(
        "first_rescue", "首次救援", "第一个回答被采纳", "🚑", RARITY_COMMON, _ge("accepted_count", 1)
    ),
    "ten_rescue": Achievement(
        "ten_rescue", "十連救援", "累计 10 个回答被采纳", "🏆", RARITY_RARE, _ge("accepted_count", 10)
    ),
    "knowledge_sower": Achievement(
        "knowledge_sower", "知識播種者", "发布第一篇教程", "📚", RARITY_COMMON, _ge("tutorials_count", 1)
    ),
    "knowledge_contributor": Achievement(
        "knowledge_contributor", "知識貢獻者", "发布 3 篇教程", "📖", RARITY_RARE, _ge("tutorials_count", 3)
    ),
    "rising_star": Achievement(
        "rising_star", "聲望新星", "声望达到 100", "⭐", RARITY_RARE, _ge("reputation", 100)
    ),
    "community_elite": Achievement(
        "community_elite", "社區精英", "声望达到 300", "👑", RARITY_EPIC, _ge("reputation", 300)
    ),
    "fde_master": Achievement(
        "fde_master", "FDE 大師", "声望达到 800", "🎓", RARITY_LEGENDARY, _ge("reputation", 800)
    ),
    "hundred_favorites": Achievement(
        "hundred_favorites", "百人收藏", "内容累计被收藏 100 次", "❤️", RARITY_EPIC,
        _ge("favorites_received", 100),
    ),
}

# ---- 称号目录（docs/2.0.md §13）----
TITLES: dict[str, Title] = {
    "sea_novice": Title(
        "sea_novice", "初入海域", "刚加入公会的见习騎士（默认称号）", "🌊", RARITY_COMMON, lambda _s: True
    ),
    "debug_apprentice": Title(
        "debug_apprentice", "除錯學徒", "首个回答被采纳", "🔧", RARITY_COMMON, _ge("accepted_count", 1)
    ),
    "knowledge_sower_t": Title(
        "knowledge_sower_t", "知識播種者", "发布第一篇教程", "📚", RARITY_COMMON, _ge("tutorials_count", 1)
    ),
    "rescue_expert": Title(
        "rescue_expert", "救援專家", "累计 5 个回答被采纳", "🚑", RARITY_RARE, _ge("accepted_count", 5)
    ),
    "community_mentor": Title(
        "community_mentor", "知識導師", "发布 3 篇教程", "🎓", RARITY_RARE, _ge("tutorials_count", 3)
    ),
    "workflow_craftsman": Title(
        "workflow_craftsman", "Workflow 工匠", "发布 5 篇教程", "⚙️", RARITY_RARE, _ge("tutorials_count", 5)
    ),
    "golden_knight_title": Title(
        "golden_knight_title", "黃金騎士", "晋升黄金骑士（等级 4）", "🛡️", RARITY_EPIC, _ge("level", 4)
    ),
    "fde_master_t": Title(
        "fde_master_t", "FDE 大師", "登顶龙虾领主（等级 5）", "👑", RARITY_LEGENDARY, _ge("level", 5)
    ),
}

# ---- 装备目录（docs/2.0.md §11），slot ∈ helmet/weapon/cape/armor/hand/base ----
EQUIPMENT: dict[str, Equipment] = {
    "copper_gauntlet": Equipment(
        "copper_gauntlet", "銅鉗護腕", "hand", RARITY_COMMON, "🦀", "回答 10 个问题", _ge("answers_count", 10)
    ),
    "scroll_of_knowledge": Equipment(
        "scroll_of_knowledge", "知識卷軸", "weapon", RARITY_RARE, "📜", "发布 5 篇教程",
        _ge("tutorials_count", 5),
    ),
    "rescue_helmet": Equipment(
        "rescue_helmet", "救援頭盔", "helmet", RARITY_RARE, "⛑️", "10 个回答被采纳", _ge("accepted_count", 10)
    ),
    "silver_chestplate": Equipment(
        "silver_chestplate", "銀鉗胸甲", "armor", RARITY_RARE, "🥈", "晋升银鉗骑士（等级 3）", _ge("level", 3)
    ),
    "fde_cape": Equipment(
        "fde_cape", "FDE 披風", "cape", RARITY_RARE, "🧣", "晋升银鉗骑士（等级 3）", _ge("level", 3)
    ),
    "golden_armor": Equipment(
        "golden_armor", "黃金戰甲", "armor", RARITY_EPIC, "🛡️", "晋升黄金骑士（等级 4）", _ge("level", 4)
    ),
    "ruby_base": Equipment(
        "ruby_base", "紅寶石底座", "base", RARITY_RARE, "💎", "声望达到 100", _ge("reputation", 100)
    ),
    "lords_crown": Equipment(
        "lords_crown", "龍蝦領主之冠", "helmet", RARITY_LEGENDARY, "👑", "登顶龙虾领主（等级 5）",
        _ge("level", 5),
    ),
}


def evaluate(catalog: dict[str, T], stats: UserStats) -> set[str]:
    """纯函数：筛出当前满足条件的 code 集合。"""
    return {code for code, item in catalog.items() if item.condition(stats)}


async def compute_stats(session: AsyncSession, user) -> UserStats:
    counts = await UserRepository(session).get_profile_stats(user.id)
    content_ids = await UserRepository(session).list_content_ids(user.id)
    vote_repo = VoteRepository(session)
    fav_repo = FavoriteRepository(session)
    votes_received = favorites_received = 0
    for target_type in ("question", "answer", "tutorial"):
        ids = content_ids[target_type]
        votes_received += sum((await vote_repo.count_batch(target_type, ids)).values())
        favorites_received += sum((await fav_repo.count_batch(target_type, ids)).values())
    return UserStats(
        questions_count=counts["questions_count"],
        answers_count=counts["answers_count"],
        accepted_count=counts["accepted_count"],
        tutorials_count=counts["tutorials_count"],
        favorites_received=favorites_received,
        votes_received=votes_received,
        reputation=user.reputation,
        level=user.level,
    )


async def sync_unlocks(session: AsyncSession, user, stats: UserStats) -> list[RecentUnlockOut]:
    """幂等补齐用户已满足条件的解锁记录，返回本次新增项；同时确保默认称号生效。"""
    repo = GamificationRepository(session)
    now = datetime.now(UTC)
    new_unlocks: list[RecentUnlockOut] = []

    owned_ach = set(await repo.achievement_rows(user.id))
    for code in evaluate(ACHIEVEMENTS, stats) - owned_ach:
        await repo.grant_achievement(user.id, code)
        item = ACHIEVEMENTS[code]
        new_unlocks.append(
            RecentUnlockOut(
                kind="achievement", code=code, name=item.name, icon=item.icon,
                rarity=item.rarity, unlocked_at=now,
            )
        )

    owned_titles = set(await repo.title_rows(user.id))
    for code in evaluate(TITLES, stats) - owned_titles:
        await repo.grant_title(user.id, code)
        item = TITLES[code]
        new_unlocks.append(
            RecentUnlockOut(
                kind="title", code=code, name=item.name, icon=item.icon,
                rarity=item.rarity, unlocked_at=now,
            )
        )

    owned_eq = set(await repo.equipment_rows(user.id))
    for code in evaluate(EQUIPMENT, stats) - owned_eq:
        await repo.grant_equipment(user.id, code)
        item = EQUIPMENT[code]
        new_unlocks.append(
            RecentUnlockOut(
                kind="equipment", code=code, name=item.name, icon=item.icon,
                rarity=item.rarity, unlocked_at=now,
            )
        )

    # 默认称号「初入海域」：恒解锁，用户尚未选择称号时自动挂上
    if user.current_title_code is None and DEFAULT_TITLE_CODE in (owned_titles | {DEFAULT_TITLE_CODE}):
        user.current_title_code = DEFAULT_TITLE_CODE

    if new_unlocks or user.current_title_code is not None:
        await session.commit()
    return new_unlocks


async def process_event(session: AsyncSession, user_id: int | None, event: str) -> None:
    """统一处理一个贡献事件：声望 + EXP + 等级 + 解锁同步（替换 apply_reputation 调用点）。"""
    if user_id is None:
        return
    rep_delta = REPUTATION_EVENTS.get(event)
    exp_delta = EXP_EVENTS.get(event)
    if rep_delta is None and exp_delta is None:
        return
    user = await UserRepository(session).get_by_id(user_id)
    if user is None:
        return
    if rep_delta:
        user.reputation += rep_delta
        user.level = level_for_reputation(user.reputation)
    if exp_delta:
        user.exp += exp_delta
    stats = await compute_stats(session, user)
    await sync_unlocks(session, user, stats)


async def build_profile(session: AsyncSession, user, include_recent: bool = False) -> MeOut | UserProfileOut:
    """组装完整个人页（目录 + 解锁态），公开与本人共用；本人可带 recent_unlocks。"""
    stats = await compute_stats(session, user)
    await sync_unlocks(session, user, stats)
    repo = GamificationRepository(session)

    ach_rows = await repo.achievement_rows(user.id)
    achievements = [
        AchievementOut(
            code=a.code, name=a.name, description=a.description, icon=a.icon, rarity=a.rarity,
            unlocked=code in ach_rows, unlocked_at=ach_rows.get(code),
        )
        for code, a in ACHIEVEMENTS.items()
    ]

    title_rows = await repo.title_rows(user.id)
    titles = [
        TitleOut(
            code=t.code, name=t.name, description=t.description, icon=t.icon, rarity=t.rarity,
            unlocked=code in title_rows, unlocked_at=title_rows.get(code),
            is_current=user.current_title_code == t.code,
        )
        for code, t in TITLES.items()
    ]
    current_title = next((t for t in titles if t.is_current), None)

    eq_rows = await repo.equipment_rows(user.id)
    equipment = [
        EquipmentOut(
            code=e.code, name=e.name, slot=e.slot, rarity=e.rarity, description=e.description,
            unlocked=code in eq_rows, unlocked_at=eq_rows.get(code).unlocked_at if code in eq_rows else None,
            is_equipped=eq_rows[code].is_equipped if code in eq_rows else False,
        )
        for code, e in EQUIPMENT.items()
    ]

    base = UserProfileOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        level=user.level,
        reputation=user.reputation,
        is_admin=user.is_admin,
        created_at=user.created_at,
        exp=user.exp,
        questions_count=stats.questions_count,
        answers_count=stats.answers_count,
        tutorials_count=stats.tutorials_count,
        accepted_count=stats.accepted_count,
        current_title=current_title,
        achievements=achievements,
        titles=titles,
        equipment=equipment,
    )
    if not include_recent:
        return base
    recent_rows = await repo.recent_unlocks(user.id)
    recent = []
    for row in recent_rows:
        kind = row["kind"]
        code = str(row["code"])
        if kind == "achievement" and code in ACHIEVEMENTS:
            item = ACHIEVEMENTS[code]
        elif kind == "title" and code in TITLES:
            item = TITLES[code]
        elif kind == "equipment" and code in EQUIPMENT:
            item = EQUIPMENT[code]
        else:
            continue
        recent.append(
            RecentUnlockOut(
                kind=kind, code=code, name=item.name, icon=item.icon,
                rarity=item.rarity, unlocked_at=row["unlocked_at"],
            )
        )
    return MeOut(**base.model_dump(), recent_unlocks=recent)


async def set_current_title(session: AsyncSession, user, code: str) -> None:
    if code not in TITLES:
        raise ApiError(code=40003, message="称号不存在", status_code=404)
    owned = set(await GamificationRepository(session).title_rows(user.id))
    if code not in owned:
        raise ApiError(code=40003, message="尚未解锁该称号", status_code=400)
    user.current_title_code = code
    await session.commit()


async def equip(session: AsyncSession, user, code: str) -> None:
    """穿戴装备：同槽位其他装备自动卸下（互斥）。"""
    if code not in EQUIPMENT:
        raise ApiError(code=40003, message="装备不存在", status_code=404)
    repo = GamificationRepository(session)
    rows = await repo.equipment_rows(user.id)
    if code not in rows:
        raise ApiError(code=40003, message="尚未解锁该装备", status_code=400)
    slot = EQUIPMENT[code].slot
    for other_code, row in rows.items():
        if other_code != code and EQUIPMENT[other_code].slot == slot and row.is_equipped:
            row.is_equipped = False
    rows[code].is_equipped = True
    await session.commit()


async def unequip(session: AsyncSession, user, code: str) -> None:
    if code not in EQUIPMENT:
        raise ApiError(code=40003, message="装备不存在", status_code=404)
    repo = GamificationRepository(session)
    rows = await repo.equipment_rows(user.id)
    if code not in rows:
        raise ApiError(code=40003, message="尚未解锁该装备", status_code=400)
    rows[code].is_equipped = False
    await session.commit()

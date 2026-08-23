"""管理后台 V3.2 schemas（docs/3.2.md §5）。"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Paginated


# ---------- 稽核日志 ----------


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_id: int
    action: str
    target_type: str
    target_id: int | None
    before_value: dict | None
    after_value: dict | None
    reason: str
    ip: str | None
    created_at: datetime


# ---------- 敏感词 ----------


class SensitiveWordCreate(BaseModel):
    word: str = Field(min_length=1, max_length=64)
    category: str | None = None
    action: str = Field("warn", pattern="^(warn|auto_hide)$")


class SensitiveWordUpdate(BaseModel):
    category: str | None = None
    action: str | None = Field(None, pattern="^(warn|auto_hide)$")
    is_active: bool | None = None


class SensitiveWordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    word: str
    category: str | None
    action: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SensitiveWordImport(BaseModel):
    """批量导入：每行一个词。"""
    words: list[str]
    category: str | None = None
    action: str = Field("warn", pattern="^(warn|auto_hide)$")


# ---------- 用户管理 ----------


class AdminUserOut(BaseModel):
    """后台用户视图：比前台 UserOut 多 is_active / is_verified_fde / is_admin / 时间戳。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    avatar_url: str
    bio: str
    level: int
    reputation: int
    exp: int
    is_admin: bool
    is_active: bool
    is_verified_fde: bool
    created_at: datetime
    updated_at: datetime


class AdminUserDetail(AdminUserOut):
    questions_count: int = 0
    answers_count: int = 0
    tutorials_count: int = 0
    accepted_count: int = 0


class AdminUserUpdate(BaseModel):
    """后台修改用户：is_active / level / reputation / is_verified_fde，所有变更需附 reason。"""

    is_active: bool | None = None
    level: int | None = Field(None, ge=1, le=5)
    reputation: int | None = None
    is_verified_fde: bool | None = None
    reason: str = Field(..., min_length=1, max_length=500)


class ResetPasswordOut(BaseModel):
    """重置密码：一次性返回明文密码（仅此一次，前端需提示用户保存）。"""

    username: str
    new_password: str


# ---------- 内容审核 ----------


class ModerationItemOut(BaseModel):
    """审核队列单条：聚合不同类型内容的最小公共字段。"""

    id: int
    target_type: str  # question / answer / tutorial
    target_id: int
    title: str  # question/tutorial 用 title；answer 用 content 前 80 字
    author_id: int
    author_name: str
    status: str
    trigger_reason: str  # report / sensitive / pre_review
    created_at: datetime
    view_count: int = 0
    like_count: int = 0
    report_count: int = 0
    matched_words: list[str] = []


class ModerationAction(BaseModel):
    """审核操作：通过/隐藏/删除/打回，reason 必填。"""

    reason: str = Field(..., min_length=1, max_length=500)


class ModerationDetailOut(BaseModel):
    """审核详情：完整内容 + 触发信息。"""

    target_type: str
    target_id: int
    title: str
    content: str  # Markdown 原文
    author_id: int
    author_name: str
    status: str
    created_at: datetime
    trigger_reason: str
    reports: list[dict] = []  # [{reporter_id, reporter_name, reason, created_at}]
    matched_words: list[str] = []


# ---------- 任务管理 ----------


class AdminMissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    difficulty: str
    reward: str
    creator_id: int
    assignee_id: int | None
    created_at: datetime
    updated_at: datetime


class AdminMissionUpdate(BaseModel):
    status: str | None = Field(None, pattern="^(open|in_progress|delivered|closed)$")
    assignee_id: int | None = None
    reward: str | None = None
    reason: str = Field(..., min_length=1, max_length=500)


# ---------- 仪表板 ----------


class DashboardOut(BaseModel):
    pending_tutorials: int
    today_new_questions: int
    today_new_answers: int
    today_new_tutorials: int
    in_progress_missions: int
    active_knights_7d: int
    trend: list[dict]  # [{date, questions, answers, tutorials}] 近 30 天
    alerts: dict  # {zero_answer_questions: n, overdue_missions: n}


# ---------- 登录 ----------


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    user: AdminUserOut


# ---------- 列表响应别名 ----------


PaginatedUsers = Paginated[AdminUserOut]
PaginatedModeration = Paginated[ModerationItemOut]
PaginatedMissions = Paginated[AdminMissionOut]
PaginatedAuditLogs = Paginated[AuditLogOut]
PaginatedSensitiveWords = Paginated[SensitiveWordOut]

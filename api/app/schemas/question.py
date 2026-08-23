from datetime import datetime

from pydantic import BaseModel

from app.schemas.upload import AttachmentOut
from app.schemas.user import UserOut


class QuestionCreate(BaseModel):
    title: str
    description: str = ""
    scenario: str = ""
    tools: list[str] = []
    error_info: str = ""
    tags: list[str] = []
    is_anonymous: bool = False
    attachments: list[str] = []  # 已上传附件的 url 列表，创建后绑定到该问题


class AnswerCreate(BaseModel):
    content: str


class AcceptRequest(BaseModel):
    answer_id: int


class AnswerOut(BaseModel):
    id: int
    question_id: int
    author_id: int
    content: str
    is_accepted: bool
    created_at: datetime
    updated_at: datetime
    author: UserOut | None = None
    vote_count: int = 0


class QuestionOut(BaseModel):
    id: int
    author_id: int
    title: str
    description: str
    scenario: str
    tools: list
    error_info: str
    status: str
    is_anonymous: bool = False
    view_count: int
    created_at: datetime
    updated_at: datetime
    author: UserOut | None = None
    tags: list[str] = []
    answer_count: int = 0
    vote_count: int = 0
    answers: list[AnswerOut] = []
    attachments: list[AttachmentOut] = []


class ToggleResponse(BaseModel):
    active: bool
    count: int

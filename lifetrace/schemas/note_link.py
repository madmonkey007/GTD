"""笔记思想链接（NoteLink）相关的 Pydantic 模型

Zettelkasten 风格的有向、类型化笔记链接，独立于批注关系。
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RelationType = Literal["SUPPORTS", "EXTENDS", "CONTRADICTS", "RELATES"]


class NoteLinkCreate(BaseModel):
    """创建思想链接请求（source_note_id 来自 URL 路径）"""

    target_note_id: int = Field(..., description="目标笔记ID")
    relation_type: RelationType = Field("RELATES", description="关系类型")
    user_note: str | None = Field(None, description="对该链接的说明")


class NoteLinkUpdate(BaseModel):
    """更新思想链接（仅 relation_type / user_note，事后精修）"""

    relation_type: RelationType | None = None
    user_note: str | None = None


class NoteCounterpart(BaseModel):
    """链接对端笔记的精简预览（联表带出，省前端二次请求）"""

    id: int
    name: str | None = None
    date: datetime | None = None
    preview: str = Field("", description="对端笔记正文预览（前若干字符）")


class NoteLinkResponse(BaseModel):
    """思想链接响应"""

    id: int
    source_note_id: int
    target_note_id: int
    relation_type: RelationType
    user_note: str | None = None
    created_at: datetime
    counterpart: NoteCounterpart | None = None

    class Config:
        from_attributes = True


class NoteLinkListResponse(BaseModel):
    """双向链接列表：outgoing（我链接的）+ incoming（链接我的）"""

    outgoing: list[NoteLinkResponse] = Field(default_factory=list)
    incoming: list[NoteLinkResponse] = Field(default_factory=list)


class LinkCandidate(BaseModel):
    """相似度候选笔记（带 score，用于"添加思想链接"入口）"""

    id: int
    name: str | None = None
    preview: str
    score: float


class LinkCandidateListResponse(BaseModel):
    candidates: list[LinkCandidate] = Field(default_factory=list)

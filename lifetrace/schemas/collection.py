"""笔记集合（Collection）相关的 Pydantic 模型

Collection 是用户主动创建的意义集合（类似音乐歌单），与笔记多对多关联。
"""

from datetime import datetime

from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    """创建集合"""

    name: str = Field(..., min_length=1, max_length=200, description="集合名称")
    description: str | None = Field(None, description="集合描述")
    cover_image_url: str | None = Field(None, max_length=500, description="封面图地址")


class CollectionUpdate(BaseModel):
    """更新集合（所有字段可选）"""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    cover_image_url: str | None = Field(None, max_length=500)


class CollectionNote(BaseModel):
    """集合内笔记的精简预览（联表带出，省前端二次请求）"""

    id: int
    name: str | None = None
    date: datetime | None = None
    preview: str = Field("", description="笔记正文预览（前若干字符）")

    class Config:
        from_attributes = True


class CollectionResponse(BaseModel):
    """集合响应（列表项不含 notes，详情含 notes）"""

    id: int
    uid: str
    name: str
    description: str | None = None
    cover_image_url: str | None = None
    note_count: int = 0
    created_at: datetime
    updated_at: datetime
    notes: list[CollectionNote] | None = None

    class Config:
        from_attributes = True


class CollectionAddNotesRequest(BaseModel):
    """向集合批量加入笔记"""

    journal_ids: list[int] = Field(..., description="要加入的笔记ID列表")


class CollectionSummaryResponse(BaseModel):
    """AI 生成的集合摘要"""

    summary: str


class CollectionRecommendItem(BaseModel):
    """AI 推荐加入集合的候选笔记"""

    journal_id: int
    name: str | None = None
    reason: str = ""


class CollectionRecommendResponse(BaseModel):
    items: list[CollectionRecommendItem] = Field(default_factory=list)

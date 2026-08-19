"""项目（Project）相关的 Pydantic 模型

Project 是待办与笔记共享的统一容器（双视图），与 Todo/Journal 均为多对多。
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    """创建项目"""

    uid: str | None = Field(None, max_length=64, description="客户端生成的稳定标识")
    name: str = Field(..., min_length=1, max_length=200, description="项目名称")
    description: str | None = Field(None, description="项目描述")
    cover_image_url: str | None = Field(None, max_length=500, description="封面图地址")
    color: str | None = Field(None, max_length=20, description="侧边栏区分色")
    project_type: str = Field("project", max_length=20, description="类型: project | checklist")


class ProjectUpdate(BaseModel):
    """更新项目（所有字段可选）"""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    cover_image_url: str | None = Field(None, max_length=500)
    color: str | None = Field(None, max_length=20)
    project_type: str | None = Field(None, max_length=20)
    is_archived: bool | None = Field(None, description="归档后从列表隐藏，不删除数据")


class ProjectTodoItem(BaseModel):
    """项目内待办的精简预览"""

    id: int
    name: str | None = None
    status: str | None = None
    start_time: datetime | None = None

    class Config:
        from_attributes = True


class ProjectNoteItem(BaseModel):
    """项目内笔记的精简预览"""

    id: int
    name: str | None = None
    date: datetime | None = None
    preview: str = Field("", description="笔记正文预览")

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    """项目响应（列表项不含 todos/notes，详情含）"""

    id: int
    uid: str
    name: str
    description: str | None = None
    cover_image_url: str | None = None
    color: str | None = None
    project_type: str = "project"
    is_archived: bool = False
    sort_order: int = 0
    todo_count: int = 0
    note_count: int = 0
    created_at: datetime
    updated_at: datetime
    todos: list[ProjectTodoItem] | None = None
    notes: list[ProjectNoteItem] | None = None

    class Config:
        from_attributes = True


class ProjectReorderItem(BaseModel):
    """单个项目排序项"""

    id: int = Field(..., description="项目ID")
    sort_order: int = Field(..., description="新的排序序号")


class ProjectReorderRequest(BaseModel):
    """批量重排序请求模型"""

    items: list[ProjectReorderItem] = Field(..., description="待排序的项目列表")


class ProjectAddTodosRequest(BaseModel):
    """向项目批量加入待办"""

    todo_ids: list[int] = Field(..., description="要加入的待办ID列表")


class ProjectAddNotesRequest(BaseModel):
    """向项目批量加入笔记"""

    journal_ids: list[int] = Field(..., description="要加入的笔记ID列表")

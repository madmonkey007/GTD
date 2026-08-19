"""项目（Project）路由

待办与笔记共享的统一容器，双视图。前缀 /api/projects。
本期不含 AI 摘要/推荐。
"""

from fastapi import APIRouter, Depends, HTTPException, Path

from lifetrace.core.dependencies import get_project_service
from lifetrace.schemas.project import (
    ProjectAddNotesRequest,
    ProjectAddTodosRequest,
    ProjectCreate,
    ProjectReorderRequest,
    ProjectResponse,
    ProjectUpdate,
)
from lifetrace.services.project_service import ProjectService

router = APIRouter(tags=["project"])


@router.get("/api/projects", response_model=list[ProjectResponse])
async def list_projects(
    type: str | None = None,
    service: ProjectService = Depends(get_project_service),
):
    """列出所有项目（带 todo_count / note_count），可选 type 过滤: project | checklist"""
    try:
        return service.list_projects(project_type=type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取项目列表失败: {e!s}") from e


@router.post("/api/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    service: ProjectService = Depends(get_project_service),
):
    """创建项目"""
    try:
        return service.create_project(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建项目失败: {e!s}") from e


@router.post("/api/projects/reorder", status_code=200)
async def reorder_projects(
    request: ProjectReorderRequest,
    service: ProjectService = Depends(get_project_service),
):
    """批量更新项目的排序序号"""
    items = [
        {"id": item.id, "sort_order": item.sort_order} for item in request.items
    ]
    try:
        return service.reorder_projects(items)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量重排序项目失败: {e!s}") from e


@router.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int = Path(..., description="项目ID"),
    service: ProjectService = Depends(get_project_service),
):
    """获取项目详情（含 todos + notes）"""
    try:
        return service.get_project(project_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取项目详情失败: {e!s}") from e


@router.put("/api/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int = Path(..., description="项目ID"),
    data: ProjectUpdate | None = None,
    service: ProjectService = Depends(get_project_service),
):
    """更新项目（名称/描述/封面/颜色）"""
    if data is None:
        raise HTTPException(status_code=400, detail="缺少更新内容")
    try:
        return service.update_project(project_id, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新项目失败: {e!s}") from e


@router.delete("/api/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: int = Path(..., description="项目ID"),
    service: ProjectService = Depends(get_project_service),
):
    """删除项目（软删除，连带成员关系）"""
    try:
        service.delete_project(project_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除项目失败: {e!s}") from e


@router.post("/api/projects/{project_id}/todos", response_model=ProjectResponse)
async def add_todos(
    project_id: int = Path(..., description="项目ID"),
    data: ProjectAddTodosRequest | None = None,
    service: ProjectService = Depends(get_project_service),
):
    """批量加入待办"""
    if data is None:
        raise HTTPException(status_code=400, detail="缺少 todo_ids")
    try:
        return service.add_todos(project_id, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加入待办失败: {e!s}") from e


@router.delete(
    "/api/projects/{project_id}/todos/{todo_id}", response_model=ProjectResponse
)
async def remove_todo(
    project_id: int = Path(..., description="项目ID"),
    todo_id: int = Path(..., description="待办ID"),
    service: ProjectService = Depends(get_project_service),
):
    """从项目移除一条待办"""
    try:
        return service.remove_todo(project_id, todo_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"移除待办失败: {e!s}") from e


@router.post("/api/projects/{project_id}/notes", response_model=ProjectResponse)
async def add_notes(
    project_id: int = Path(..., description="项目ID"),
    data: ProjectAddNotesRequest | None = None,
    service: ProjectService = Depends(get_project_service),
):
    """批量加入笔记"""
    if data is None:
        raise HTTPException(status_code=400, detail="缺少 journal_ids")
    try:
        return service.add_notes(project_id, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加入笔记失败: {e!s}") from e


@router.delete(
    "/api/projects/{project_id}/notes/{journal_id}", response_model=ProjectResponse
)
async def remove_note(
    project_id: int = Path(..., description="项目ID"),
    journal_id: int = Path(..., description="笔记ID"),
    service: ProjectService = Depends(get_project_service),
):
    """从项目移除一条笔记"""
    try:
        return service.remove_note(project_id, journal_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"移除笔记失败: {e!s}") from e

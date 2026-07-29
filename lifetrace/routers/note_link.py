"""笔记链接（NoteLink）路由

有向、类型化笔记链接（SUPPORTS/EXTENDS/CONTRADICTS/RELATES）。
journal_note_relations 已迁移至此，所有引用关系统一由 NoteLink 承载。
"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from lifetrace.core.dependencies import get_note_link_service
from lifetrace.schemas.note_link import (
    LinkCandidateListResponse,
    NoteLinkCreate,
    NoteLinkListResponse,
    NoteLinkResponse,
    NoteLinkUpdate,
)
from lifetrace.services.note_link_service import NoteLinkService

router = APIRouter(tags=["note_links"])


@router.post("/api/notes/{source_id}/links", response_model=NoteLinkResponse, status_code=201)
async def create_link(
    data: NoteLinkCreate,
    source_id: int = Path(..., description="源笔记ID"),
    service: NoteLinkService = Depends(get_note_link_service),
):
    """创建思想链接（默认 RELATES，类型/说明可事后精修）"""
    try:
        return service.create_link(source_id, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建思想链接失败: {e!s}") from e


@router.get("/api/notes/{note_id}/links", response_model=NoteLinkListResponse)
async def list_links(
    note_id: int = Path(..., description="笔记ID"),
    service: NoteLinkService = Depends(get_note_link_service),
):
    """列出笔记的双向思想链接：outgoing（我链接的）+ incoming（链接我的）"""
    try:
        return service.list_links(note_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取思想链接失败: {e!s}") from e


@router.put("/api/note-links/{link_id}", response_model=NoteLinkResponse)
async def update_link(
    link_id: int = Path(..., description="链接ID"),
    data: NoteLinkUpdate | None = None,
    service: NoteLinkService = Depends(get_note_link_service),
):
    """更新思想链接的 relation_type 或 user_note（事后精修）"""
    if data is None:
        raise HTTPException(status_code=400, detail="缺少更新内容")
    try:
        return service.update_link(link_id, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新思想链接失败: {e!s}") from e


@router.delete("/api/note-links/{link_id}", status_code=204)
async def delete_link(
    link_id: int = Path(..., description="链接ID"),
    service: NoteLinkService = Depends(get_note_link_service),
):
    """删除思想链接（软删除）"""
    try:
        service.delete_link(link_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除思想链接失败: {e!s}") from e


@router.get("/api/notes/{note_id}/link-candidates", response_model=LinkCandidateListResponse)
async def link_candidates(
    note_id: int = Path(..., description="笔记ID"),
    top_k: int = Query(10, ge=1, le=50, description="返回候选数量"),
    service: NoteLinkService = Depends(get_note_link_service),
):
    """获取相似度候选笔记（复用向量检索，排除自身与已链接目标，带 score）"""
    try:
        return {"candidates": service.get_candidates(note_id, top_k=top_k)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取候选失败: {e!s}") from e

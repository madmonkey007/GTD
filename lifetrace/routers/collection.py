"""笔记集合（Collection）路由

用户主动创建的意义集合（类似音乐歌单），与笔记多对多。
"""

from fastapi import APIRouter, Depends, HTTPException, Path

from lifetrace.core.dependencies import get_collection_service
from lifetrace.schemas.collection import (
    CollectionAddNotesRequest,
    CollectionCreate,
    CollectionRecommendItem,
    CollectionRecommendResponse,
    CollectionResponse,
    CollectionSummaryResponse,
    CollectionUpdate,
)
from lifetrace.services.collection_service import CollectionService

router = APIRouter(tags=["collection"])


@router.get("/api/collections", response_model=list[CollectionResponse])
async def list_collections(
    service: CollectionService = Depends(get_collection_service),
):
    """列出所有集合（带 note_count）"""
    try:
        return service.list_collections()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取集合列表失败: {e!s}") from e


@router.post("/api/collections", response_model=CollectionResponse, status_code=201)
async def create_collection(
    data: CollectionCreate,
    service: CollectionService = Depends(get_collection_service),
):
    """创建集合"""
    try:
        return service.create_collection(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建集合失败: {e!s}") from e


@router.get("/api/collections/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: int = Path(..., description="集合ID"),
    service: CollectionService = Depends(get_collection_service),
):
    """获取集合详情（含 notes）"""
    try:
        return service.get_collection(collection_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取集合详情失败: {e!s}") from e


@router.put("/api/collections/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: int = Path(..., description="集合ID"),
    data: CollectionUpdate | None = None,
    service: CollectionService = Depends(get_collection_service),
):
    """更新集合（名称/描述/封面）"""
    if data is None:
        raise HTTPException(status_code=400, detail="缺少更新内容")
    try:
        return service.update_collection(collection_id, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新集合失败: {e!s}") from e


@router.delete("/api/collections/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: int = Path(..., description="集合ID"),
    service: CollectionService = Depends(get_collection_service),
):
    """删除集合（软删除，连带成员关系）"""
    try:
        service.delete_collection(collection_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除集合失败: {e!s}") from e


@router.post("/api/collections/{collection_id}/notes", response_model=CollectionResponse)
async def add_notes(
    collection_id: int = Path(..., description="集合ID"),
    data: CollectionAddNotesRequest | None = None,
    service: CollectionService = Depends(get_collection_service),
):
    """批量加入笔记"""
    if data is None:
        raise HTTPException(status_code=400, detail="缺少 journal_ids")
    try:
        return service.add_notes(collection_id, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加入笔记失败: {e!s}") from e


@router.delete("/api/collections/{collection_id}/notes/{journal_id}", response_model=CollectionResponse)
async def remove_note(
    collection_id: int = Path(..., description="集合ID"),
    journal_id: int = Path(..., description="笔记ID"),
    service: CollectionService = Depends(get_collection_service),
):
    """从集合移除一条笔记"""
    try:
        return service.remove_note(collection_id, journal_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"移除笔记失败: {e!s}") from e


@router.post("/api/collections/{collection_id}/summarize", response_model=CollectionSummaryResponse)
async def summarize_collection(
    collection_id: int = Path(..., description="集合ID"),
    service: CollectionService = Depends(get_collection_service),
):
    """AI 生成集合摘要"""
    try:
        return await service.summarize(collection_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成摘要失败: {e!s}") from e


@router.post("/api/collections/{collection_id}/recommend", response_model=CollectionRecommendResponse)
async def recommend_notes(
    collection_id: int = Path(..., description="集合ID"),
    service: CollectionService = Depends(get_collection_service),
):
    """AI 推荐候选笔记（前端确认后加入，不自动加入）"""
    try:
        items = await service.recommend(collection_id)
        return CollectionRecommendResponse(items=items)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"推荐笔记失败: {e!s}") from e

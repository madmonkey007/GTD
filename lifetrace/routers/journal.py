"""日记相关路由"""

import re
from pathlib import Path as PathLibPath
from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, File, UploadFile

from lifetrace.core.dependencies import get_journal_service
from lifetrace.schemas.journal import (
    JournalAutoLinkRequest,
    JournalAutoLinkResponse,
    JournalCreate,
    JournalGenerateRequest,
    JournalGenerateResponse,
    JournalListResponse,
    JournalLiteListResponse,
    JournalResponse,
    JournalUpdate,
)
from lifetrace.services.journal_service import JournalService
from lifetrace.util.logging_config import get_logger
from lifetrace.util.path_utils import get_journal_image_dir
from lifetrace.util.settings import settings

logger = get_logger()

router = APIRouter(tags=["journals"])

# 笔记图片上传：格式/大小限制与文件名清洗
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
_IMAGE_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"\xff\xd8\xff", ".jpg"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
)
# markdown 特殊字符：出现在 alt/文件名里会破坏 ![](url) 语法
_MARKDOWN_UNSAFE_CHARS = re.compile(r"[\[\]()#*`\\]")


def _detect_image_ext(content: bytes) -> str | None:
    """用文件头 magic bytes 判定图片类型，防止伪造扩展名/Content-Type。"""
    if len(content) < 12:
        return None
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ".webp"
    for sig, ext in _IMAGE_SIGNATURES:
        if content.startswith(sig):
            return ext
    return None


def _sanitize_alt(filename: str) -> str:
    """把原始文件名清洗成安全的 markdown alt 文本。"""
    stem = PathLibPath(filename).stem if filename else ""
    stem = _MARKDOWN_UNSAFE_CHARS.sub("", stem).strip()
    return stem[:50] or "image"


@router.post("/api/journals/upload-image", status_code=201)
async def upload_journal_image(file: UploadFile = File(..., description="图片文件")):
    """上传笔记图片，落盘到 uploads/journal-images/，返回可在前端访问的相对 URL。

    返回结构: {url, filename, alt, size}
    url 形如 /uploads/journal-images/<uuid>.<ext>，前端经 next.config rewrite 代理到后端 StaticFiles。
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="图片内容为空")
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="图片超过 5MB 限制")

    ext = _detect_image_ext(content)
    if ext is None:
        raise HTTPException(status_code=400, detail="仅支持 PNG/JPEG/GIF/WEBP 图片")

    storage_name = f"{uuid4().hex}{ext}"
    image_dir = get_journal_image_dir()
    image_dir.mkdir(parents=True, exist_ok=True)
    (image_dir / storage_name).write_bytes(content)

    rel_dir = settings.journal_images_dir.strip("/")
    url = f"/{rel_dir}/{storage_name}"
    alt = _sanitize_alt(file.filename or storage_name)
    logger.info(
        f"笔记图片上传: {file.filename} -> {storage_name} ({len(content)} bytes)"
    )
    return {
        "url": url,
        "filename": file.filename or storage_name,
        "alt": alt,
        "size": len(content),
    }


@router.post("/api/journals", response_model=JournalResponse, status_code=201)
async def create_journal(
    journal: JournalCreate,
    service: JournalService = Depends(get_journal_service),
):
    """创建日记"""
    try:
        return service.create_journal(journal)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建日记失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建日记失败: {e!s}") from e


@router.get("/api/journals/lite", response_model=JournalLiteListResponse)
async def list_journals_lite(
    limit: int = Query(1000, ge=1, le=5000, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    start_date: datetime | None = Query(None, description="开始日期筛选"),
    end_date: datetime | None = Query(None, description="结束日期筛选"),
    service: JournalService = Depends(get_journal_service),
):
    """轻量列出日记：仅 id/name/date/created_at/user_notes，无 N+1 关联查询。

    供侧边栏统计、标签、时光机、聊天上下文使用；完整列表请走 /api/journals。
    """
    try:
        return service.list_journal_lites(limit, offset, start_date, end_date)
    except Exception as e:
        logger.error(f"获取轻量日记列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取轻量日记列表失败: {e!s}") from e


@router.get("/api/journals", response_model=JournalListResponse)
async def list_journals(
    limit: int = Query(100, ge=1, le=1000, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    start_date: datetime | None = Query(None, description="开始日期筛选"),
    end_date: datetime | None = Query(None, description="结束日期筛选"),
    search: str | None = Query(None, min_length=1, max_length=200, description="搜索关键词（匹配标题和笔记内容）"),
    origin: str | None = Query(None, description="按来源精确过滤：manual/todo_background/todo_notes"),
    origins: str | None = Query(None, description="按来源多选过滤，逗号分隔，例如 todo_background,todo_notes"),
    service: JournalService = Depends(get_journal_service),
):
    """获取日记列表"""
    try:
        return service.list_journals(
            limit,
            offset,
            start_date,
            end_date,
            search=search,
            origin=origin,
            origins=origins,
        )
    except Exception as e:
        logger.error(f"获取日记列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取日记列表失败: {e!s}") from e


@router.get("/api/journals/{journal_id}", response_model=JournalResponse)
async def get_journal(
    journal_id: int = Path(..., description="日记ID"),
    service: JournalService = Depends(get_journal_service),
):
    """获取日记详情"""
    try:
        return service.get_journal(journal_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取日记详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取日记详情失败: {e!s}") from e


@router.get("/api/journals/{journal_id}/insight-context")
async def get_insight_context(
    journal_id: int = Path(..., description="日记ID"),
    service: JournalService = Depends(get_journal_service),
):
    """获取洞察上下文：当前笔记 + 4条相似笔记 + 2条跨域笔记

    用于笔记页"思维分析"功能，给大模型提供更丰富的上下文以获得更深层次洞察。
    """
    try:
        return service.get_insight_context(journal_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取洞察上下文失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取洞察上下文失败: {e!s}") from e


@router.put("/api/journals/{journal_id}", response_model=JournalResponse)
async def update_journal(
    journal_id: int = Path(..., description="日记ID"),
    journal: JournalUpdate | None = None,
    service: JournalService = Depends(get_journal_service),
):
    """更新日记"""
    try:
        if journal is None:
            raise HTTPException(status_code=400, detail="缺少日记更新内容")
        return service.update_journal(journal_id, journal)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新日记失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新日记失败: {e!s}") from e


@router.delete("/api/journals/{journal_id}", status_code=204)
async def delete_journal(
    journal_id: int = Path(..., description="日记ID"),
    service: JournalService = Depends(get_journal_service),
):
    """删除日记"""
    try:
        service.delete_journal(journal_id)
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除日记失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除日记失败: {e!s}") from e


@router.post("/api/journals/auto-link", response_model=JournalAutoLinkResponse)
async def auto_link_journal(
    payload: JournalAutoLinkRequest,
    service: JournalService = Depends(get_journal_service),
):
    """自动关联 Todo/活动"""
    try:
        return service.auto_link(payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"自动关联失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"自动关联失败: {e!s}") from e


@router.post("/api/journals/generate-objective", response_model=JournalGenerateResponse)
async def generate_objective_journal(
    payload: JournalGenerateRequest,
    service: JournalService = Depends(get_journal_service),
):
    """生成客观记录"""
    try:
        return service.generate_objective(payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成客观记录失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"生成客观记录失败: {e!s}") from e


@router.post("/api/journals/generate-ai", response_model=JournalGenerateResponse)
async def generate_ai_journal(
    payload: JournalGenerateRequest,
    service: JournalService = Depends(get_journal_service),
):
    """生成 AI 视角记录"""
    try:
        return service.generate_ai_view(payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成 AI 视角失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"生成 AI 视角失败: {e!s}") from e

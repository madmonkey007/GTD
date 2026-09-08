"""Serverless upload contract for post-recording cloud transcription.

音频字节直接存 Neon（cloud_transcription_tasks.data，bytea），转写时生成
带 HMAC 签名的短期公开下载 URL 供 DashScope 拉取，不再依赖外部对象存储
（Supabase 环境值从未配置成功过，且多一个外部依赖多一分配置成本）。

安全模型：
- 上传/发起/轮询均需 Bearer Token，且任务按 user_id 隔离；
- 文件下载 URL 无用户鉴权（DashScope 服务器无法携带用户令牌），
  以「不可猜测的 task_id + HMAC(task_id, exp) 签名 + 1 小时过期」保护，
  转写完成后即清空音频字节。
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
import uuid
from typing import TYPE_CHECKING, Any

import dashscope
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lifetrace.core.dependencies import get_current_user, get_db_session
from lifetrace.schemas.cloud_audio import (
    CloudAudioUploadRequest,
    CloudAudioUploadResponse,
    CloudTranscriptionRequest,
    CloudTranscriptionResponse,
)
from lifetrace.storage.models import CloudTranscriptionTask, User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/cloud-audio", tags=["cloud-audio"])

MAX_AUDIO_BYTES = 5 * 1024 * 1024
_SIGNED_URL_TTL_SECONDS = 3600


def _owned_task(session: Session, task_id: str, user: User) -> CloudTranscriptionTask:
    task = session.get(CloudTranscriptionTask, task_id)
    if task is None or user.id is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="转写任务不存在")
    return task


def _sign(task_id: str, exp: int) -> str:
    secret = os.environ.get("JWT_SECRET_KEY", "")
    return hmac.new(secret.encode(), f"{task_id}:{exp}".encode(), hashlib.sha256).hexdigest()


def _base_url(request: Request) -> str:
    """Vercel 在函数前挂反向代理，真实外部地址取转发头。"""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    )
    return f"{proto}://{host}"


def _file_download_url(request: Request, task_id: str) -> str:
    exp = int(time.time()) + _SIGNED_URL_TTL_SECONDS
    return f"{_base_url(request)}/api/cloud-audio/files/{task_id}?exp={exp}&sig={_sign(task_id, exp)}"


def _read_field(value: Any, name: str) -> Any:
    if isinstance(value, dict):
        return value.get(name)
    return getattr(value, name, None)


def _extract_transcription_url(provider_output: Any) -> str | None:
    results = _read_field(provider_output, "results")
    if isinstance(results, list) and results:
        url = _read_field(results[0], "transcription_url")
        if isinstance(url, str) and url:
            return url

    result = _read_field(provider_output, "result")
    url = _read_field(result, "transcription_url")
    if isinstance(url, str) and url:
        return url
    return None


def _extract_transcription_text(payload: Any) -> str:
    transcripts = _read_field(payload, "transcripts")
    if isinstance(transcripts, list):
        lines = [str(text) for item in transcripts if (text := _read_field(item, "text"))]
        if lines:
            return "\n".join(lines)

    text = _read_field(payload, "text")
    return str(text) if text else ""


def _download_transcription_text(transcription_url: str) -> str:
    response = httpx.get(transcription_url, timeout=20)
    if response.is_error:
        raise HTTPException(status_code=502, detail="无法下载转写结果")
    return _extract_transcription_text(response.json())


@router.post("/uploads", response_model=CloudAudioUploadResponse)
def create_upload(
    payload: CloudAudioUploadRequest,
    request: Request,
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> CloudAudioUploadResponse:
    if user.id is None:
        raise HTTPException(status_code=401, detail="未登录")
    task_id = uuid.uuid4().hex
    extension = payload.filename.rsplit(".", 1)[-1].lower() if "." in payload.filename else "webm"
    object_key = f"{user.id}/{task_id}.{extension}"
    session.add(
        CloudTranscriptionTask(
            id=task_id,
            user_id=user.id,
            object_key=object_key,
            content_type=payload.content_type or "audio/webm",
            status="awaiting_upload",
        )
    )
    return CloudAudioUploadResponse(
        task_id=task_id,
        object_key=object_key,
        upload_url=f"{_base_url(request)}/api/cloud-audio/uploads/{task_id}/content",
    )


@router.put("/uploads/{task_id}/content")
async def upload_content(
    task_id: str,
    request: Request,
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    task = _owned_task(session, task_id, user)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="录音内容为空")
    if len(body) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="音频超过 5MB 限制")
    task.data = body
    task.status = "uploaded"
    return {"status": "uploaded", "size": len(body)}


@router.post("/transcriptions", response_model=CloudTranscriptionResponse)
def begin_transcription(
    payload: CloudTranscriptionRequest,
    request: Request,
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> CloudTranscriptionResponse:
    task = _owned_task(session, payload.task_id, user)
    if task.provider_task_id:
        return CloudTranscriptionResponse(task_id=task.id, status=task.status, text=task.result_text)
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="云端转写尚未配置")
    if not task.data:
        raise HTTPException(status_code=400, detail="录音尚未上传")
    submitted = dashscope.Transcription.async_call(
        model="paraformer-v2",
        file_urls=[_file_download_url(request, task.id)],
        api_key=api_key,
    )
    provider_task_id = getattr(getattr(submitted, "output", None), "task_id", None)
    if not provider_task_id:
        raise HTTPException(status_code=502, detail="转写服务未返回任务编号")
    task.provider_task_id = str(provider_task_id)
    task.status = "processing"
    # TODO(debug): 排查 FILE_DOWNLOAD_FAILED，验证签名 URL 可达性后移除
    return CloudTranscriptionResponse(
        task_id=task.id, status=task.status, text=_file_download_url(request, task.id)
    )


@router.get("/transcriptions/{task_id}", response_model=CloudTranscriptionResponse)
def get_transcription(
    task_id: str,
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> CloudTranscriptionResponse:
    task = _owned_task(session, task_id, user)
    if task.status == "processing" and task.provider_task_id:
        api_key = os.environ.get("DASHSCOPE_API_KEY", "")
        if api_key:
            provider = dashscope.Transcription.fetch(task.provider_task_id, api_key=api_key)
            provider_output = getattr(provider, "output", None)
            state = getattr(provider_output, "task_status", "")
            if state == "SUCCEEDED":
                if not task.result_text:
                    transcription_url = _extract_transcription_url(provider_output)
                    if transcription_url:
                        task.result_text = _download_transcription_text(transcription_url)
                task.status = "completed"
                # 转写完成即清空音频字节，缩短数据驻留时间
                task.data = None
            elif state in {"FAILED", "CANCELED"}:
                task.status = "failed"
                task.error_message = str(getattr(provider_output, "message", "转写失败"))
    return CloudTranscriptionResponse(
        task_id=task.id, status=task.status, text=task.result_text, error=task.error_message
    )


@router.get("/files/{task_id}")
def download_file(
    task_id: str,
    exp: int,
    sig: str,
    session: Session = Depends(get_db_session),
) -> Response:
    """DashScope 专用下载端点：无用户鉴权，以签名 + 过期保护。"""
    if exp < int(time.time()):
        raise HTTPException(status_code=403, detail="下载链接已过期")
    if not hmac.compare_digest(_sign(task_id, exp), sig):
        raise HTTPException(status_code=403, detail="下载链接无效")
    task = session.get(CloudTranscriptionTask, task_id)
    if task is None or task.data is None:
        raise HTTPException(status_code=404, detail="音频不存在")
    return Response(
        content=task.data,
        media_type=task.content_type or "audio/webm",
        headers={"Cache-Control": "no-store"},
    )

"""Serverless contract for post-recording cloud transcription.

浏览器录音（webm/mp4）以 multipart 直接 POST 到本路由，服务端把字节写入
/tmp 后经 dashscope SDK 的 file:// 本地上传能力转交 DashScope 对象存储并
提交 paraformer-v2 异步转写，前端凭 task_id 轮询结果。

- 不依赖外部对象存储（Supabase 值从未配置成功）；
- 音频字节同时存 Neon（cloud_transcription_tasks.data）用于排障，
  转写完成即清空，缩短数据驻留；
- 上传/轮询均需 Bearer Token，任务按 user_id 隔离。
"""

from __future__ import annotations

import contextlib
import os
import uuid
from typing import TYPE_CHECKING, Any

import dashscope
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from lifetrace.core.dependencies import get_current_user, get_db_session
from lifetrace.schemas.cloud_audio import CloudTranscriptionResponse
from lifetrace.storage.models import CloudTranscriptionTask, User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/cloud-audio", tags=["cloud-audio"])

MAX_AUDIO_BYTES = 4 * 1024 * 1024  # Vercel 请求体上限 4.5MB，留出余量


def _owned_task(session: Session, task_id: str, user: User) -> CloudTranscriptionTask:
    task = session.get(CloudTranscriptionTask, task_id)
    if task is None or user.id is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="转写任务不存在")
    return task


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


@router.post("/transcriptions", response_model=CloudTranscriptionResponse)
async def create_transcription(
    file: UploadFile = File(..., description="录音音频（webm/mp4/wav 等）"),
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> CloudTranscriptionResponse:
    if user.id is None:
        raise HTTPException(status_code=401, detail="未登录")
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="云端转写尚未配置")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="录音内容为空")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="录音超过 4MB 限制，请分段录制")

    content_type = file.content_type or "audio/webm"
    extension = {"audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav"}.get(
        content_type, "webm"
    )
    task_id = uuid.uuid4().hex
    object_key = f"{user.id}/{task_id}.{extension}"

    # 音频字节落 /tmp，dashscope SDK 支持 file:// 本地路径：
    # 内部会上传到 DashScope 自己的对象存储并替换为内部 URL
    tmp_path = f"/tmp/{task_id}.{extension}"
    with open(tmp_path, "wb") as tmp_file:
        tmp_file.write(data)

    try:
        submitted = dashscope.Transcription.async_call(
            model="paraformer-v2",
            file_urls=[f"file://{tmp_path}"],
            api_key=api_key,
        )
    finally:
        with contextlib.suppress(OSError):
            os.remove(tmp_path)

    provider_task_id = getattr(getattr(submitted, "output", None), "task_id", None)
    if not provider_task_id:
        raise HTTPException(status_code=502, detail="转写服务未返回任务编号")

    session.add(
        CloudTranscriptionTask(
            id=task_id,
            user_id=user.id,
            object_key=object_key,
            content_type=content_type,
            data=data,
            provider_task_id=str(provider_task_id),
            status="processing",
        )
    )
    return CloudTranscriptionResponse(task_id=task_id, status="processing")


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

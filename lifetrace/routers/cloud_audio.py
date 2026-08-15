"""Serverless upload contract for post-recording cloud transcription."""

from __future__ import annotations

import os
import uuid
from typing import TYPE_CHECKING, Any

import dashscope
import httpx
from fastapi import APIRouter, Depends, HTTPException

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


def _storage_config() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="云端音频存储尚未配置")
    return url, key


def _owned_task(session: Session, task_id: str, user: User) -> CloudTranscriptionTask:
    task = session.get(CloudTranscriptionTask, task_id)
    if task is None or user.id is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="转写任务不存在")
    return task


def _signed_download_url(supabase_url: str, service_key: str, object_key: str) -> str:
    response = httpx.post(
        f"{supabase_url}/storage/v1/object/sign/audio-staging/{object_key}",
        headers={"Authorization": f"Bearer {service_key}", "Content-Type": "application/json"},
        json={"expiresIn": 3600}, timeout=20,
    )
    if response.is_error:
        raise HTTPException(status_code=502, detail="无法创建音频读取地址")
    signed_url = response.json().get("signedURL")
    if not signed_url:
        raise HTTPException(status_code=502, detail="存储服务未返回读取地址")
    return f"{supabase_url}/storage/v1{signed_url}"


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
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> CloudAudioUploadResponse:
    if user.id is None:
        raise HTTPException(status_code=401, detail="未登录")
    supabase_url, service_key = _storage_config()
    task_id = uuid.uuid4().hex
    extension = payload.filename.rsplit(".", 1)[-1].lower() if "." in payload.filename else "webm"
    object_key = f"{user.id}/{task_id}.{extension}"
    response = httpx.post(
        f"{supabase_url}/storage/v1/object/upload/sign/audio-staging/{object_key}",
        headers={"Authorization": f"Bearer {service_key}", "Content-Type": "application/json"},
        json={},
        timeout=20,
    )
    if response.is_error:
        raise HTTPException(status_code=502, detail="无法创建音频上传地址")
    token = response.json().get("token")
    if not token:
        raise HTTPException(status_code=502, detail="存储服务未返回上传令牌")
    session.add(CloudTranscriptionTask(id=task_id, user_id=user.id, object_key=object_key))
    return CloudAudioUploadResponse(
        task_id=task_id,
        object_key=object_key,
        upload_url=f"{supabase_url}/storage/v1/object/upload/sign/audio-staging/{object_key}?token={token}",
    )


@router.post("/transcriptions", response_model=CloudTranscriptionResponse)
def begin_transcription(
    payload: CloudTranscriptionRequest,
    session: Session = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> CloudTranscriptionResponse:
    task = _owned_task(session, payload.task_id, user)
    if task.provider_task_id:
        return CloudTranscriptionResponse(task_id=task.id, status=task.status, text=task.result_text)
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="云端转写尚未配置")
    supabase_url, service_key = _storage_config()
    submitted = dashscope.Transcription.async_call(
        model="paraformer-v2", file_urls=[_signed_download_url(supabase_url, service_key, task.object_key)], api_key=api_key
    )
    provider_task_id = getattr(getattr(submitted, "output", None), "task_id", None)
    if not provider_task_id:
        raise HTTPException(status_code=502, detail="转写服务未返回任务编号")
    task.provider_task_id = str(provider_task_id)
    task.status = "processing"
    return CloudTranscriptionResponse(task_id=task.id, status=task.status)


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
            elif state in {"FAILED", "CANCELED"}:
                task.status = "failed"
                task.error_message = str(getattr(provider_output, "message", "转写失败"))
    return CloudTranscriptionResponse(
        task_id=task.id, status=task.status, text=task.result_text, error=task.error_message
    )

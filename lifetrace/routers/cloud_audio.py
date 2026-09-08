"""Serverless contract for post-recording cloud transcription.

浏览器录音改为 PCM16(16k) 采集，录音结束后整体 POST 到本路由；
服务端把 PCM 经出站 WebSocket 直推 DashScope fun-asr-realtime
（该账号唯一可用的转写服务；文件转写模型 paraformer-v2/fun-asr
均未开通），同步等待识别完成并返回文本。

- 请求体为裸 PCM（audio/l16; rate=16000, 16bit 单声道），上限 4MB
  （Vercel 请求体限制 4.5MB，约可容纳 2 分钟录音）；
- 复用本地同款 ASRClient（settings 在云端缺省为占位符，
  这里显式使用 DASHSCOPE_API_KEY 环境变量）；
- Vercel 仅禁止入站 WebSocket，出站连接不受影响。
"""

from __future__ import annotations

import asyncio
import contextlib
import os
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException, Request

from lifetrace.core.dependencies import get_current_user
from lifetrace.services.asr_client import ASRClient

if TYPE_CHECKING:
    from lifetrace.storage.models import User

router = APIRouter(prefix="/api/cloud-audio", tags=["cloud-audio"])

MAX_AUDIO_BYTES = 4 * 1024 * 1024  # 4MB ≈ 16k/16bit 单声道约 131 秒
_TRANSCRIBE_TIMEOUT_SECONDS = 55  # 低于函数 maxDuration=60


@router.get("/probe")
def probe() -> dict[str, Any]:
    """通道探测：明确告知前端当前部署的转写方式与配置状态。

    - 200 + transport=cloud：云端部署，走 HTTP 转写（不泄露 ASR Key）；
    - 404：本地部署未挂载本路由，前端走本地 WebSocket。
    """
    return {
        "transport": "cloud",
        "asr_configured": bool(os.environ.get("DASHSCOPE_API_KEY", "").strip()),
    }


async def _transcribe_pcm(pcm: bytes, api_key: str) -> dict[str, str]:
    """把整段 PCM 经出站 WebSocket 流式推给 fun-asr-realtime 并收集文本。"""
    client = ASRClient()
    # 云端不走 settings（config.yaml 不在部署包内），显式使用环境变量
    client.api_key = api_key

    result: dict[str, str] = {"final": "", "partial": "", "error": ""}

    def on_result(text: str, is_final: bool) -> None:
        text = text.strip()
        if not text:
            return
        if is_final:
            # 逐句 final：固化进累计文本
            result["final"] = f"{result['final']} {text}".strip() if result["final"] else text
        else:
            # partial 只含当前句
            result["partial"] = text

    def on_error(error: Exception) -> None:
        result["error"] = str(error)

    async def pcm_stream():
        step = 3200  # 100ms @16k/16bit
        for i in range(0, len(pcm), step):
            yield pcm[i : i + step]
            await asyncio.sleep(0.01)

    with contextlib.suppress(TimeoutError):
        await asyncio.wait_for(
            client.transcribe_stream(pcm_stream(), on_result, on_error),
            timeout=_TRANSCRIBE_TIMEOUT_SECONDS,
        )
    return result


@router.post("/transcriptions")
async def create_transcription(
    request: Request,
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if user.id is None:
        raise HTTPException(status_code=401, detail="未登录")

    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="云端转写尚未配置")

    pcm = await request.body()
    if not pcm:
        raise HTTPException(status_code=400, detail="录音内容为空")
    if len(pcm) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="录音超过 4MB 限制，请分段录制")

    result = await asyncio.wait_for(_transcribe_pcm(pcm, api_key), timeout=60)
    if result["error"] and not result["final"] and not result["partial"]:
        raise HTTPException(status_code=502, detail=f"转写失败：{result['error']}")

    text = result["final"]
    if result["partial"] and result["partial"] not in text:
        text = f"{text} {result['partial']}".strip()
    return {"status": "completed", "text": text}

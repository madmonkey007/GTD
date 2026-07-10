"""云端嵌入 API 客户端

使用 SiliconFlow 的 Embedding API 替代本地 sentence-transformers 模型。
依赖: httpx (已通过 openai/fastapi 间接安装)
"""

import os
from typing import Any

import httpx

from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings

logger = get_logger()

SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1/embeddings"
DEFAULT_MODEL = "Qwen/Qwen3-VL-Embedding-8B"


def _get_api_key() -> str:
    """获取 SiliconFlow API Key（优先环境变量，其次配置文件）"""
    env_key = os.environ.get("SILICONFLOW_API_KEY", "").strip()
    if env_key:
        return env_key
    cfg_key = settings.get("vector_db.siliconflow_api_key", "").strip()
    return cfg_key


class CloudEmbeddingClient:
    """云端嵌入客户端

    通过 SiliconFlow Embedding API 将文本转换为向量。
    消除对 sentence-transformers / torch 等本地依赖。
    """

    def __init__(self) -> None:
        self.api_key = _get_api_key()
        self.model = settings.get("vector_db.siliconflow_model", DEFAULT_MODEL)
        if not self.api_key:
            logger.warning(
                "SILICONFLOW_API_KEY 未配置，嵌入功能将不可用。"
                "请设置环境变量 SILICONFLOW_API_KEY 或配置 vector_db.siliconflow_api_key"
            )

    def is_available(self) -> bool:
        return bool(self.api_key)

    def embed_text(self, text: str) -> list[float]:
        """将单条文本转换为向量

        Args:
            text: 输入文本

        Returns:
            向量嵌入，失败时返回空列表
        """
        if not text or not text.strip():
            return []
        if not self.api_key:
            logger.error("Embedding unavailable: SILICONFLOW_API_KEY not configured")
            return []

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    SILICONFLOW_BASE_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "input": text.strip(),
                        "model": self.model,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                embeddings = data.get("data", [])
                if embeddings and len(embeddings) > 0:
                    return embeddings[0].get("embedding", [])
                logger.warning(f"Unexpected API response: {data}")
                return []
        except httpx.HTTPStatusError as e:
            logger.error(f"Embedding API HTTP error: {e.response.status_code} {e.response.text}")
            return []
        except httpx.RequestError as e:
            logger.error(f"Embedding API request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Embedding API unexpected error: {e}")
            return []

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """批量将文本转换为向量

        Args:
            texts: 输入文本列表

        Returns:
            向量嵌入列表，长度与输入相同（失败的返回空列表）
        """
        if not texts:
            return []
        if not self.api_key:
            logger.error("Embedding unavailable: SILICONFLOW_API_KEY not configured")
            return []

        # 过滤空文本
        valid_indices: list[int] = []
        valid_texts: list[str] = []
        for i, t in enumerate(texts):
            if t and t.strip():
                valid_indices.append(i)
                valid_texts.append(t.strip())

        if not valid_texts:
            return []

        try:
            with httpx.Client(timeout=60) as client:
                resp = client.post(
                    SILICONFLOW_BASE_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "input": valid_texts,
                        "model": self.model,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            # 解析返回的嵌入
            api_embeddings: dict[int, list[float]] = {}
            for item in data.get("data", []):
                index = item.get("index")
                embedding = item.get("embedding")
                if index is not None and embedding:
                    api_embeddings[index] = embedding

            # 按原始顺序排列
            result: list[list[float]] = []
            for i in range(len(valid_texts)):
                if i in api_embeddings:
                    result.append(api_embeddings[i])
                else:
                    logger.warning(f"Missing embedding for index {i}")
                    result.append([])

            return result

        except httpx.HTTPStatusError as e:
            logger.error(f"Batch embedding API HTTP error: {e.response.status_code} {e.response.text}")
            return [[] for _ in texts]
        except httpx.RequestError as e:
            logger.error(f"Batch embedding API request failed: {e}")
            return [[] for _ in texts]
        except Exception as e:
            logger.error(f"Batch embedding API unexpected error: {e}")
            return [[] for _ in texts]
"""向量数据库模块

提供文本嵌入、向量存储、语义检索和重排序功能。
使用 SiliconFlow 云端 Embedding API 替代本地 sentence-transformers 模型。
"""

import hashlib
from typing import Any, cast

from lifetrace.llm.cloud_embeddings import CloudEmbeddingClient
from lifetrace.util.logging_config import get_logger
from lifetrace.util.path_utils import get_vector_db_dir
from lifetrace.util.settings import settings
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()

try:
    import chromadb
    import numpy as np
    from chromadb.config import Settings
except ImportError as e:
    logger.warning(f"Vector database dependencies not installed: {e}")
    chromadb = None
    np = None
    Settings = None


class VectorDatabase:
    """向量数据库管理器

    提供文本嵌入、向量存储和语义检索功能。
    使用 ChromaDB 作为向量数据库后端，SiliconFlow API 生成嵌入。
    """

    def __init__(self):
        """初始化向量数据库"""
        self.logger = logger

        # 检查依赖
        if not self._check_dependencies():
            raise ImportError("Vector database dependencies not available")

        # 初始化
        self.embedding_client: CloudEmbeddingClient | None = None
        self.chroma_client = None
        self.collection = None  # 默认 OCR 集合（向后兼容）
        self._collections: dict[str, Any] = {}  # 多集合缓存：name -> chroma Collection

        # 配置参数
        self.vector_db_path = get_vector_db_dir()
        self.collection_name = settings.vector_db.collection_name

        # 初始化
        self._initialize()

    def _check_dependencies(self) -> bool:
        """检查依赖是否可用"""
        return all([
            chromadb is not None,
            np is not None,
            Settings is not None,
        ])

    def _initialize(self):
        """初始化模型和数据库"""
        try:
            # 创建数据目录
            self.vector_db_path.mkdir(parents=True, exist_ok=True)

            # 初始化云端嵌入客户端
            self.embedding_client = CloudEmbeddingClient()
            if not self.embedding_client.is_available():
                logger.warning(
                    "Cloud embedding client not available (SILICONFLOW_API_KEY not configured). "
                    "Vector search will be disabled."
                )
                self.embedding_client = None
            else:
                logger.info("Cloud embedding client initialized (SiliconFlow)")

            # 初始化 ChromaDB
            logger.info(f"Initializing ChromaDB at: {self.vector_db_path}")
            if chromadb is None:
                raise RuntimeError("ChromaDB dependency not available")
            if Settings is None:
                raise RuntimeError("ChromaDB Settings not available")
            self.chroma_client = chromadb.PersistentClient(
                path=str(self.vector_db_path),
                settings=Settings(anonymized_telemetry=False, allow_reset=True),
            )

            # 获取或创建集合
            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "LifeTrace OCR text embeddings"},
            )
            self._collections[self.collection_name] = self.collection

            logger.info("Vector database initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize vector database: {e}")
            raise

    def get_collection(self, name: str, description: str = "", distance_metric: str = "l2") -> Any:
        """获取或创建指定名称的集合（多集合支持）

        Args:
            name: 集合名称
            description: 集合描述（仅新建时生效）
            distance_metric: 距离度量，"l2"（默认）或 "cosine"

        Returns:
            ChromaDB Collection 对象
        """
        if self.chroma_client is None:
            raise RuntimeError("Chroma client not initialized")
        if name in self._collections:
            return self._collections[name]
        col = self.chroma_client.get_or_create_collection(
            name=name,
            metadata={
                "description": description or f"LifeTrace collection: {name}",
                "hnsw:space": distance_metric,
            },
        )
        self._collections[name] = col
        return col

    def embed_text(self, text: str) -> list[float]:
        """将文本转换为向量嵌入（使用云端 API）

        Args:
            text: 输入文本

        Returns:
            文本的向量嵌入
        """
        if not text or not text.strip():
            return []

        if not self.embedding_client:
            logger.error("Embedding client not available")
            return []

        try:
            return self.embedding_client.embed_text(text)
        except Exception as e:
            logger.error(f"Failed to embed text: {e}")
            return []

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """批量将文本转换为向量嵌入

        Args:
            texts: 输入文本列表

        Returns:
            向量嵌入列表
        """
        if not texts:
            return []

        if not self.embedding_client:
            logger.error("Embedding client not available")
            return []

        try:
            return self.embedding_client.embed_texts(texts)
        except Exception as e:
            logger.error(f"Failed to batch embed texts: {e}")
            return [[] for _ in texts]

    def add_document(self, doc_id: str, text: str, metadata: dict[str, Any] | None = None) -> bool:
        """添加文档到向量数据库

        Args:
            doc_id: 文档唯一标识符
            text: 文档文本内容
            metadata: 文档元数据

        Returns:
            是否添加成功
        """
        if not text or not text.strip():
            self.logger.warning(f"Empty text for document {doc_id}")
            return False

        try:
            if self.collection is None:
                raise RuntimeError("Vector collection not initialized")
            collection = self.collection
            # 生成嵌入
            embedding = self.embed_text(text)
            if not embedding:
                return False

            # 准备元数据
            doc_metadata = {
                "timestamp": get_utc_now().isoformat(),
                "text_length": len(text),
                "text_hash": hashlib.md5(text.encode(), usedforsecurity=False).hexdigest(),
            }
            if metadata:
                doc_metadata.update(metadata)

            # 过滤掉 None 值（ChromaDB 不接受 None）
            doc_metadata = {k: v for k, v in doc_metadata.items() if v is not None}

            # 添加到集合
            collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[doc_metadata],
                ids=[doc_id],
            )

            self.logger.debug(f"Added document {doc_id} to vector database")
            return True

        except Exception as e:
            self.logger.error(f"Failed to add document {doc_id}: {e}")
            return False

    def add_document_with_embedding(
        self,
        doc_id: str,
        text: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """使用预计算的嵌入向量添加文档到向量数据库

        Args:
            doc_id: 文档唯一标识符
            text: 文档文本内容
            embedding: 预计算的嵌入向量
            metadata: 文档元数据

        Returns:
            是否添加成功
        """
        if not text or not text.strip():
            self.logger.warning(f"Empty text for document {doc_id}")
            return False

        if not embedding:
            self.logger.warning(f"Empty embedding for document {doc_id}")
            return False

        try:
            if self.collection is None:
                raise RuntimeError("Vector collection not initialized")
            collection = self.collection
            # 准备元数据
            doc_metadata = {
                "timestamp": get_utc_now().isoformat(),
                "text_length": len(text),
                "text_hash": hashlib.md5(text.encode(), usedforsecurity=False).hexdigest(),
            }
            if metadata:
                doc_metadata.update(metadata)

            # 过滤掉 None 值（ChromaDB 不接受 None）
            doc_metadata = {k: v for k, v in doc_metadata.items() if v is not None}

            # 添加到集合
            collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[doc_metadata],
                ids=[doc_id],
            )

            self.logger.debug(f"Added document {doc_id} with pre-computed embedding")
            return True

        except Exception as e:
            self.logger.error(f"Failed to add document {doc_id} with embedding: {e}")
            return False

    def update_document(
        self, doc_id: str, text: str, metadata: dict[str, Any] | None = None
    ) -> bool:
        """更新文档

        Args:
            doc_id: 文档唯一标识符
            text: 新的文档文本内容
            metadata: 新的文档元数据

        Returns:
            是否更新成功
        """
        try:
            # 先删除旧文档
            self.delete_document(doc_id)
            # 添加新文档
            return self.add_document(doc_id, text, metadata)
        except Exception as e:
            self.logger.error(f"Failed to update document {doc_id}: {e}")
            return False

    def delete_document(self, doc_id: str) -> bool:
        """删除文档

        Args:
            doc_id: 文档唯一标识符

        Returns:
            是否删除成功
        """
        try:
            if self.collection is None:
                raise RuntimeError("Vector collection not initialized")
            self.collection.delete(ids=[doc_id])
            self.logger.debug(f"Deleted document {doc_id} from vector database")
            return True
        except Exception as e:
            self.logger.error(f"Failed to delete document {doc_id}: {e}")
            return False

    def search(
        self, query: str, top_k: int = 10, where: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """语义搜索

        Args:
            query: 查询文本
            top_k: 返回结果数量
            where: 元数据过滤条件

        Returns:
            搜索结果列表，每个结果包含 id, document, metadata, distance
        """
        if not query or not query.strip():
            return []

        try:
            if self.collection is None:
                raise RuntimeError("Vector collection not initialized")
            # 生成查询嵌入
            query_embedding = self.embed_text(query)
            if not query_embedding:
                return []

            # 清理和验证 where 条件
            cleaned_where = self._clean_where_clause(where)

            # 执行搜索
            results = self.collection.query(
                query_embeddings=[query_embedding], n_results=top_k, where=cleaned_where
            )
            results_dict = cast("dict[str, Any]", results)
            ids = results_dict.get("ids") or [[]]
            documents = results_dict.get("documents") or [[]]
            metadatas = results_dict.get("metadatas") or [[]]
            distances = results_dict.get("distances") or []

            # 格式化结果
            formatted_results = []
            for i in range(len(ids[0])):
                formatted_results.append(
                    {
                        "id": ids[0][i],
                        "document": documents[0][i],
                        "metadata": (metadatas[0][i] if metadatas[0] else {}),
                        "distance": (distances[0][i] if distances else None),
                    }
                )

            self.logger.debug(f"Found {len(formatted_results)} results for query: {query[:50]}...")
            return formatted_results

        except Exception as e:
            self.logger.error(f"Failed to search: {e}")
            return []

    def _clean_where_clause(self, where: dict[str, Any] | None) -> dict[str, Any] | None:
        """清理和验证 where 条件，移除空对象和无效操作符"""
        if not where:
            return None

        cleaned = {}
        for key, value in where.items():
            if value is None or (isinstance(value, dict) and not value):
                continue
            if isinstance(value, dict):
                cleaned_value = self._clean_where_clause(value)
                if cleaned_value:
                    cleaned[key] = cleaned_value
            else:
                cleaned[key] = value

        return cleaned if cleaned else None

    def rerank(
        self, query: str, documents: list[str], top_k: int | None = None
    ) -> list[tuple[str, float]]:
        """（已禁用）重排序功能

        本地 CrossEncoder 已被移除，此方法返回原始文档顺序。
        如需重排序，可在后续版本中对接云端 reranking API。

        Args:
            query: 查询文本
            documents: 文档列表
            top_k: 返回的文档数量

        Returns:
            原始文档列表（未重排序）
        """
        if not query or not documents:
            return []

        if top_k is not None:
            documents = documents[:top_k]
        return [(doc, 1.0) for doc in documents]

    def search_and_rerank(
        self,
        query: str,
        retrieve_k: int = 20,
        rerank_k: int = 5,
        where: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """搜索并重排序

        由于 CrossEncoder 已替换为云端，重排序步骤直接返回原始搜索结果。

        Args:
            query: 查询文本
            retrieve_k: 初始检索数量
            rerank_k: 返回数量
            where: 元数据过滤条件

        Returns:
            搜索结果
        """
        search_results = self.search(query, retrieve_k, where)
        if not search_results:
            return []

        # 直接取前 rerank_k 条（跳过重排序）
        for result in search_results[:rerank_k]:
            result["rerank_score"] = self._compute_score(result)

        return search_results[:rerank_k]

    @staticmethod
    def _compute_score(result: dict[str, Any]) -> float:
        """计算相似度分数（从 distance 转换）"""
        distance = result.get("distance")
        if distance is not None:
            return max(0, 1 - distance)
        return 0.0

    def get_collection_stats(self) -> dict[str, Any]:
        """获取集合统计信息

        Returns:
            集合统计信息
        """
        try:
            if self.collection is None:
                raise RuntimeError("Vector collection not initialized")
            count = self.collection.count()
            return {
                "collection_name": self.collection_name,
                "document_count": count,
                "embedding_model": "siliconflow-cloud",
                "cross_encoder_model": "disabled",
                "vector_db_path": str(self.vector_db_path),
            }
        except Exception as e:
            self.logger.error(f"Failed to get collection stats: {e}")
            return {}

    def reset_collection(self) -> bool:
        """重置集合（删除所有数据）

        Returns:
            是否重置成功
        """
        try:
            if self.chroma_client is None:
                raise RuntimeError("Chroma client not initialized")
            self.chroma_client.delete_collection(self.collection_name)
            self.collection = self.chroma_client.create_collection(
                name=self.collection_name,
                metadata={"description": "LifeTrace OCR text embeddings"},
            )
            self._collections[self.collection_name] = self.collection
            self.logger.info(f"Reset collection {self.collection_name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to reset collection: {e}")
            return False

    # ─── Journal 向量索引（笔记语义检索） ───

    JOURNAL_COLLECTION = "lifetrace_journal_v2"

    def _journal_doc_id(self, journal_id: int) -> str:
        return f"journal_{journal_id}"

    def _build_journal_text(self, name: str, user_notes: str, tags: list[Any] | None) -> str:
        """构建用于 embedding 的笔记文本（标题 + 标签 + 正文）

        tags 可以是字符串列表，也可以是 Tag ORM 对象列表（取 .tag_name）。
        """
        parts: list[str] = []
        if name and name.strip():
            parts.append(name.strip())
        if tags:
            tag_names: list[str] = []
            for t in tags:
                if t is None:
                    continue
                if isinstance(t, str):
                    tag_names.append(t)
                else:
                    # ORM 对象：取 tag_name 属性
                    tn = getattr(t, "tag_name", None) or getattr(t, "name", None)
                    if tn:
                        tag_names.append(str(tn))
            if tag_names:
                parts.append(" ".join(f"#{tn}" for tn in tag_names))
        if user_notes and user_notes.strip():
            parts.append(user_notes.strip())
        return "\n".join(parts)

    def upsert_journal(
        self,
        journal_id: int,
        name: str,
        user_notes: str,
        tags: list[Any] | None = None,
    ) -> bool:
        """写入或更新笔记到向量库

        Args:
            journal_id: 笔记 ID
            name: 笔记标题
            user_notes: 笔记正文
            tags: 标签列表
        """
        text = self._build_journal_text(name, user_notes, tags)
        if not text.strip():
            return False
        try:
            collection = self.get_collection(
                self.JOURNAL_COLLECTION, "LifeTrace journal embeddings", distance_metric="cosine"
            )
            embedding = self.embed_text(text)
            if not embedding:
                return False
            doc_id = self._journal_doc_id(journal_id)
            # 先删后加，避免重复 id 报错
            try:
                collection.delete(ids=[doc_id])
            except Exception:
                pass
            collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[{"journal_id": journal_id, "text_length": len(text)}],
                ids=[doc_id],
            )
            self.logger.debug(f"Indexed journal {journal_id} ({len(text)} chars)")
            return True
        except Exception as e:
            self.logger.error(f"Failed to upsert journal {journal_id}: {e}")
            return False

    def delete_journal(self, journal_id: int) -> bool:
        """从向量库删除笔记"""
        try:
            collection = self.get_collection(self.JOURNAL_COLLECTION)
            doc_id = self._journal_doc_id(journal_id)
            collection.delete(ids=[doc_id])
            return True
        except Exception as e:
            self.logger.error(f"Failed to delete journal {journal_id} from vector db: {e}")
            return False

    def search_similar_journals(
        self,
        query_text: str,
        top_k: int = 20,
        exclude_journal_id: int | None = None,
    ) -> list[dict[str, Any]]:
        """语义检索相似笔记

        Args:
            query_text: 查询文本（通常是当前笔记内容）
            top_k: 返回数量
            exclude_journal_id: 排除的笔记 ID（当前笔记自身）

        Returns:
            结果列表，每项含 journal_id, document, distance, score
            （score = 1 - distance，越大越相似）
        """
        if not query_text or not query_text.strip():
            return []
        try:
            collection = self.get_collection(self.JOURNAL_COLLECTION)
            query_embedding = self.embed_text(query_text)
            if not query_embedding:
                return []
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
            )
            results_dict = cast("dict[str, Any]", results)
            ids = (results_dict.get("ids") or [[]])[0]
            documents = (results_dict.get("documents") or [[]])[0]
            metadatas = (results_dict.get("metadatas") or [[]])[0]
            distances = (results_dict.get("distances") or [[]])[0]

            formatted: list[dict[str, Any]] = []
            for i in range(len(ids)):
                meta = metadatas[i] if metadatas else {}
                jid = meta.get("journal_id")
                if exclude_journal_id is not None and jid == exclude_journal_id:
                    continue
                dist = distances[i] if i < len(distances) else None
                score = max(0.0, 1.0 - dist) if dist is not None else 0.0
                formatted.append(
                    {
                        "journal_id": jid,
                        "document": documents[i] if i < len(documents) else "",
                        "distance": dist,
                        "score": score,
                    }
                )
            return formatted
        except Exception as e:
            self.logger.error(f"Failed to search similar journals: {e}")
            return []


def create_vector_db() -> VectorDatabase | None:
    """创建向量数据库实例

    Returns:
        向量数据库实例，如果依赖不可用则返回 None
    """
    if not all([chromadb, np, Settings]):
        logger.warning("Vector database dependencies (chromadb/numpy) not available")
        return None

    if not settings.vector_db.enabled:
        logger.info("Vector database is disabled in configuration")
        return None

    try:
        return VectorDatabase()
    except ImportError:
        logger.warning("Vector database not available, skipping initialization")
        return None
    except Exception as e:
        logger.error(f"Failed to create vector database: {e}")
        return None
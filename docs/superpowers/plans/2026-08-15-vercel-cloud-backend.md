# Vercel 云端精简后端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LifeTrace 的网页所需 API、RAG 和完成录音后的转写部署到 Vercel，同时保持现有离线优先同步和用户隔离。

**Architecture:** 新建无副作用的 Vercel FastAPI 入口，仅注册云端模块，并作为仓库根目录的独立 Vercel 后端项目部署；现有前端项目继续以 `lifetrace-frontend` 为根目录，使用 `NEXT_PUBLIC_API_URL` 代理后端。Neon 通过 pgvector 保存每个用户的笔记向量；现有云端 Embedding API 保持不变。音频文件在客户端与 Supabase Storage 间直传，Vercel 只签发受保护的上传/下载链接并协调 DashScope 异步转写。

**Tech Stack:** Next.js 16、FastAPI、SQLModel/SQLAlchemy、Neon PostgreSQL + pgvector、Supabase Storage、DashScope 非实时 ASR、Vercel Functions。

**Current implementation status:** Tasks 1-4 are implemented on the feature branch. Task 5 deployment guidance lives in `docs/vercel-cloud-deployment.md` because `README.md` currently contains invalid UTF-8 bytes that prevent safe patching.

---

### Task 1: 建立 Vercel 可加载的云端 API 入口

**Files:**
- Create: `lifetrace/vercel_app.py`
- Create: `api/index.py`
- Create: `requirements-vercel.txt`
- Create: `vercel.json`
- Modify: `pyproject.toml`
- Modify: `lifetrace/core/module_registry.py`
- Test: `tests/test_vercel_app.py`

- [ ] **Step 1: 写出入口只注册云端模块的失败测试**

```python
def test_vercel_app_registers_cloud_modules_only():
    from lifetrace.vercel_app import app

    paths = {route.path for route in app.routes}
    assert "/api/auth/login" in paths
    assert "/api/sync/push" in paths
    assert "/api/audio/transcribe" not in paths
    assert "/api/audio/recordings" not in paths
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_vercel_app.py::test_vercel_app_registers_cloud_modules_only -q`

Expected: FAIL，因为 `lifetrace.vercel_app` 尚不存在。

- [ ] **Step 3: 实现云端入口及模块白名单**

```python
CLOUD_MODULE_IDS = frozenset({
    "health", "auth", "sync", "todo", "journal", "habit", "project",
    "collection", "note_link", "chat", "todo_extraction", "zero_think",
    "vector", "rag", "cloud_audio",
})

app = FastAPI(title="LifeTrace Cloud API")
register_modules(app, CLOUD_MODULE_IDS)
```

入口不得调用 `get_job_manager()`、`StaticFiles`、延迟模块注册或本机数据目录初始化。`api/index.py` 只导出 `from lifetrace.vercel_app import app`。`requirements-vercel.txt` 只列云端运行依赖；不得列入 `chromadb`、`rapidocr-onnxruntime`、`numpy`、`scipy`、`hdbscan`、`mss`、`pyobjc`、`pywin32` 或服务端 `websockets`。仓库根目录的 `vercel.json` 只配置 Python 后端入口；前端仍由其现有的 `lifetrace-frontend` Vercel 项目构建。

- [ ] **Step 4: 运行入口测试与导入检查**

Run: `uv run pytest tests/test_vercel_app.py -q && uv run python -c "from lifetrace.vercel_app import app; print(app.title)"`

Expected: PASS，输出 `LifeTrace Cloud API`。

- [ ] **Step 5: 提交**

```bash
git add lifetrace/vercel_app.py api/index.py requirements-vercel.txt vercel.json pyproject.toml lifetrace/core/module_registry.py tests/test_vercel_app.py
git commit -m "Run the web API without desktop services"
```

### Task 2: 将笔记向量索引迁移到 Neon pgvector

**Files:**
- Create: `lifetrace/llm/postgres_vector_db.py`
- Create: `lifetrace/migrations/versions/add_pgvector_journal_index_003.py`
- Modify: `lifetrace/llm/vector_db.py`
- Modify: `lifetrace/services/journal_service.py`
- Modify: `lifetrace/core/lazy_services.py`
- Test: `tests/test_postgres_vector_db.py`
- Test: `tests/test_user_isolation.py`

- [ ] **Step 1: 写出用户隔离与覆盖写入的失败测试**

```python
def test_journal_vector_query_is_scoped_to_its_user(vector_db):
    vector_db.upsert_journal(user_id=1, journal_id=9, title="A", content="alpha", tags=[])
    vector_db.upsert_journal(user_id=2, journal_id=9, title="B", content="alpha", tags=[])

    assert [hit["journal_id"] for hit in vector_db.search_similar_journals(1, "alpha")] == [9]
    assert [hit["journal_id"] for hit in vector_db.search_similar_journals(2, "alpha")] == [9]
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_postgres_vector_db.py -q`

Expected: FAIL，因为 PostgreSQL 向量后端尚不存在。

- [ ] **Step 3: 创建迁移和 PostgreSQL 向量仓库**

迁移必须执行 `CREATE EXTENSION IF NOT EXISTS vector`，创建 `journal_vectors` 表，包含 `user_id`、`journal_id`、`content_hash`、`content`、`embedding`、时间戳，并添加 `(user_id, journal_id)` 唯一约束。仓库使用已有 `CloudEmbeddingClient`，对同一用户/日记使用 UPSERT；删除日记时删除其向量行；所有相似检索 SQL 必须带 `WHERE user_id = :user_id`。

- [ ] **Step 4: 将 JournalService 改为显式用户作用域的向量接口**

```python
self._vector_db.upsert_journal(
    user_id=self.user_id,
    journal_id=journal_id,
    title=name or "",
    content=user_notes or "",
    tags=tags,
)
```

云端入口选择 `PostgresVectorDatabase`；桌面入口继续选择现有 ChromaDB，避免破坏本机安装。

- [ ] **Step 5: 运行测试**

Run: `uv run pytest tests/test_postgres_vector_db.py tests/test_user_isolation.py -q`

Expected: PASS，且测试证明两个用户不能互相检索向量。

- [ ] **Step 6: 提交**

```bash
git add lifetrace/llm/postgres_vector_db.py lifetrace/migrations/versions/add_pgvector_journal_index_003.py lifetrace/llm/vector_db.py lifetrace/services/journal_service.py lifetrace/core/lazy_services.py tests/test_postgres_vector_db.py tests/test_user_isolation.py
git commit -m "Persist cloud journal vectors in Neon"
```

### Task 3: 确保离线同步驱动云端 RAG 索引

**Files:**
- Modify: `lifetrace/services/sync_service.py`
- Test: `tests/test_sync_service.py`
- Test: `tests/test_sync_router.py`

- [ ] **Step 1: 写出离线日记同步后可检索的失败测试**

```python
def test_syncing_a_journal_updates_the_current_users_vector_index(sync_service, vector_db):
    sync_service.push(make_journal_create("offline journal", "cloud searchable"))

    assert vector_db.search_similar_journals(sync_service.user_id, "searchable")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_sync_service.py::test_syncing_a_journal_updates_the_current_users_vector_index -q`

Expected: FAIL，直到同步服务明确等待云端索引提交。

- [ ] **Step 3: 在云端模式中同步提交索引变更**

同步创建/更新日记后，在返回 push 成功之前完成对应 pgvector UPSERT；删除后完成 DELETE。桌面模式可保持现有后台线程。上游 Embedding 失败时返回该操作的可重试错误，不能把日记数据库写入回滚或标记为已完整索引。

- [ ] **Step 4: 运行同步回归测试**

Run: `uv run pytest tests/test_sync_service.py tests/test_sync_router.py tests/test_user_isolation.py -q`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add lifetrace/services/sync_service.py tests/test_sync_service.py tests/test_sync_router.py
git commit -m "Index offline journals after cloud sync"
```

### Task 4: 用上传后转写替换实时音频 WebSocket

**Files:**
- Create: `lifetrace/routers/cloud_audio.py`
- Create: `lifetrace/services/cloud_audio_service.py`
- Create: `lifetrace/schemas/cloud_audio.py`
- Modify: `lifetrace-frontend/lib/store/audio-recording-store.ts`
- Modify: `lifetrace-frontend/apps/audio/AudioPanel.tsx`
- Test: `tests/test_cloud_audio_router.py`
- Test: `lifetrace-frontend/lib/store/audio-recording-store.test.ts`

- [ ] **Step 1: 写出受认证保护的上传与任务状态失败测试**

```python
def test_only_task_owner_can_read_transcription_status(client, user_a_token, user_b_token):
    task = create_task(client, user_a_token)

    assert client.get(f"/api/audio/transcriptions/{task.id}", headers=bearer(user_b_token)).status_code == 404
    assert client.get(f"/api/audio/transcriptions/{task.id}", headers=bearer(user_a_token)).status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_cloud_audio_router.py -q`

Expected: FAIL，因为云端音频路由尚不存在。

- [ ] **Step 3: 实现受保护的 Supabase Storage 中转**

创建 `POST /api/cloud-audio/uploads`（返回对象键与一次性上传 URL）、`POST /api/cloud-audio/transcriptions`（以任务编号创建 DashScope 非实时任务）和 `GET /api/cloud-audio/transcriptions/{id}`。对象键必须以 `user_id` 为前缀，且只接受创建者自己的任务。服务端使用 `SUPABASE_SERVICE_ROLE_KEY` 生成签名 URL；前端不得收到服务角色密钥或 DashScope 密钥。

- [ ] **Step 4: 修改前端录音结束流程**

```ts
const blob = await stopMediaRecorder();
const upload = await createAudioUpload(blob.type);
await fetch(upload.uploadUrl, { method: "PUT", body: blob, headers: { "content-type": blob.type } });
const task = await createTranscription({ objectKey: upload.objectKey });
await pollTranscription(task.id);
```

移除 `new WebSocket(...)`、实时 PCM 发送和自动重连。转写完成后将完整文本写回现有 Zustand 状态；UI 显示“正在转写”而不显示实时中间文本。

- [ ] **Step 5: 运行 API 与前端测试**

Run: `uv run pytest tests/test_cloud_audio_router.py -q && lifetrace-frontend/node_modules/.bin/biome check lifetrace-frontend/lib/store/audio-recording-store.ts lifetrace-frontend/apps/audio/AudioPanel.tsx`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add lifetrace/routers/cloud_audio.py lifetrace/schemas/cloud_audio.py lifetrace/storage/models.py lifetrace/vercel_app.py lifetrace-frontend/lib/store/audio-recording-store.ts tests/test_cloud_audio_router.py
git commit -m "Transcribe completed recordings in the cloud"
```

### Task 5: 验证 Vercel 部署产物与配置说明

**Files:**
- Create: `docs/vercel-cloud-deployment.md`
- Modify: `lifetrace-frontend/next.config.ts`
- Test: `tests/test_vercel_app.py`

- [ ] **Step 1: 写出部署配置的失败测试**

```python
def test_vercel_config_has_a_python_api_entrypoint():
    config = json.loads(Path("vercel.json").read_text())
    assert config["functions"]["api/index.py"]["runtime"] == "python3.12"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_vercel_app.py::test_vercel_config_has_a_python_api_entrypoint -q`

Expected: FAIL，直到部署配置固定 Python 入口。

- [ ] **Step 3: 固化同域 API 与部署指引**

部署文档明确列出两个 Vercel 项目：后端项目根目录为仓库根目录，前端项目根目录为 `lifetrace-frontend`；前端将 `NEXT_PUBLIC_API_URL` 设置为后端 Vercel URL。文档也列出 Neon、Supabase Storage 和 DashScope 的环境变量，以及必须先对 Neon 执行的 `uv run python scripts/bootstrap_neon.py`。

- [ ] **Step 4: 运行完整验证**

Run: `uv run pytest tests/test_auth_service.py tests/test_auth_router.py tests/test_user_isolation.py tests/test_sync_service.py tests/test_sync_router.py tests/test_postgres_vector_db.py tests/test_cloud_audio_router.py tests/test_vercel_app.py -q`

Run: `lifetrace-frontend/node_modules/.bin/tsc -p lifetrace-frontend/tsconfig.json --noEmit`

Run: `cd lifetrace-frontend && NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build`

Expected: 所有测试、类型检查和前端生产构建通过。

- [ ] **Step 5: 提交**

```bash
git add docs/vercel-cloud-deployment.md vercel.json tests/test_vercel_app.py
git commit -m "Document the serverless cloud deployment"
```

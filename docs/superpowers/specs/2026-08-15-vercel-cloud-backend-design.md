# LifeTrace Vercel 云端精简后端设计

## 目标

将网页/PWA 实际使用的后端能力部署到 Vercel：保留账户、核心数据、离线同步、云端 LLM、云端 RAG 与录音结束后转写；移除仅属于桌面端或常驻进程的能力。

## 范围

保留的路由域：`auth`、`health`、`sync`、`todo`、`journal`、`habit`、`project`、`collection`、`note_link`、`chat`、`todo_extraction`、`zero_think`、`vector`、`rag`，以及新的非实时音频转写 API。

不在云端注册的路由域：`activity`、`search`、`screenshot`、`event`、`scheduler`、`automation`、`floating_capture`、本机音频 WebSocket 及其它依赖本地磁盘、桌面权限或常驻任务的功能。

## 架构

Vercel 使用独立的 FastAPI 入口加载云端模块集合。入口不启动任务调度器，也不启动本地采集或延迟注册线程。Vercel 的重写规则将前端 `/api/*` 指向同一部署中的 Python API，避免浏览器跨域调用。

数据库继续使用 Neon PostgreSQL。现有 `User`、业务表及同步表继续按 `user_id` 隔离。新的迁移启用 `pgvector`，创建用户隔离的笔记向量表；向量由已有 SiliconFlow Embedding API 生成，索引和检索都在 Neon 完成。

## 离线与 RAG

PWA 仍先写 IndexedDB，再在联网后用现有 push/pull 协议同步。同步服务已通过 `JournalService` 写入日记，云端版将同步后的创建、更新、删除同步到 pgvector 索引。离线期间可继续创建与编辑数据；云端 RAG、LLM 和语音转写在恢复网络且同步完成后可用。语义搜索始终以已同步的云端数据为准。

## 语音转写

移除浏览器到后端的实时 WebSocket 转写与本机 WAV 持久化。新增“上传后转写”流程：

1. 浏览器请求受登录保护的短期上传凭据。
2. 浏览器将完成录制的音频直接上传至 Supabase Storage 的私有 `audio-staging` 桶，避免通过 Vercel Function 传送大文件。
3. 浏览器请求 Vercel API 启动转写；API 为该对象生成短期下载 URL，调用 DashScope 非实时 ASR 任务。
4. 前端轮询受登录保护的任务状态；成功后 API 返回完整文本并删除中转文件。失败时保留失败状态及可重试任务，过期中转文件由用户下一次请求或管理清理接口删除。

Supabase 仅承担短期音频对象存储，不用于数据库或身份认证。所需环境变量为 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 和 `DASHSCOPE_API_KEY`。

## Vercel 部署

云端 Python 依赖单独列在 `requirements-vercel.txt`，不包含 ChromaDB、OCR、ONNX、SciPy、HDBSCAN、桌面 SDK 或 WebSocket 服务端依赖。`pyproject.toml` 提供 Vercel 入口配置，`vercel.json` 将 Python API 与 Next.js 前端放到同一项目。部署环境还需要 `DATABASE_URL`、`JWT_SECRET_KEY`、`SILICONFLOW_API_KEY`、LLM 配置、上述 Supabase 与 DashScope 密钥，以及生产站点的 `CORS_ORIGINS`。

## 错误处理与安全

所有云端数据路由继续要求 Bearer Token。RAG 的向量行带 `user_id`，查询必须在 SQL 层过滤该字段。上传凭据、转写任务和结果仅允许创建者访问；Supabase service-role key 仅在 Vercel 后端使用。ASR、Embedding 或 LLM 的上游错误以可读的 502/503 响应返回，且不得把密钥写入日志或响应。

## 验收

1. Vercel 构建能在不安装本机功能依赖的条件下完成。
2. 注册、登录、待办、日记、习惯、项目与离线同步通过同域 API 工作，且两用户互相不可读取数据。
3. 离线创建日记后，联网同步可进入 pgvector；RAG 只返回当前用户的相似日记。
4. 录音结束后可直接上传、创建转写任务、获得完整文字；实时逐字显示不提供。
5. 受限模块不会被云端入口导入或注册。

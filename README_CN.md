# LifeTrace - AI 驱动的智能生活追踪与管理平台

![GitHub stars](https://img.shields.io/github/stars/madmonkey007/GTD?style=social) ![GitHub forks](https://img.shields.io/github/forks/madmonkey007/GTD?style=social) ![GitHub issues](https://img.shields.io/github/issues/madmonkey007/GTD) [![License](https://img.shields.io/badge/license-FreeU%20Community-blue.svg)](LICENSE) ![Python version](https://img.shields.io/badge/python-3.12-blue.svg) ![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)

**语言**: [English](README.md) | [中文](README_CN.md)

## 📖 项目概述

**LifeTrace** 是一款 AI 驱动的智能生活追踪与管理平台，帮助您高效管理任务、追踪习惯、记录日常活动、提升生产力。通过对话式 AI 交互、屏幕活动追踪和智能任务提取，LifeTrace 将您的数字生活转化为可执行的洞察。

## ✨ 功能亮点

### 🤖 AI 智能功能
- **屏幕活动追踪** - 自动截图 + OCR 识别屏幕内容分析
- **智能日记生成** - 基于活动记录自动生成每日日记摘要
- **RAG 知识问答** - 基于向量数据库的智能检索与问答
- **LLM Agent** - 多工具 AI 助手，支持联网搜索、上下文对话
- **智能任务提取** - 从文本/屏幕自动提取待办事项
- **语音转文字** - ASR 语音识别转文字

### ✅ 任务管理
- **层级任务** - 支持父子任务关系，无限层级嵌套
- **优先级与状态** - 四级优先级（紧急/高/中/低）和多种状态
- **标签与分类** - 使用自定义标签组织待办，便于筛选
- **截止日期管理** - 设置截止日期，可视化提醒
- **时间分配** - 跟踪任务耗时

### 📅 生活管理工具
- **事件日历** - 日/周/月视图，支持拖拽排期
- **日记系统** - 富文本日记编辑，标签管理，情绪追踪
- **习惯追踪** - 习惯打卡，统计数据
- **番茄钟** - 专注计时，生产力图表
- **四象限** - 艾森豪威尔矩阵任务优先级管理
- **活动日志** - 时间线式活动记录浏览
- **通知系统** - 智能提醒与警报

### 🎨 现代化用户界面
- **多面板布局** - 可自定义的面板排列
- **深色/浅色主题** - 精美主题，多种配色方案
- **国际化支持** - 完整支持中英文
- **响应式设计** - 适配各种屏幕尺寸
- **桌面应用** - 支持 Electron & Tauri (Windows & macOS)

## 🏗️ 系统架构

LifeTrace 采用**前后端分离**架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                      前端 (Next.js)                              │
│  React 19 + TypeScript + Tailwind CSS 4 + Zustand + TipTap     │
├─────────────────────────────────────────────────────────────────┤
│                      后端 (FastAPI)                              │
│  Python 3.12 + SQLModel + Alembic + WebSocket                   │
├─────────────────────────────────────────────────────────────────┤
│                      AI/LLM 服务                                 │
│  OpenAI API + DashScope + Agno + ChromaDB + RapidOCR            │
├─────────────────────────────────────────────────────────────────┤
│                      数据存储                                    │
│  SQLite + ChromaDB (向量数据库) + 本地文件存储                    │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16.1.6, React 19, TypeScript, Tailwind CSS 4, Zustand, TipTap, DnD Kit, Recharts, Framer Motion, next-intl |
| **后端** | Python 3.12, FastAPI, Uvicorn, SQLModel, Alembic, WebSocket |
| **AI/LLM** | OpenAI API, DashScope, Agno, ChromaDB, RapidOCR-ONNXruntime |
| **任务调度** | APScheduler |
| **桌面应用** | Electron, Tauri |

## 🚀 快速开始

### 环境要求

**后端：**
- Python 3.12
- 支持的操作系统：Windows、macOS、Linux
- 可选：CUDA 支持（用于 GPU 加速）

**前端：**
- Node.js 20+
- pnpm 包管理器

### 安装依赖

本项目使用 [uv](https://github.com/astral-sh/uv) 进行快速可靠的依赖管理。

**安装 uv：**

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**安装依赖并同步环境：**

```bash
# 从 pyproject.toml 和 uv.lock 同步依赖
uv sync

# 激活虚拟环境
# macOS/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

### 启动后端服务

> **注意**：首次运行时，如果 `config.yaml` 不存在，系统会自动从 `default_config.yaml` 创建。

**启动服务器：**

```bash
python -m lifetrace.server
```

后端服务会自动从 `8001` 端口开始查找可用端口。如果默认端口被占用，会自动使用下一个可用端口。

- **默认后端端口**：`http://localhost:8001`
- **API 文档**：`http://localhost:8001/docs`

### 启动前端服务

```bash
cd free-todo-frontend

pnpm install
pnpm dev
```

前端开发服务器会：
- 自动从 `3001` 端口开始查找可用端口
- 通过检查 `/health` 端点自动检测后端端口
- 自动设置 API 代理

服务启动后，在浏览器中访问 `http://localhost:3001` 开始使用 LifeTrace！🎉

## 📋 项目结构

```
├── lifetrace/                  # 后端模块 (FastAPI)
│   ├── server.py               # Web API 服务入口
│   ├── config/                 # 配置文件
│   │   ├── config.yaml         # 主配置文件（自动生成）
│   │   ├── default_config.yaml # 默认配置模板
│   │   ├── prompt.yaml         # AI 提示词模板
│   │   └── rapidocr_config.yaml# OCR 配置
│   ├── routers/                # API 路由处理器（29 个端点）
│   ├── schemas/                # Pydantic 数据模型
│   ├── services/               # 业务逻辑服务层
│   ├── repositories/           # 数据访问层
│   ├── storage/                # 数据存储层
│   ├── llm/                    # LLM 和 AI 服务（28 个模块）
│   ├── jobs/                   # 后台任务
│   ├── util/                   # 工具函数
│   └── data/                   # 运行时数据（自动生成）
├── free-todo-frontend/         # 前端应用 (Next.js)
│   ├── app/                    # Next.js 应用目录
│   ├── apps/                   # 功能模块
│   ├── components/             # React 组件
│   ├── lib/                    # 工具和服务
│   └── electron/               # Electron 桌面应用
├── pyproject.toml              # Python 项目配置
├── uv.lock                     # uv 锁定文件
├── LICENSE                     # 许可证文件
├── README.md                   # 英文 README
└── README_CN.md                # 中文 README（本文件）
```

## 📡 API 路由

LifeTrace 提供 29 个后端 API 路由：

| 类别 | 路由 |
|------|------|
| **核心功能** | activity, chat, todo, event, journal, logs |
| **AI/OCR** | ocr, proactive_ocr, rag, vision, search |
| **智能服务** | todo_extraction, vector, system |
| **通信** | audio_ws, audio |
| **任务调度** | scheduler, automation |
| **媒体处理** | screenshot, floating_capture |
| **工具服务** | config, cost_tracking, health, notification, time_allocation |

## 🛠️ 开发指南

### Git Hooks（Pre-commit）

```bash
# macOS/Linux
bash scripts/setup_hooks_here.sh

# Windows（PowerShell）
powershell -ExecutionPolicy Bypass -File scripts/setup_hooks_here.ps1
```

### 后端开发

```bash
# 使用自动重载运行
uv run python -m lifetrace.server

# 运行测试
uv run pytest
```

### 前端开发

```bash
cd free-todo-frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

## 🐳 部署方式

### 本地开发

```bash
# 后端
uv sync
uv run python -m lifetrace.server

# 前端
cd free-todo-frontend
pnpm install && pnpm dev
```

### Docker 部署

```bash
docker-compose up -d
```

### 桌面应用

```bash
# Electron
cd free-todo-frontend
pnpm electron:build

# Tauri
pnpm tauri:build
```

## 🤝 贡献指南

我们欢迎所有对 LifeTrace 社区的贡献！

### 快速开始

1. **🍴 Fork 项目** - 创建您自己的仓库副本
2. **🌿 创建功能分支** - `git checkout -b feature/amazing-feature`
3. **💾 提交您的更改** - `git commit -m 'feat: 添加某个很棒的功能'`
4. **📤 推送到分支** - `git push origin feature/amazing-feature`
5. **🔄 创建 Pull Request** - 提交您的更改以供审核

### 贡献规范

- **[后端开发规范](.github/BACKEND_GUIDELINES.md)** - Python/FastAPI 编码规范
- **[前端开发规范](.github/FRONTEND_GUIDELINES.md)** - TypeScript/React 编码规范

## 📚 文档

详细文档请访问：[https://deepwiki.com/madmonkey007/GTD](https://deepwiki.com/madmonkey007/GTD)

## ⭐ Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=madmonkey007/GTD&type=Timeline)](https://www.star-history.com/#madmonkey007/GTD&Timeline)

## 📄 许可证

版权所有 © 2026 FreeU.org

LifeTrace 采用 **FreeU Community License** 许可证，该许可证基于 Apache License 2.0，并附加了关于商业使用的条件。

有关详细的许可证条款，请参阅 [LICENSE](LICENSE) 文件。

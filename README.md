# LifeTrace - AI-Powered Smart Life Tracking & Management Platform

![GitHub stars](https://img.shields.io/github/stars/madmonkey007/GTD?style=social) ![GitHub forks](https://img.shields.io/github/forks/madmonkey007/GTD?style=social) ![GitHub issues](https://img.shields.io/github/issues/madmonkey007/GTD) [![License](https://img.shields.io/badge/license-FreeU%20Community-blue.svg)](LICENSE) ![Python version](https://img.shields.io/badge/python-3.12-blue.svg) ![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)

**Language**: [English](README.md) | [中文](README_CN.md)

## 📖 Project Overview

**LifeTrace** is an AI-driven intelligent life tracking and management platform that helps you efficiently manage tasks, track habits, record daily activities, and boost productivity. Through conversational AI interaction, screen activity tracking, and smart task extraction, LifeTrace transforms your digital life into actionable insights.

## ✨ Key Features

### 🤖 AI Smart Features
- **Screen Activity Tracking** - Automatic screenshot capture with OCR recognition for screen content analysis
- **Intelligent Journal Generation** - Auto-generate daily journal summaries based on activity records
- **RAG Knowledge Q&A** - Smart retrieval and question answering based on vector database
- **LLM Agent** - Multi-tool AI assistant supporting web search, context-aware conversations
- **Smart Task Extraction** - Automatically extract todos from text and screen content
- **Voice-to-Text** - ASR speech recognition for voice input

### ✅ Task Management
- **Hierarchical Tasks** - Support parent-child task relationships with unlimited nesting
- **Priority & Status** - Four priority levels (urgent/high/medium/low) and multiple status states
- **Tags & Categories** - Organize todos with custom tags for easy filtering
- **Deadline Management** - Set deadlines with visual reminders
- **Time Allocation** - Track time spent on tasks

### 📅 Life Management Tools
- **Event Calendar** - Day/Week/Month views with drag-and-drop scheduling
- **Diary System** - Rich text diary editing with tags and mood tracking
- **Habit Tracker** - Habit check-in with statistical analysis
- **Pomodoro Timer** - Focus timer with productivity charts
- **Eisenhower Matrix** - Four-quadrant task priority management
- **Activity Log** - Timeline-style activity record browsing
- **Notification System** - Smart reminders and alerts

### 🎨 Modern User Interface
- **Multi-Panel Layout** - Customizable panel arrangement
- **Dark/Light Themes** - Beautiful themes with multiple color schemes
- **Internationalization** - Full support for English and Chinese
- **Responsive Design** - Optimized for various screen sizes
- **Desktop Application** - Electron & Tauri support for Windows & macOS

## 🏗️ System Architecture

LifeTrace adopts a **frontend-backend separation** architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  React 19 + TypeScript + Tailwind CSS 4 + Zustand + TipTap     │
├─────────────────────────────────────────────────────────────────┤
│                         Backend (FastAPI)                        │
│  Python 3.12 + SQLModel + Alembic + WebSocket                   │
├─────────────────────────────────────────────────────────────────┤
│                        AI/LLM Services                           │
│  OpenAI API + DashScope + Agno + ChromaDB + RapidOCR            │
├─────────────────────────────────────────────────────────────────┤
│                        Data Storage                              │
│  SQLite + ChromaDB (Vector DB) + Local File Storage             │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.1.6, React 19, TypeScript, Tailwind CSS 4, Zustand, TipTap, DnD Kit, Recharts, Framer Motion, next-intl |
| **Backend** | Python 3.12, FastAPI, Uvicorn, SQLModel, Alembic, WebSocket |
| **AI/LLM** | OpenAI API, DashScope, Agno, ChromaDB, RapidOCR-ONNXruntime |
| **Scheduling** | APScheduler |
| **Desktop** | Electron, Tauri |

## 🚀 Quick Start

### Prerequisites

**Backend:**
- Python 3.12
- Supported OS: Windows, macOS, Linux
- Optional: CUDA support (for GPU acceleration)

**Frontend:**
- Node.js 20+
- pnpm package manager

### Install Dependencies

This project uses [uv](https://github.com/astral-sh/uv) for fast and reliable dependency management.

**Install uv:**

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Install dependencies and sync environment:**

```bash
# Sync dependencies from pyproject.toml and uv.lock
uv sync

# Activate the virtual environment
# macOS/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

### Start the Backend Service

> **Note**: On first run, the system will automatically create `config.yaml` from `default_config.yaml` if it doesn't exist.

**Start the server:**

```bash
python -m lifetrace.server
```

The backend service will automatically find an available port starting from `8001`. If the default port is occupied, it will automatically use the next available port.

- **Default Backend Port**: `http://localhost:8001`
- **API Documentation**: `http://localhost:8001/docs`

### Start the Frontend Service

```bash
cd free-todo-frontend

pnpm install
pnpm dev
```

The frontend development server will:
- Automatically find an available port starting from `3001`
- Automatically detect the running backend port by checking the `/health` endpoint
- Set up API proxy to the detected backend port

Once both services are running, open your browser and navigate to `http://localhost:3001` to enjoy LifeTrace! 🎉

## 📋 Project Structure

```
├── lifetrace/                  # Backend modules (FastAPI)
│   ├── server.py               # Web API service entry point
│   ├── config/                 # Configuration files
│   │   ├── config.yaml         # Main configuration (auto-generated)
│   │   ├── default_config.yaml # Default configuration template
│   │   ├── prompt.yaml         # AI prompt templates
│   │   └── rapidocr_config.yaml# OCR configuration
│   ├── routers/                # API route handlers (29 endpoints)
│   ├── schemas/                # Pydantic data models
│   ├── services/               # Business logic service layer
│   ├── repositories/           # Data access layer
│   ├── storage/                # Data storage layer
│   ├── llm/                    # LLM and AI services (28 modules)
│   ├── jobs/                   # Background jobs
│   ├── util/                   # Utility functions
│   └── data/                   # Runtime data (generated)
├── free-todo-frontend/         # Frontend application (Next.js)
│   ├── app/                    # Next.js app directory
│   ├── apps/                   # Feature modules
│   ├── components/             # React components
│   ├── lib/                    # Utilities and services
│   └── electron/               # Electron desktop app
├── pyproject.toml              # Python project configuration
├── uv.lock                     # uv lock file
├── LICENSE                     # License file
├── README.md                   # This file (English)
└── README_CN.md                # Chinese README
```

## 📡 API Routes

LifeTrace provides 29 backend API routes:

| Category | Routes |
|----------|--------|
| **Core** | activity, chat, todo, event, journal, logs |
| **AI/OCR** | ocr, proactive_ocr, rag, vision, search |
| **Intelligence** | todo_extraction, vector, system |
| **Communication** | audio_ws, audio |
| **Scheduling** | scheduler, automation |
| **Media** | screenshot, floating_capture |
| **Utilities** | config, cost_tracking, health, notification, time_allocation |

## 🛠️ Development Guide

### Git Hooks (Pre-commit)

```bash
# macOS/Linux
bash scripts/setup_hooks_here.sh

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts/setup_hooks_here.ps1
```

### Backend Development

```bash
# Run with auto-reload
uv run python -m lifetrace.server

# Run tests
uv run pytest
```

### Frontend Development

```bash
cd free-todo-frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## 🐳 Deployment

### Local Development

```bash
# Backend
uv sync
uv run python -m lifetrace.server

# Frontend
cd free-todo-frontend
pnpm install && pnpm dev
```

### Docker

```bash
docker-compose up -d
```

### Desktop Application

```bash
# Electron
cd free-todo-frontend
pnpm electron:build

# Tauri
pnpm tauri:build
```

## 🤝 Contributing

We welcome all contributions to the LifeTrace community!

### Quick Start

1. **🍴 Fork the project** - Create your own copy
2. **🌿 Create a feature branch** - `git checkout -b feature/amazing-feature`
3. **💾 Commit your changes** - `git commit -m 'feat: add some amazing feature'`
4. **📤 Push to the branch** - `git push origin feature/amazing-feature`
5. **🔄 Create a Pull Request** - Submit for review

### Contributing Guidelines

- **[Backend Guidelines](.github/BACKEND_GUIDELINES.md)** - Python/FastAPI coding standards
- **[Frontend Guidelines](.github/FRONTEND_GUIDELINES.md)** - TypeScript/React coding standards

## 📚 Documentation

For detailed documentation, please visit: [https://deepwiki.com/madmonkey007/GTD](https://deepwiki.com/madmonkey007/GTD)

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=madmonkey007/GTD&type=Timeline)](https://www.star-history.com/#madmonkey007/GTD&Timeline)

## 📄 License

Copyright © 2026 FreeU.org

LifeTrace is licensed under the **FreeU Community License**, which is based on Apache License 2.0 with additional conditions regarding commercial usage.

For detailed license terms, please see the [LICENSE](LICENSE) file.

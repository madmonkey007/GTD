# LifeTrace 项目交接文档

## 项目概述

LifeTrace（原名 FreeTodo/GTD）是一个 AI 驱动的智能生活追踪平台。

| 项目信息 | 详情 |
|---------|------|
| GitHub 仓库 | https://github.com/madmonkey007/GTD |
| 后端框架 | FastAPI (Python 3.12)，端口 8001，使用 uv 管理 `.venv` 虚拟环境 |
| 前端框架 | Next.js 16 + React 19 + TypeScript + Tailwind CSS，端口 3001 |
| 数据库 | SQLite，路径 `D:\manus\GTD\lifetrace\data\lifetrace.db` |
| pnpm 路径 | `C:\Users\EDY\AppData\Roaming\npm\pnpm.cmd` |
| gh CLI 路径 | `C:\Users\EDY\AppData\Local\Temp\gh\bin\gh.exe` |

### 启动命令

```bash
# 后端（在 D:\manus\GTD 目录下）
cd lifetrace
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8001

# 前端（在 D:\manus\GTD 目录下）
cd lifetrace-frontend
pnpm exec next dev -p 3001
```

---

## 会话工作记录

### 1. GitHub 设置（已完成）

- 在 madmonkey007/GTD 创建仓库
- 配置 main 分支保护规则
- 完成所有品牌替换：FreeTodo → LifeTrace（共 128 处，涉及 18 个文件）
- 目录重命名：`free-todo-frontend` → `lifetrace-frontend`
- 重新整理 git 历史（单次提交，单个贡献者）

### 2. Bug 修复（已完成）

#### 2.1 后端 500 错误
- **文件**：`lifetrace/schemas/todo.py`
- **问题**：文件存在语法错误（损坏的中文字符），导致后端启动失败返回 500
- **修复**：清理损坏字符

#### 2.2 Service Worker 和 Manifest 缓存名
- **文件**：`sw.js`、`manifest.json`
- **修复**：
  - `sw.js`：缓存名从 `freetodo-v1` 改为 `lifetrace-v1`
  - `manifest.json`：应用名从 `GTD` 改为 `LifeTrace`

### 3. 日记视图"添加到对话"聊天按钮修复（进行中）

#### 问题描述
点击笔记卡片上的"添加到对话"按钮无任何响应。

#### 根因分析

这是一个架构层面的问题：

1. **日记视图使用独立的面板系统**：日记视图使用 `DiaryPanel` 组件，完全替代了常规的面板系统（PanelA/B/C）
2. **代码尝试操作不存在的面板**：原代码调用 `setPanelFeature("panelB", "chat")`，但日记视图中 panelB 根本不存在
3. **PanelRegion 渲染逻辑**：在 `PanelRegion.tsx` 第 421 行，当 `activeView === "diary"` 时渲染 `<DiaryPanel />`，完全替换了面板系统

#### 关键架构信息

| 配置项 | 值 |
|--------|-----|
| PanelC 渲染阈值 | `PANEL_TRIPLE_THRESHOLD = 1200px`（容器宽度 >= 1200px 时才显示） |
| 默认面板布局 | panelA: "todos", panelB: "todoDetail", panelC: "chat" |
| 状态管理 | Zustand store（持久化到 localStorage） |
| 面板锁定机制 | `panelPinMap` 可能阻止 `setPanelFeature`，需先调用 `setPanelPinned(false)` |

#### 已应用的修复

在 `DiaryEditor.tsx` 第 1138-1141 行：

```tsx
// 切换到列表视图（使用面板系统），然后在 panelB 中打开聊天
useUiStore.getState().setActiveView("list");
requestAnimationFrame(() => {
    useUiStore.getState().setPanelPinned("panelB", false);
    setPanelFeature("panelB", "chat");
    if (!useUiStore.getState().isPanelBOpen) useUiStore.getState().togglePanelB();
});
```

#### 当前状态

代码修复已应用，但 `setActiveView("list")` 在测试中未能视觉上切换视图。React 状态变更可能没有正确触发 `PanelRegion` 组件的重新渲染。

**待进一步调查**：
- React 状态变更后 `PanelRegion` 的重新渲染机制
- 可能需要使用路由导航或添加加载状态触发器
- 替代方案：在日记视图中直接嵌入聊天面板，而不是切换视图

#### 相关文件

| 文件 | 说明 |
|------|------|
| `lifetrace-frontend/apps/diary/DiaryEditor.tsx` | 聊天按钮 onClick 处理（第 1128-1148 行） |
| `lifetrace-frontend/components/layout/PanelRegion.tsx` | 面板渲染逻辑 |
| `lifetrace-frontend/lib/store/ui-store/store.ts` | `setPanelFeature`、`panelPinMap` 检查逻辑 |
| `lifetrace-frontend/apps/todo-list/hooks/useTodoCardHandlers.ts` | 参考实现（`ensureChatPanelOpen` 已正常工作） |

### 4. 日记日期 Bug 修复（已完成）

#### 问题描述
今天创建的笔记在日记视图中"today"计数显示为 0。

#### 根因分析

`DiaryPanel.tsx` 中 `buildSavePayload()` 第 299 行使用 `formatDateInput(updatedDraft.date)`，其中 `draft.date` 来自 `emptyDraft(selectedDate)`。当用户正在查看其他日期（如 7 月 13 日）时创建新笔记，日期会被设置为查看的日期而不是今天。

#### 修复方案

在 `DiaryPanel.tsx` 中：

- **第 299 行**：新条目使用当前日期
  ```tsx
  date: updatedDraft.id ? formatDateInput(updatedDraft.date) : formatDateInput(new Date())
  ```
- **第 305-307 行**：`day_bucket_start` 也使用 `new Date()` 重新计算

#### 数据修复

运行 Python 脚本修正了 SQLite 中 5 条记录（ID: 72, 100, 129, 130, 131），这些记录的名称日期与存储日期不匹配。

### 5. 其他已构建功能

| 功能 | 文件 | 说明 |
|------|------|------|
| 骨架屏加载组件 | `components/ui/skeleton.tsx` | 通用骨架屏组件 |
| 日记笔记骨架屏 | `DiaryEditor.tsx` | 加载时显示骨架屏替代"暂无笔记" |
| 笔记聊天 Store | `lib/store/note-chat-store.ts` | Zustand store，管理关联笔记 |
| 关联笔记组件 | `apps/chat/components/input/LinkedNotes.tsx` | 药丸样式，支持 X 移除 |
| 笔记卡片聊天按钮 | `DiaryEditor.tsx` | 悬停显示 |
| 消息构建器笔记上下文 | `apps/chat/utils/messageBuilder.ts` | 支持笔记上下文 |

### 6. 零秒思考功能（阶段一已完成）

基于赤羽雄二「零秒自问思考法」的数字化训练工具。侧边栏新增「零秒思考」入口。

#### 核心规则
- 每日 10 题，每题 1 分钟计时
- 问题必须是疑问句（含？）
- 每题 4-6 条简短答案
- 超时自动锁定，不可修改
- 碎片化/批量两种模式

#### 已完成文件

**前端（`lifetrace-frontend/apps/zero-think/`）**：

| 文件 | 说明 |
|------|------|
| `index.ts` | 导出入口 |
| `ZeroThinkPanel.tsx` | 主面板（idle/question/answering/completed 四阶段） |
| `ZeroThinkTimer.tsx` | SVG 圆形倒计时（<10秒红色闪烁） |
| `ZeroThinkProgress.tsx` | 分段进度条（X/10） |
| `ZeroThinkQuestionCard.tsx` | 答题卡片（问题+答案+计时器） |
| `types.ts` | 类型定义 |
| `constants.ts` | 常量（10题/60秒/4-6条） |
| `question-bank.ts` | 灵感题库（6类×5题=30题） |
| `components/QuestionInput.tsx` | 疑问句输入（自动补？） |
| `components/AnswerInput.tsx` | 4-6行答案输入 |
| `components/InspirationBank.tsx` | 灵感题库抽屉（6分类） |
| `components/LockedCard.tsx` | 锁定后只读卡片 |
| `components/ModeSelector.tsx` | 碎片化/批量模式选择 |
| `hooks/useZeroThinkTimer.ts` | 计时器逻辑（含页面可见性处理） |
| `hooks/useZeroThinkSession.ts` | 会话管理（10题循环+验证） |
| `lib/store/zero-think-store/store.ts` | Zustand store（模式+引导状态） |

**前端修改**：
- `lib/store/ui-store/types.ts` — SidebarView 添加 `"zeroThink"`
- `components/layout/PanelRegion.tsx` — 导航项 + 渲染条件
- `lib/i18n/messages/zh.json` + `en.json` — 国际化标签

**后端（`lifetrace/`）**：

| 文件 | 说明 |
|------|------|
| `storage/models.py` | ZeroThinkCard 数据模型 |
| `schemas/zero_think.py` | Pydantic 验证模型（疑问句校验+答案数量校验） |
| `storage/zero_think_manager.py` | CRUD 操作 |
| `routers/zero_think.py` | REST API 路由 |

**后端 API 端点**：
```
POST   /api/zero-think/card          → 创建卡片
GET    /api/zero-think/cards?date=   → 获取某日卡片
GET    /api/zero-think/stats         → 统计数据（连续天数等）
POST   /api/zero-think/{card_id}/lock → 锁定卡片
DELETE /api/zero-think/{card_id}     → 删除卡片
```

---

## 已知问题 / 待办事项

### 1. 日记视图聊天按钮（需要继续修复）

**优先级**：高

**问题**：`setActiveView("list")` 调用未能触发面板系统的视觉重新渲染。

**可能的解决方案**：
1. 使用路由导航（如 `router.push`）而不是 Zustand 状态切换
2. 在日记视图中添加加载状态触发器，强制重新渲染
3. 在日记视图中直接嵌入聊天面板（推荐方案，避免视图切换的复杂性）
4. 检查 `PanelRegion` 组件的 `useEffect` 依赖项，确保正确响应 `activeView` 变化

**参考实现**：`apps/todo-list/hooks/useTodoCardHandlers.ts` 中的 `ensureChatPanelOpen` 函数已正常工作，可作为参考。

### 2. 其他潜在问题

- 确认所有 API 端点在前后端的品牌替换后仍正常工作
- 检查 Service Worker 更新后旧缓存的清理逻辑
- 验证 SQLite 数据库的迁移脚本（如果有）

---

## 文件结构关键点

```
D:\manus\GTD\
├── lifetrace/                        # Python 后端
│   ├── app/                          # FastAPI 应用主目录
│   ├── routers/                      # API 路由
│   ├── services/                     # 业务逻辑层
│   ├── storage/                      # SQLAlchemy 模型和管理器
│   │   ├── models.py                 # Journal、Todo、Chat 数据模型
│   │   └── journal_manager.py        # CRUD 操作
│   ├── schemas/                      # Pydantic 数据验证模型
│   │   └── todo.py                   # ⚠️ 已修复语法错误
│   ├── util/                         # 工具函数（时间、路径等）
│   └── data/
│       └── lifetrace.db              # SQLite 数据库文件
│
├── lifetrace-frontend/               # Next.js 前端
│   ├── app/                          # Next.js App Router 目录
│   ├── apps/                         # 功能模块
│   │   ├── diary/                    # 日记功能模块
│   │   │   ├── DiaryPanel.tsx        # 日记主面板（处理布局，第299行已修复日期）
│   │   │   ├── DiaryEditor.tsx       # 笔记编辑器（含聊天按钮，第1138行已修复）
│   │   │   └── journal-utils.ts      # 日期格式化工具
│   │   ├── chat/                     # AI 聊天功能
│   │   │   ├── components/input/LinkedNotes.tsx  # 关联笔记组件
│   │   │   └── utils/messageBuilder.ts          # 消息构建器
│   │   └── todo-list/                # 待办事项功能
│   │       └── hooks/useTodoCardHandlers.ts      # 聊天面板打开参考实现
│   ├── components/                   # 共享组件
│   │   ├── layout/PanelRegion.tsx    # 面板区域（核心布局组件）
│   │   └── ui/skeleton.tsx           # 骨架屏组件
│   └── lib/store/                    # Zustand 状态管理
│       ├── ui-store/store.ts         # 面板管理状态
│       └── note-chat-store.ts        # 关联笔记状态
│
├── .github/                          # GitHub 配置
│   └── workflows/                    # CI/CD 工作流
│
└── handover.md                       # 本文档
```

---

## 开发注意事项

### 1. 品牌一致性

所有代码中已将 FreeTodo/GTD 替换为 LifeTrace。如果发现遗漏，请及时修正。

### 2. 面板系统架构

- **常规视图**（列表、看板等）：使用 PanelRegion 管理 PanelA/B/C
- **日记视图**：使用 DiaryPanel 完全替代面板系统
- 切换视图时要注意面板状态的清理和恢复

### 3. 状态管理

- 所有面板状态通过 `useUiStore`（Zustand）管理，持久化到 localStorage
- `panelPinMap` 控制面板锁定状态，修改面板功能前需检查
- 笔记关联状态通过 `note-chat-store.ts` 管理

### 4. 数据库

- SQLite 数据库文件位于 `lifetrace/data/lifetrace.db`
- 修改数据库结构时需要同步更新 `storage/models.py` 和 `schemas/` 下的 Pydantic 模型
- 数据修复脚本应保留记录，以便审计

### 5. 前端开发

- 使用 pnpm 管理依赖，不要使用 npm
- Next.js App Router 目录结构，注意 `app/` 和 `apps/` 的区别
- Tailwind CSS 用于样式，组件库包括 shadcn/ui
- 组件文件使用 `.tsx` 扩展名

---

## 下次开发建议

### 高优先级

1. **修复日记视图聊天按钮**：推荐在 DiaryPanel 中直接嵌入聊天面板，避免视图切换的复杂性
2. **验证所有 API 端点**：确保品牌替换后所有接口正常工作

### 中优先级

3. **优化骨架屏加载**：确保所有列表页面都有加载状态
4. **清理 localStorage**：Service Worker 更新后旧缓存可能影响用户体验

### 低优先级

5. **添加单元测试**：目前项目缺少测试覆盖
6. **文档完善**：API 文档（Swagger 已自动生成，但缺少使用指南）

---

*本文档最后更新：2026年7月*

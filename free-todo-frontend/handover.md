# Handover 文档 — LifeTrace 前端

**日期**: 2026-07-09（更新于 2026-07-09）
**分支**: 当前在 main 分支，有大量未提交修改
**项目路径**: `D:\manus\GTD\free-todo-frontend`
**运行端口**: `http://localhost:3001`（后端在 8001）

---

## 项目速览

LifeTrace（品牌名 GTD）是一个 GTD 理念驱动的待办与笔记管理应用。前端 Next.js 16 + Turbopack + pnpm，后端 FastAPI + SQLite（`glm-4.7` 模型）。三个主要视图：**清单**（三面板：待办列表 | 待办详情 | AI聊天）、**笔记**（日记编辑器 + 侧边栏）、**专注/四象限/日历/习惯/成就**（工具视图）。状态管理用 Zustand，数据请求用 TanStack Query，UI 用 Tailwind CSS + framer-motion + shadcn/ui。当前所有修改未提交，`npx tsc --noEmit` 通过。

---

## 1. 最近完成的工作

### 1.0 项目首次启动与配置（已完成 ✅）

- 后端 FastAPI 在 `http://localhost:8001` 运行，使用 `glm-4.7` 模型
- 前端 Next.js 16 + Turbopack 在 `http://localhost:3001` 运行
- 后端 SQLite 数据库已迁移完成，38+ 待办项已加载
- PWA ServiceWorker 注册可能导致缓存问题，需要注销后刷新

### 1.1 笔记面板标签自动补全（已实现 ✅）

**问题**: 笔记面板中每次输入 `#` 都需要完整输入标签，效率低。

**实现内容**:
- **最近标签列表**: `DiaryPanel.tsx` 中从 `allNotesData` 提取所有标签，按**最近使用时间**排序，通过 `recentTags` prop 传递
- **自动补全下拉框**: `DiaryEditor.tsx` 中检测 `#` 后无空格的输入，显示标签列表
- `fixed` 定位，跟随光标位置；最多显示 8 个标签；键盘导航 ↑↓/Enter/Tab/Escape

**相关文件**: `apps/diary/DiaryEditor.tsx`, `apps/diary/DiaryPanel.tsx`

### 1.2 Tab 切换后编辑器内容残留 Bug（已修复 ✅）

**根因**: 条件渲染导致重新挂载时 `useEffect` 自动加载已有日记。

**修复**: `initialLoadComplete` ref 判断首次挂载跳过 sync。

### 1.3 Sidebar 标签点击筛选功能（已修复 ✅）

**修复**: `DiaryTagList.tsx` / `DiarySidebar.tsx` / `DiaryPanel.tsx` / `DiaryEditor.tsx` 添加 `selectedTag` / `onSelectTag` 串联。

### 1.4 "Free Todo" → "GTD" 品牌重命名（已完成 ✅）

15+ 文件中的品牌名称全部替换。

### 1.5 相似笔记按钮修复（已修复 ✅）

**问题**: 笔记卡片右上角的 `GitFork`（相似笔记）按钮点击后无反应。

**修复**: 
- `DiaryEditor.tsx` 解构注释取消 (`similarToNoteId`, `onClearSimilarFilter`)
- `sortedNotes` useMemo 添加相似笔记过滤逻辑（按共同标签筛选）
- 添加筛选状态指示器 + 清除按钮

### 1.6 ChatPanel 优化（已完成 ✅）

**DiaryChatPanel**: 
- 用 `framer-motion` 替换静态渲染（空状态、消息气泡、错误横幅）
- 新增 Header（Sparkles 图标 + 标题 + streaming 指示器）
- 用 ping 脉冲动画替代旋转 spinner
- 移除输入框上方重复的标签栏

**ChatPanel 组件统一**:
- `WelcomeGreetings.tsx` — Sparkles 图标 + motion 淡入
- `HeaderBar.tsx` — 简洁自定义 header，替换 PanelHeader
- `InputBox.tsx` — `rounded-xl` + focus ring 统一
- `MessageItem.tsx` — 气泡 `rounded-2xl` + 细边框

### 1.7 笔记面板 UI 优化（已完成 ✅ — design-taste-frontend）

**DiaryEditor.tsx**:
- 卡片移除 `shadow-sm`，改用细边框 + hover 微高亮
- 卡片 `motion.div` 弹性入场 (`opacity + y`, ease: `[0.16, 1, 0.3, 1]`)
- 编辑器 `rounded-lg` → `rounded-xl`，聚焦时 shadow ring
- 工具栏按钮色值降饱和（`bg-primary/10`）
- 空状态：带图标的组合空态（Clock 圆角容器）

**DiaryPanel.tsx**:
- 错误状态 motion.div 淡入 + 圆角图标容器

**DiarySidebar.tsx / DiaryStats / DiaryTagList / DiaryFilterBar**:
- 选中态统一 `bg-primary/8 border-primary/15`
- 标签、筛选按钮 rounded-lg + hover 过渡
- 侧边栏 `bg-muted/5` → `bg-background`

**DiaryTrashView**: 卡片 motion.div 入场 + 边框统一

### 1.8 待办面板 UI 优化（已完成 ✅ — design-taste-frontend）

**TodoList.tsx**: 
- 加载态：三弹性小球 + 文字
- 错误态：`rounded-2xl` 图标容器 + 居中文案
- 空状态：带图标组合
- 已完成折叠：`rounded-xl` + `border-dashed`

**TodoCard.tsx**: 
- `rounded-lg` → `rounded-xl`
- 选中态 `bg-primary/[0.03] border-primary/20`
- 默认态去掉纯色填充

**TodoCardName / TodoCardMetadata / TodoFilter / TodoTreeList / NewTodoInlineForm**:
- 统一 `rounded-xl` + 细边框 `border-border/30`
- 聚焦态 `shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]`
- TodoTreeList 每项 motion.div 20ms 递进入场

**TodoToolbar**: 自定义 header + 搜索框 rounded-lg + focus ring

### 1.9 随机漫步刷新按钮修复（已修复 ✅）

**问题**: 笔记面板随机漫步模式右侧按钮显示文字而非图标，且点击无反应。

**修复**: 按钮改为 `RefreshCw` 图标；`sortedNotes` useMemo 依赖数组添加 `randomShuffle`。

### 1.10 面板背景色统一（已完成 ✅）

- **面板间灰色**: `PanelRegion.tsx` 的 `sidebarPanelsRef` 添加 `bg-gray-100/60 dark:bg-zinc-900/20`
- **导航栏**: 继承父级灰色背景
- **FilterColumn**: `bg-muted/5` → `bg-background`（白色）
- **侧边栏**: `DiarySidebar.tsx` 改为 `bg-background`

### 1.11 BottomDock 默认隐藏 & 面板铺满底部（已完成 ✅）

- `ui-store/utils.ts`: `dockDisplayMode` 默认值 `"fixed"` → `"auto-hide"`
- `BottomDock.tsx`: auto-hide 模式下移鼠标触底弹出逻辑，dock 始终隐藏
- `PanelRegion.tsx`: auto-hide 模式 BottomDock 容器不渲染，面板 `flex-1` 撑满
- 间距统一：面板行去掉 `px-2`，FilterColumn 与面板之间用 `gap-1` 统一

### 1.12 面板间距与背景色修复（已完成 ✅）

**问题**: 
1. 专注（Pomodoro）/四象限视图继承灰色背景
2. FilterColumn 与待办面板间 `gap`（4px）与面板间 `gap + ResizeHandle + gap`（~13px）差距过大
3. AI聊天输入框内容为空时高度偶尔异常波动
4. 输入框 @ 按钮无反应
5. PromptSuggestions 按钮与笔记chat面板样式不一致
6. 面板底部偶尔漏灰（`bg-zinc-300`）

**修复内容**:

**PanelRegion.tsx**:
- 主内容区（非 list 视图）条件添加 `bg-background`，专注/四象限等页面不再发灰
- 主内容行 `gap-1` → `gap-1.5` 统一间距
- 移除 `height: calc(100vh - 80px)` 与 AppHeader 实际高度（h-15=60px）不匹配的硬编码
- 移除 `ListPanels` 外层 `h-full` 避免 flex height:100% 链断裂

**InputBox.tsx**:
- 简化 `adjustHeight`：空内容直接固定 24px，不再每次重置 `height = "auto"` 导致布局闪烁
- `useLayoutEffect` 添加依赖 `[inputValue, adjustHeight]` 避免多余触发
- 移除 `handleChange` 中的 `requestAnimationFrame` 包装

**ChatInputSection.tsx**:
- 添加 `handleAtClick` 回调：`onInputChange(inputValue + "@")`
- 传递 `onAtClick={handleAtClick}` 给 InputBox

**PromptSuggestions.tsx**:
- 移除自定义 oklch 颜色和阴影，改用与日记 chat 面板一致的 `border border-border/40 bg-background` + `hover:border-primary/30 hover:bg-primary/5`

### 1.13 笔记批注功能（已完成 ✅）

**问题**: 笔记卡片无法直接批注，缺少批注→引用→对比查看全流程。

**实现内容**:

**后端 — related_note_ids 支持**:
- `models.py`: 新增 `JournalNoteRelation` 关联表
- `schemas/journal.py`: `JournalCreate`/`JournalUpdate`/`JournalResponse` 添加 `related_note_ids`
- `journal_manager.py`: 新增 `_get_related_note_ids` / `_replace_related_notes`，`create_journal`/`update_journal`/`delete_journal` 处理关联
- `journal_service.py`: 映射 `data.related_note_ids` 到 payload

**前端 — 批注入口 + 弹窗**:
- `DiaryEditor.tsx`: DropdownMenu 添加"批注"按钮（`MessageSquarePlus` 图标）
- `AnnotationModal.tsx`: 新建文件，Dialog + contenteditable 编辑器，底部显示被批注笔记原文
- `CompareNotesModal.tsx`: 新建文件，左右双面板对比查看

**前端 — 关联引用展示**:
- 笔记卡片底部显示引用图标（深色圆圈 + `ArrowUpLeft`）+ "关联自" + 引用笔记创建时间+正文首行

**相关文件**: 
- `lifetrace/storage/models.py`, `lifetrace/schemas/journal.py`, `lifetrace/storage/journal_manager.py`, `lifetrace/services/journal_service.py`
- `apps/diary/DiaryEditor.tsx`, `apps/diary/DiaryPanel.tsx`
- `apps/diary/components/AnnotationModal.tsx`, `apps/diary/components/CompareNotesModal.tsx`

### 1.14 笔记卡片标题格式调整（已完成 ✅）

**DiaryEditor.tsx**:
- 自动标题格式: `hh:mm` → `yyyy-mm-dd hh:mm`
- 标题样式: `text-sm font-semibold text-foreground` → `text-[10px] text-muted-foreground/50`
- 创建时间行: 添加 `hidden` 类隐藏
- 引用链接渲染: `ArrowUpLeft` 图标在深色圆圈中（`w-3 h-3`），显示 `{formatTime(refNote.createdAt)} {firstLine}`

### 1.15 番茄时钟修复（已完成 ✅）

**PomodoroView.tsx**:
- SVG 圆圈对齐: `cx="132" cy="132"` → `cx="198" cy="198"`（396x396 SVG 中心）
- 倒计时结束时自动停止（不自动切换到休息阶段），记录并保存到 localStorage
- 右侧"今日概览"统计数据在番茄完成后自动刷新

**useTimer.ts**:
- 新增 `onWorkComplete` 回调参数
- 倒计时到 0 时停止（`prev → prev`），不再自动切 phase
- `onCompleteRef.current` 中调用 `onWorkComplete?.()`

**相关文件**: `apps/pomodoro/PomodoroView.tsx`, `apps/pomodoro/hooks/useTimer.ts`

### 1.16 设置面板 UI 修复（已完成 ✅）

**问题**:
1. 设置弹窗关闭 X 按钮带圆圈背景
2. 搜索（放大镜）按钮带圆圈背景
3. 布局选择器/配色风格按钮在标题下方，应有右侧
4. "重新引导"按钮在描述下方，应有侧

**修复**:
- `SettingsModal.tsx`: 关闭按钮去掉 `h-7 w-7 rounded-md hover:bg-muted/50`，仅保留 X 图标
- `SettingsSearchAction.tsx`: 搜索按钮从 `PanelActionButton` 改为纯图标按钮
- `SettingsPanel.tsx`: 移除搜索按钮和 `SettingsSearchAction` import
- `AppearanceSection.tsx`: 布局/配色风格/主题/语言改为 `flex items-center justify-between` 左右布局
- `OnboardingSection.tsx`: 描述和按钮改为 `flex items-center justify-between` 左右布局

**相关文件**: `components/layout/SettingsModal.tsx`, `apps/settings/SettingsPanel.tsx`, `apps/settings/components/SettingsSearchAction.tsx`, `apps/settings/components/AppearanceSection.tsx`, `apps/settings/components/OnboardingSection.tsx`

### 1.17 后端 API 端口修复 & next.config 默认代理端口（已完成 ✅）

**问题**: `next.config.ts` 默认 `NEXT_PUBLIC_API_URL` 为 `localhost:8100`，但后端实际运行在 8001。未设置环境变量时全部 API 请求 500。

**修复**: `next.config.ts` 第 23 行 `localhost:8100` → `localhost:8001`。

**相关文件**: `next.config.ts`

### 1.18 笔记面板顶部白条修复（已完成 ✅）

**问题**: 日记面板使用了 `bg-gray-100/60` 半透明背景，但外层容器有 `py-1.5 bg-background`，导致上下 padding 区域透出白色。

**修复**: `PanelRegion.tsx` 对 `activeView === "diary"` 时跳过 `py-1.5`，让日记面板的灰色背景直接铺满到容器边缘。

**相关文件**: `components/layout/PanelRegion.tsx`, `apps/diary/DiaryPanel.tsx`

### 1.19 新建笔记输入时不自动创建草稿记录（已完成 ✅）

**问题**: 在顶部输入框输入内容后，笔记列表第一条会自动出现一条未提交的记录（草稿），用户希望只有点击发送后才真正显示。

**修复**: `DiaryPanel.tsx` 的 `handleAutoSave` 函数中，新笔记（无 `draftSnapshot.id`）直接 return，不触发自动保存。只有已有 id 的笔记保留失焦自动保存。

**相关文件**: `apps/diary/DiaryPanel.tsx` 第 448 行

### 1.20 笔记卡片 Markdown 渲染 + #tag 标签修复（已完成 ✅）

**问题**: 笔记卡片内容不支持 markdown 渲染，#tag 标签显示为纯文本占位符。

**修复**:
- 引入 `ReactMarkdown` + `remarkGfm` + `rehype-raw` 支持 markdown 渲染
- 预处理 `#tag` → 直接替换为 `<span>` HTML 标签，通过 `rehypeRaw` 渲染
- 移除了旧的 `§TAG§xxx§END§` 占位符方案
- 输入框按 Enter 自动续编号（`1. xxx` → Enter → `2. `）

**相关文件**: `apps/diary/DiaryEditor.tsx`（NoteMarkdown、onKeyDownCapture）

### 1.21 笔记搜索功能（本 session ✅）

**问题**: 笔记面板没有搜索功能，无法快速查找笔记内容。

**实现内容**:
- **搜索栏**: `DiaryEditor.tsx` 输入框上方添加搜索栏，带搜索图标和清除按钮
- **300ms 防抖**: 输入后 300ms 防抖再发起请求，避免频繁 API 调用
- **搜索/筛选时隐藏输入框**: 搜索或标签筛选激活时，笔记输入框自动隐藏，只显示结果列表
- **搜索指示器**: 列表上方显示当前搜索关键词和清除按钮

**后端 — 搜索端点**:
- `GET /api/journals` 添加 `search` 查询参数
- `journal_manager.py` 使用 `ILIKE` 搜索 `user_notes` 和 `name` 字段
- `count_journals` 同样支持搜索参数，确保 `total` 准确

**数据流**: 搜索栏输入 → 300ms 防抖 → `useJournals({search})` → `GET /api/journals?search=xxx` → 后端 `ILIKE` 过滤 → 返回匹配结果

**相关文件**:
- `apps/diary/DiaryEditor.tsx` — 搜索栏 UI + 防抖 + 条件隐藏
- `lib/query/journals.ts` — `UseJournalsParams` 添加 `search`
- `lib/query/keys.ts` — 查询键添加 `search`
- `lib/generated/schemas/listJournalsApiJournalsGetParams.ts` — 类型添加 `search`
- `lifetrace/storage/journal_manager.py` — `list_journals`/`count_journals` 添加 `search` + `ILIKE` 过滤
- `lifetrace/repositories/interfaces.py` — 接口签名更新
- `lifetrace/repositories/sql_journal_repository.py` — 透传参数
- `lifetrace/services/journal_service.py` — 透传参数
- `lifetrace/routers/journal.py` — 路由添加 `search` Query 参数

### 1.22 本地嵌入模型替换为云端 SiliconFlow API（本 session ✅）

**问题**: 后端使用本地 `sentence-transformers` + `torch` 生成文本嵌入，导致项目体积巨大（torch 401MB + transformers 47MB）。

**替换内容**:
- 新建 `lifetrace/llm/cloud_embeddings.py` — SiliconFlow HTTP 客户端，支持单条和批量嵌入
- 重写 `lifetrace/llm/vector_db.py` — 移除 `sentence-transformers`/`CrossEncoder`，改用 `CloudEmbeddingClient`
- 移除 `torch`、`torchvision`、`torchaudio`、`transformers`、`sentence-transformers`、`opencv-python`、`sympy` 依赖
- 安装 `rehype-raw` 前端插件

**体积变化**: 3.4G → 2.3G（节省 ~1.1G，其中 torch/opencv/transformers ~560M，`.next` 缓存 ~440M）

**配置方式**:
```bash
export SILICONFLOW_API_KEY="sk-xxx"
# 或 config.yaml 中配置 vector_db.siliconflow_api_key
```

**API 端点**: `POST https://api.siliconflow.cn/v1/embeddings`，模型 `Qwen/Qwen3-VL-Embedding-8B`

**相关文件**: 
- `lifetrace/llm/cloud_embeddings.py` — 新建
- `lifetrace/llm/vector_db.py` — 重写
- `lifetrace/llm/event_summary_clustering.py` — 批量嵌入优化
- `lifetrace/config/config.yaml` / `default_config.yaml` — 配置更新
- `lifetrace/core/module_registry.py` — 移除 `sentence_transformers` 依赖声明
- `lifetrace/pyinstaller.spec` — 移除 torch/transformers 打包
- `pyproject.toml` / `requirements-runtime.txt` — 移除依赖

---

## 2. 当前 Git 状态

大量文件已修改但未提交。

**本 session 修改的文件（2026-07-08 ~ 2026-07-09）**:

**笔记搜索功能**:
- `apps/diary/DiaryEditor.tsx` — 搜索栏 UI、防抖、条件隐藏输入框、搜索指示器
- `lib/query/journals.ts` — `UseJournalsParams` 添加 `search`
- `lib/query/keys.ts` — 查询键添加 `search`
- `lib/generated/schemas/listJournalsApiJournalsGetParams.ts` — 类型添加 `search`
- `lifetrace/storage/journal_manager.py` — `ILIKE` 搜索 + `or_` import
- `lifetrace/repositories/interfaces.py` — 接口签名更新
- `lifetrace/repositories/sql_journal_repository.py` — 透传参数
- `lifetrace/services/journal_service.py` — 透传参数
- `lifetrace/routers/journal.py` — 路由添加 `search` 参数

**#tag 标签修复**:
- `apps/diary/DiaryEditor.tsx` — `rehypeRaw` 方案、移除 `renderContentWithTags`/`noteMarkdownComponents`

**TypeScript 清理**:
- `apps/diary/components/AnnotationModal.tsx` — 移除未使用的 `motion` import
- `apps/settings/SettingsPanel.tsx` — `setSearchQuery` → `_setSearchQuery`
- `apps/settings/components/SettingsSearchAction.tsx` — 移除未使用的 `cn` import
- `apps/diary/DiaryPanel.tsx` — 添加 `relatedNoteIds` 字段

**云端嵌入替换**:
- `lifetrace/llm/cloud_embeddings.py` — 新建 SiliconFlow 客户端
- `lifetrace/llm/vector_db.py` — 重写（移除本地模型，改用云端 API）
- `lifetrace/llm/event_summary_clustering.py` — 批量嵌入优化
- `lifetrace/config/config.yaml` — 配置更新
- `lifetrace/config/default_config.yaml` — 配置更新
- `lifetrace/util/settings.py` — 新增 Validator
- `lifetrace/core/module_registry.py` — 移除 `sentence_transformers` 依赖
- `lifetrace/pyinstaller.spec` — 移除 torch/transformers
- `pyproject.toml` — 移除 `sentence-transformers`/`opencv-python`
- `requirements-runtime.txt` — 移除 `sentence-transformers`/`opencv-python`

**前一 session 修改的文件**:

**笔记批注**:
- `lifetrace/storage/models.py` — 新增 JournalNoteRelation 关联表
- `lifetrace/schemas/journal.py` — 添加 related_note_ids 字段
- `lifetrace/storage/journal_manager.py` — 关联逻辑
- `lifetrace/services/journal_service.py` — 字段映射
- `apps/diary/DiaryPanel.tsx` — 串联批注全流程、引用映射传递
- `apps/diary/DiaryEditor.tsx` — Dropdown "批注"、引用链接展示、标题格式
- `apps/diary/components/AnnotationModal.tsx` — 新建批注弹窗
- `apps/diary/components/CompareNotesModal.tsx` — 新建对比弹窗

**番茄时钟**:
- `apps/pomodoro/PomodoroView.tsx` — SVG 对齐、session 保存、stats 刷新
- `apps/pomodoro/hooks/useTimer.ts` — onWorkComplete 回调、停止不倒计时

**设置面板**:
- `components/layout/SettingsModal.tsx` — 关闭按钮去圆圈
- `apps/settings/SettingsPanel.tsx` — 移除搜索按钮
- `apps/settings/components/SettingsSearchAction.tsx` — 纯图标按钮
- `apps/settings/components/AppearanceSection.tsx` — 左右布局
- `apps/settings/components/OnboardingSection.tsx` — 左右布局

**其他**:
- `next.config.ts` — 默认代理端口 8100→8001
- `components/layout/PanelRegion.tsx` — 日记视图条件去 py-1.5

**设计优化 (design-taste-frontend)**:
- `apps/diary/DiaryEditor.tsx` — 卡片 motion 入场、编辑器/工具栏样式统一、空状态、筛选 badge
- `apps/diary/DiaryPanel.tsx` — 错误状态 motion、面板间隙灰色
- `apps/diary/components/DiarySidebar.tsx` — 侧边栏 `bg-background`
- `apps/diary/components/DiaryTagList.tsx` — 恢复稳定版 button
- `apps/diary/components/DiaryFilterBar.tsx` — 选中态统一
- `apps/diary/components/DiaryStats.tsx` — 微调
- `apps/diary/components/DiaryTrashView.tsx` — 卡片 motion + 边框
- `apps/diary/components/DiaryTrashList.tsx` — 微调

**Chat 面板**:
- `apps/diary/components/DiaryChatPanel.tsx` — 完全重构 (framer-motion)
- `apps/chat/components/layout/WelcomeGreetings.tsx` — 重构
- `apps/chat/components/layout/HeaderBar.tsx` — 重构
- `apps/chat/components/message/MessageItem.tsx` — 气泡样式

**Todo 面板**:
- `apps/todo-list/TodoList.tsx` — 加载/错误/空状态 + motion
- `apps/todo-list/TodoToolbar.tsx` — 自定义 header
- `apps/todo-list/TodoCard.tsx` — card 样式统一
- `apps/todo-list/TodoCardName.tsx` — 编辑输入框样式
- `apps/todo-list/TodoCardMetadata.tsx` — 标签样式
- `apps/todo-list/TodoFilter.tsx` — 下拉面板样式
- `apps/todo-list/TodoTreeList.tsx` — motion 入场
- `apps/todo-list/NewTodoInlineForm.tsx` — focus ring

**布局**:
- `components/layout/FilterColumn.tsx` — `bg-background`
- `components/layout/BottomDock.tsx` — auto-hide 不移触底弹出
- `lib/store/ui-store/utils.ts` — dockDisplayMode 默认 auto-hide
- `lib/i18n/messages/zh.json` / `en.json` — 新增 sidebarStats/sidebarFilter 键

---

## 3. 项目启动方式

```bash
cd D:\manus\GTD\free-todo-frontend

# 安装依赖 (首次)
pnpm install

# 启动开发服务器 (端口 3001)
pnpm dev:frontend:web

# 或使用默认端口
pnpm dev:frontend:default-port
```

**重要**: Next.js 16.1.6 + Turbopack。如果启动失败报 lock 文件错误，先删除锁：
```bash
rm -f .next/dev/lock
# 然后杀掉所有 node 进程重新启动
```

**.claude/launch.json**: 配置了 Frontend（port 3001, autoPort: true）和 Backend（port 8001）两个 dev server。后端命令为 `uv run python lifetrace/scripts/start_backend.py`。

**启动提醒**:
- 后端必须在 8001 端口运行，否则前端代理会报错
- `next.config.ts` 默认代理地址已改为 `localhost:8001`（不需要再设置环境变量）
- **后端嵌入已改为云端 API**，需要设置 `SILICONFLOW_API_KEY` 环境变量或 config.yaml 配置

---

## 4. 关键技术细节

| 项目 | 说明 |
|------|------|
| 框架 | Next.js 16.1.6 (Turbopack) |
| 包管理 | pnpm |
| 状态管理 | Zustand (persist middleware, localStorage) |
| 数据请求 | TanStack Query (staleTime: 30s for journals) |
| 国际化 | next-intl (zh / en) |
| UI 组件 | shadcn/ui (DropdownMenu, AlertDialog 等) |
| 样式 | Tailwind CSS v4 |
| 动画 | framer-motion ^12.29.2 |
| 图标 | lucide-react |
| 类型检查 | `npx tsc --noEmit` ✅ 当前通过 |
| 嵌入模型 | SiliconFlow 云端 API（替代本地 torch） |

**DiaryPanel 架构要点**:
- `initialLoadComplete` ref — 防止重新挂载时自动加载已有日记
- `clearAfterSubmit` ref — 提交后防止 useEffect 恢复旧数据
- `lastSyncKey` ref — 去重，防止重复同步
- 条件渲染：`{activeView === "diary" && <DiaryPanel />}` — 切换 tab 时完全卸载
- `annotateTarget` state — 批注弹窗目标（传给 AnnotationModal）
- `compareTarget` state — 对比查看弹窗目标
- `sessionCounter` state — 用于强制番茄时钟 stats 刷新

**DiaryEditor 架构要点**:
- `sortedNotes` useMemo 依赖: `[notesList, pinnedIds, filterMode, tagFilter, similarToNoteId, randomShuffle]`
- 标签自动补全: `tagAutocomplete` state + `cursorPos` fixed 定位，`cursorPosRef` 同步捕获
- 编辑模式: `editingCardId` / `editName` / `editContent`
- `onAnnotate` prop — 批注入口回调（DropdownMenu "批注" → 弹出 AnnotationModal）
- 引用链接: `getNoteById` 从 `allNotesData` 查找关联笔记，显示首行摘要
- **搜索**: `searchQuery` + `debouncedSearch` 300ms 防抖，搜索/筛选时隐藏输入框

**番茄时钟**:
- `useTimer` hook: `onWorkComplete` 回调、stop-at-0 不倒计时
- 数据持久化: `localStorage("pomodoro-sessions")` 记录每次完成
- Stats 刷新: `sessionCounter` state → `useMemo` 依赖

**笔记批注数据流**:
```
用户点击 "批注" → AnnotationModal → createJournal(relatedNoteIds)
→ backend 创建笔记并关联 → refetch() → 卡片显示引用链接
→ 点击引用链接 → CompareNotesModal 左右对比
```

**笔记搜索数据流**:
```
搜索栏输入 → 300ms 防抖 → useJournals({search}) → GET /api/journals?search=xxx
→ backend ILIKE 过滤 user_notes/name → 返回匹配结果 → 列表渲染
```

**设计语言统一点**:
- 卡片: `rounded-xl` + `border-border/30` + hover 微高亮，无硬阴影
- 选中态: `bg-primary/8 border-primary/15` 配方
- 聚焦态: `shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]`
- 入场: framer-motion spring (`ease: [0.16, 1, 0.3, 1]`)
- 面板间隙: `bg-gray-100/60 dark:bg-zinc-900/20`
- 设置弹窗: 按钮去圆圈，左右布局（标题左，控件右）

**布局结构**:
```
PanelRegion
├── sidebarPanelsRef (灰色 bg-gray-100/60)
│   ├── SidebarNav (56px, 继承灰色)
│   ├── 主内容区 (py-1.5 日记视图除外, gap-1.5)
│   │   ├── FilterColumn (白 bg-background) — list 视图
│   │   └── ListPanels (面板行 gap-1)
│   │       ├── PanelContainer A (待办列表)
│   │       ├── ResizeHandle
│   │       ├── PanelContainer B (待办详情)
│   │       ├── ResizeHandle
│   │       └── PanelContainer C (AI聊天)
│   └── BottomDock (auto-hide 时跳过渲染)
└── SettingsModal
```

---

## 5. 已知未解决问题

### 5.1 导航栏底色灰色需确认

当前导航栏（SidebarNav）继承 `bg-gray-100/60`，与面板间隙灰色一致。如果觉得太深可调整色值。

### 5.2 后端 API 配置

项目依赖后端 API `localhost:8001`。部分功能（如 AI聊天、待办同步）需要后端正常运行。当前后端依赖 `glm-4.7` 模型，配置在 `lifetrace/config/config.yaml`。

### 5.3 新会话空 session 重复

**问题**: 每次点击"新任务"按钮时，本地先创建一个空 session，然后 `prepareSession` 又在后端创建另一个 session，导致列表出现两个空 session。

**根因**: `opencode.js` 的 `new-task` 按钮直接 `state.sessions.unshift({id: 'ses_' + ...})`，但后端 API 也负责创建 session。

**状态**: 已知，待修复。

### 5.4 欢迎页模式选择与实际模式不一致

**问题**: 欢迎页默认选中"Build 开发"，但 `executeSubmission` 中 fallback 是 `'plan'`。

**状态**: 已知，待修复。

### 5.5 后端嵌入 API Key 未配置提示

**问题**: 如果不设置 `SILICONFLOW_API_KEY`，向量搜索功能会静默不可用（日志警告）。

**建议**: 启动时检查环境变量，如果未设置则在日志中输出明确的配置指引。

---

## 6. 下一步建议

1. **提交代码**: 当前修改量很大（搜索 + 云端嵌入 + 批注 + 番茄 + 设置 + 笔记 UI），建议分批提交
2. **修复已知问题**:
   - 空 session 重复（`opencode.js` new-task 处理）
   - 模式选择不一致（build/plan fallback）
3. **测试清单**:
   - 笔记搜索功能（关键词搜索、防抖、清除、空结果）
   - 搜索/筛选时输入框隐藏逻辑
   - 日记 CRUD 全流程（特别是批注→引用→对比查看）
   - Tab 切换不丢失/不复制数据
   - 番茄时钟：倒计时、自动停止、记录、stats 刷新
   - 置顶功能持久化（刷新保持）
   - 删除确认弹窗
   - 标签点击筛选 + 相似笔记筛选
   - 回收站视图（清空/恢复）
   - 设置面板关闭按钮/布局/配色
   - 面板布局/底部 Dock auto-hide
4. **类型检查**: `npx tsc --noEmit` 目前通过

---

## 7. 文件索引

```
apps/diary/
├── DiaryPanel.tsx              # 日记主面板 + 灰色容器 + 批注/对比弹窗串联
├── DiaryEditor.tsx             # 编辑器 + 笔记卡片 + motion + 批注入口 + 引用 + 搜索栏
├── DiaryPanelOld.tsx           # 旧版面板（可能已不用）
├── types.ts                    # JournalDraft 类型定义
├── journal-utils.ts            # 日期/bucket 工具函数
├── components/
│   ├── AnnotationModal.tsx     # 批注输入弹窗（新建）
│   ├── CompareNotesModal.tsx   # 对比查看弹窗（新建）
│   ├── DiaryChatPanel.tsx      # AI 聊天面板 (framer-motion 重构)
│   ├── DiarySidebar.tsx        # 侧边栏（统计、活跃度、标签）
│   ├── DiaryStats.tsx          # 统计卡片
│   ├── DiaryFilterBar.tsx      # 筛选栏
│   ├── DiaryTagList.tsx        # 标签列表
│   ├── DiaryHeatmap.tsx        # 活跃度热力图
│   ├── DiaryTrashList.tsx      # 回收站入口
│   └── DiaryTrashView.tsx      # 回收站面板
└── hooks/
    └── useDiaryStats.ts        # 统计数据 hook

apps/pomodoro/
├── PomodoroView.tsx            # 番茄时钟主视图 + SVG + stats
├── hooks/
│   └── useTimer.ts             # 倒计时 hook（onWorkComplete, stop-at-0）
└── components/
    └── StatsChart.tsx          # 专注趋势图表

apps/settings/
├── SettingsPanel.tsx           # 设置面板主组件
├── components/
│   ├── AppearanceSection.tsx   # 外观（布局/配色/主题/语言，左右布局）
│   ├── SettingsSection.tsx     # 设置区块容器
│   ├── SettingsSearchAction.tsx # 搜索按钮（已不实用，保留备）
│   ├── OnboardingSection.tsx   # 重新引导（左右布局）
│   └── ...
└── hooks/
    └── useSettingsSearchMatchStats.ts

apps/todo-list/
├── TodoList.tsx                # 待办列表主组件
├── TodoToolbar.tsx             # 自定义 header
├── TodoCard.tsx                # 待办卡片
├── TodoTreeList.tsx            # 树形列表 (motion)
├── NewTodoInlineForm.tsx       # 新建待办输入框
└── components/
    ├── TodoCardName.tsx        # 卡片名称
    ├── TodoCardMetadata.tsx    # 卡片元信息
    ├── TodoFilter.tsx          # 筛选面板
    └── ...

apps/todo-detail/
├── TodoDetail.tsx              # 待办详情主组件
└── components/
    ├── DetailHeader.tsx        # 详情/制品视图切换 header
    ├── DetailTitle.tsx         # 标题编辑
    ├── MetaSection.tsx         # 优先级/标签/日期元信息
    ├── BackgroundSection.tsx   # 背景描述
    ├── NotesEditor.tsx         # 笔记编辑器
    ├── ChildTodoSection.tsx    # 子任务列表
    ├── ArtifactsView.tsx       # 附件/制品视图
    ├── AttachmentPreviewPanel.tsx # 附件预览
    └── DatePicker*.tsx         # 日期选择器

apps/chat/
├── ChatPanel.tsx               # 聊天主面板（含 breakdown 流程）
└── components/
    ├── layout/
    │   ├── HeaderBar.tsx       # 自定义 header
    │   └── WelcomeGreetings.tsx # 欢迎页 (motion)
    ├── input/
    │   ├── ChatInputSection.tsx # 输入区域容器（含 @ 回调）
    │   ├── InputBox.tsx        # 输入框 (auto-resize)
    │   ├── PromptSuggestions.tsx # 快捷建议按钮
    │   ├── ToolSelector.tsx    # Agno 工具选择器
    │   ├── LinkedTodos.tsx     # 关联待办列表
    │   └── PromptSuggestions.tsx # 拆解/排序/建议按钮
    ├── message/
    │   ├── MessageItem.tsx     # 消息气泡
    │   ├── MessageContent.tsx  # 消息内容 (markdown)
    │   └── ...
    └── breakdown/
        ├── BreakdownStageRenderer.tsx # 拆解流程渲染
        ├── BreakdownSummary.tsx
        └── BreakdownQuestionnaireModal.tsx

components/layout/
├── PanelRegion.tsx             # 面板布局 + 灰色背景 + dock + 日记条件 py-1.5
├── PanelContainer.tsx          # 面板容器 (bg-card, framer-motion)
├── PanelContent.tsx            # 面板内容插槽（懒加载）
├── FilterColumn.tsx            # 筛选侧边栏 (白 bg-background)
├── ResizeHandle.tsx            # 面板缩放分隔条
├── BottomDock.tsx              # 底部 Dock (auto-hide)
├── AppHeader.tsx               # 应用顶部栏
├── SettingsModal.tsx           # 设置弹窗（关闭无圆圈）
└── ...

lib/store/ui-store/
├── utils.ts                    # DEFAULT_PANEL_STATE dockDisplayMode = auto-hide
├── types.ts                    # PanelFeature, LayoutPreset 等类型
├── store.ts                    # Zustand store
├── storage.ts                  # localStorage 持久化
└── layout-actions.ts           # 布局动作

lifetrace/llm/
├── cloud_embeddings.py         # SiliconFlow 云端 Embedding API 客户端（新建）
├── vector_db.py                # 向量数据库（重写，移除本地模型）
├── vector_service.py           # 向量服务
├── event_summary_clustering.py # HDBSCAN 聚类（批量嵌入优化）
├── event_summary_service.py    # 事件摘要服务
├── event_summary_config.py     # 聚类配置
└── ...
```

---

## 给下个 session 的开发前言

> 当前项目是 LifeTrace（GTD 品牌），核心功能是清单三面板布局和笔记编辑器。所有代码修改均未提交。
> 
> **本 session 完成的主要功能**:
> 1. **#tag 标签渲染修复** — 用 `rehype-raw` 方案替代旧的 `§TAG§` 占位符，`#tag` 正确显示为圆角标签
> 2. **笔记搜索功能** — 在笔记输入框上方添加搜索栏，支持关键词搜索笔记内容（300ms 防抖、ILIKE 后端搜索）
> 3. **搜索/筛选时隐藏输入框** — 搜索或标签筛选激活时，笔记输入框自动隐藏，只显示结果列表
> 4. **本地嵌入模型 → 云端 SiliconFlow API** — 移除 `torch`/`sentence-transformers`/`opencv-python`，改用 HTTP API
> 5. **项目依赖清理** — 删除 `.next` 缓存，卸载 ~560M 的 Python 包，项目从 3.4G 缩小到 2.3G
> 
> **当前阻塞问题** ⚠️:
> - 无（#tag 渲染问题已修复）
> 
> **已知遗留问题**:
> - 空 session 重复（OpenCode 原问题）
> - 欢迎页模式选择与实际不一致（`plan` vs `build`）
> 
> 当前 TypeScript 类型检查通过。设计基准仍保持：`DESIGN_VARIANCE=8, MOTION_INTENSITY=6, VISUAL_DENSITY=4`。
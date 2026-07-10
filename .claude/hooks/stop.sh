#!/bin/bash
# FreeTodo 会话结束自动 Handover 更新
# 配置为 Stop hook，每次会话结束时执行

HANDOVER="$CLAUDE_CWD/free-todo-frontend/handover.md"

# 记录会话结束时间
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# 获取 git 状态摘要
cd "$CLAUDE_CWD" 2>/dev/null
GIT_STATUS=$(git status --short 2>/dev/null | wc -l)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

cat >> "$HANDOVER" << EOF

---

## 会话结束快照 — ${TIMESTAMP}

**分支**: ${GIT_BRANCH} | **未提交文件**: ${GIT_STATUS}

> 此自动快照由 Stop hook 在会话结束时生成。
> 下个 session 接续时请先阅读此文件了解上下文。
EOF

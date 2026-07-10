# Agno Agent 开发快捷命令

## 概述

本指南涵盖 **Agno Agent Tools** 的开发 - 基于 [Agno 框架](https://docs.agno.com/) 的 AI 待办管理工具包。

LifeTraceToolkit 为 Agno Agent 提供一系列工具，用于管理待办事项。具体工具列表请查阅 `llm/agno_tools/tools/` 目录下的源代码。

---

## 🏗️ 架构

### 目录结构

```
lifetrace/
├── config/prompts/agno_tools/     # 本地化消息和提示词
│   ├── zh/                        # 中文消息
│   └── en/                        # 英文消息（结构相同）
│
├── llm/agno_tools/                # Python 实现
│   ├── __init__.py                # 模块导出
│   ├── base.py                    # 消息加载器 (AgnoToolsMessageLoader)
│   ├── toolkit.py                 # 主 LifeTraceToolkit 类
│   └── tools/                     # 各工具实现（按功能分类）
│
└── observability/                 # Agent 监控（Phoenix + OpenInference）
    ├── __init__.py                # 模块导出
    ├── config.py                  # 观测配置
    ├── setup.py                   # 初始化入口
    └── exporters/
        ├── __init__.py
        └── file_exporter.py       # 本地 JSON 文件导出器
```

### 设计模式

- **Mixin 模式**：每个工具类别是独立的 mixin 类
- **组合模式**：LifeTraceToolkit 继承所有 mixin + Agno Toolkit
- **国际化**：消息从语言特定的 YAML 文件加载
- **懒加载**：数据库和 LLM 客户端按需初始化

---

## 🔧 添加新工具

### 步骤 1：添加消息（中英文）

在 `config/prompts/agno_tools/zh/` 和 `en/` 中创建或更新 YAML 文件：

```yaml
# config/prompts/agno_tools/zh/my_tool.yaml
my_tool_success: "操作成功: {result}"
my_tool_failed: "操作失败: {error}"
my_tool_prompt: |
  这是给 LLM 的提示词模板。
  参数: {param}
```

```yaml
# config/prompts/agno_tools/en/my_tool.yaml
my_tool_success: "Operation successful: {result}"
my_tool_failed: "Operation failed: {error}"
my_tool_prompt: |
  This is a prompt template for LLM.
  Parameter: {param}
```

### 步骤 2：创建工具 Mixin

在 `llm/agno_tools/tools/` 中创建新文件：

```python
# llm/agno_tools/tools/my_tools.py
"""My Tools - 这些工具的功能描述"""

from __future__ import annotations
from typing import TYPE_CHECKING

from lifetrace.llm.agno_tools.base import get_message
from lifetrace.util.logging_config import get_logger

if TYPE_CHECKING:
    from lifetrace.repositories.sql_todo_repository import SqlTodoRepository

logger = get_logger()


class MyTools:
    """My tools mixin"""

    lang: str
    todo_repo: "SqlTodoRepository"  # 如果需要

    def _msg(self, key: str, **kwargs) -> str:
        return get_message(self.lang, key, **kwargs)

    def my_tool_method(self, param: str) -> str:
        """工具描述，让 LLM 理解何时使用此工具

        Args:
            param: 参数描述

        Returns:
            结果消息
        """
        try:
            # 实现逻辑
            result = f"processed {param}"
            return self._msg("my_tool_success", result=result)
        except Exception as e:
            logger.error(f"Failed: {e}")
            return self._msg("my_tool_failed", error=str(e))
```

### 步骤 3：注册到 Toolkit

更新 `llm/agno_tools/tools/__init__.py`：

```python
from lifetrace.llm.agno_tools.tools.my_tools import MyTools

__all__ = [..., "MyTools"]
```

更新 `llm/agno_tools/toolkit.py`：

```python
from lifetrace.llm.agno_tools.tools import (
    ...,
    MyTools,
)

class LifeTraceToolkit(
    ...,
    MyTools,  # 添加 mixin
    Toolkit,
):
    def __init__(self, lang: str = "en", **kwargs):
        ...
        tools = [
            ...,
            self.my_tool_method,  # 注册工具
        ]
```

---

## 📝 消息配置

### YAML 结构

消息按功能组织在 `config/prompts/agno_tools/{lang}/` 目录下。每个 YAML 文件对应一类功能的消息。

### 消息格式

- 使用 `{placeholder}` 进行变量替换
- 多行提示词使用 YAML `|` 语法
- 保持消息简洁且信息丰富

```yaml
# 带占位符的简单消息
create_success: "成功创建待办 #{id}: {name}"

# 多行提示词
breakdown_prompt: |
  请将此任务拆解为子任务。

  任务: {task_description}

  返回 JSON 格式。
```

### 访问消息

```python
# 在工具方法中
def _msg(self, key: str, **kwargs) -> str:
    return get_message(self.lang, key, **kwargs)

# 使用
return self._msg("create_success", id=123, name="买菜")
```

---

## 🌐 国际化

### 语言选择

语言通过调用链传递：

```
请求头 (Accept-Language)
    ↓
Chat Router (get_request_language)
    ↓
AgnoAgentService(lang=lang)
    ↓
LifeTraceToolkit(lang=lang)
    ↓
AgnoToolsMessageLoader(lang)
```

### 添加新语言

1. 创建新目录：`config/prompts/agno_tools/{lang}/`
2. 从 `en/` 复制所有 YAML 文件
3. 翻译所有消息
4. 加载器会自动检测新语言

---

## 🧪 测试工具

### 快速测试脚本

```python
from lifetrace.llm.agno_tools import LifeTraceToolkit

# 测试中文
toolkit_zh = LifeTraceToolkit(lang="zh")
print(toolkit_zh.list_todos(status="active", limit=5))

# 测试英文
toolkit_en = LifeTraceToolkit(lang="en")
print(toolkit_en.list_todos(status="active", limit=5))
```

### 运行测试

```bash
uv run python -c "
from lifetrace.llm.agno_tools import LifeTraceToolkit
tk = LifeTraceToolkit(lang='zh')
print(tk.parse_time('明天下午3点'))
"
```

---

## 📊 可观测性（Agent 监控）

Agno Agent 集成了 [Arize Phoenix](https://arize.com/docs/phoenix) + [OpenInference](https://github.com/arize-ai/openinference) 进行链路追踪和监控。

### 功能特性

- **本地 JSON 导出**：Cursor 友好的 trace 文件，便于 AI 分析
- **Phoenix UI**：可选的 Web 可视化界面
- **精简终端输出**：每次 trace 仅输出一行摘要

### 配置方法

在 `config/config.yaml` 中：

```yaml
observability:
  enabled: true                    # 启用观测功能
  mode: both                       # local | phoenix | both
  local:
    traces_dir: traces/            # trace 文件目录
    max_files: 100                 # 最大保留文件数
    pretty_print: true             # 格式化 JSON 便于阅读
  phoenix:
    endpoint: http://localhost:6006
    project_name: freetodo-agent
  terminal:
    summary_only: true             # 仅输出一行摘要（推荐）
```

### Trace 文件格式

每次 Agent 运行会在 `data/traces/` 生成一个 JSON 文件：

```json
{
  "trace_id": "e078e147372a",
  "timestamp": "2026-01-23T08:23:48.377470+00:00",
  "duration_ms": 26910.94,
  "agent": "breakdown_task",
  "input": "{\"task_description\": \"做视频\"}",
  "output_preview": "任务拆解结果:\n1. 确定视频主题...",
  "tool_calls": [
    {
      "name": "breakdown_task",
      "args": {"task_description": "做视频"},
      "result_preview": "任务拆解结果...",
      "duration_ms": 26910.94
    }
  ],
  "llm_calls": [],
  "status": "success",
  "span_count": 1
}
```

### 终端输出

启用 `summary_only: true` 时：

```
[Trace] e078e147372a | 1 tools | 26.91s | traces/20260123_082348_e078e147372a.json
```

### 使用 Phoenix UI（可选）

```bash
# 启动 Phoenix 服务
uv run phoenix serve

# 访问 http://localhost:6006
```

---

## ✅ 开发检查清单

添加新工具时：

- [ ] 在 `zh/` 和 `en/` 目录中创建 YAML 消息
- [ ] 创建带有正确类型提示的工具 mixin 类
- [ ] 添加文档字符串让 LLM 理解工具用途
- [ ] 所有用户可见消息使用 `_msg()`
- [ ] 处理异常并返回错误消息
- [ ] 在 `tools/__init__.py` 中注册工具
- [ ] 将 mixin 添加到 `LifeTraceToolkit` 类
- [ ] 在 `tools` 列表中注册方法
- [ ] 使用两种语言测试

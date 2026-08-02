# Hermes 引擎原生能力清单

> 分析日期: 2026-08-02
> 依据: docs/引擎分析/Hermes-代码功能分析.md
> 原则: 只列引擎原生代码直接实现的能力，排除 MCP/Skill 实现的

---

## 1. 核心对话能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 流式对话 | ✅ | `_fire_stream_delta()` | `agent/conversation_loop.py` | `display.streaming: true` | 同步回调+asyncio队列 |
| 思考/推理 | ✅ | `StreamingThinkScrubber` | `agent/think_scrubber.py` | 自动识别标签 | `<think>/<reasoning>` 标签处理 |
| 多模型支持 | ✅ | 多provider配置 | `hermes_constants.py` | `model.provider` 切换 | auto/openai/anthropic/openrouter |
| 上下文压缩 | ✅ | `context_compressor.py` | `agent/context_compressor.py` | 50%阈值触发 | 独立压缩模型 |
| Token统计 | ✅ | usage tracking | `run_agent.py` | 自动 | input/output tokens |

## 2. 原生工具能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 文件读写 | ✅ | `read_file/write_file/patch` | `tools/file_tools.py` | 工具调用 | 自动注册到ToolRegistry |
| 脚本/终端执行 | ✅ | `terminal_tool.py` | `tools/terminal_tool.py` | 工具调用 | local/docker/ssh/modal/singularity |
| 代码搜索 | ✅ | `search_files` | `tools/file_tools.py` | 工具调用 | ripgrep封装 |
| 任务规划 | ✅ | `todo_tool.py` | `tools/todo_tool.py` | 工具调用 | TodoStore结构化任务 |
| 多工具并行 | ❌ | — | — | — | — |

## 3. 内置特殊工具

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 浏览器控制 | ✅ | `browser_tool.py` | `tools/browser_tool.py` | 工具调用 | agent-browser CDP原生实现 |
| 图像生成 | ✅ | `image_generation_tool.py` | `tools/image_generation_tool.py` | 工具调用 | 内置image_gen_registry |
| 视觉分析 | ✅ | `vision_tools.py` | `tools/vision_tools.py` | 工具调用 | 多后端路由 |
| 语音/TTS | ✅ | `tts_tool.py` | `tools/tts_tool.py` | 工具调用 | Edge/ElevenLabs/MiniMax |
| 实时语音对话 | ❌ | — | — | — | — |
| 桌面控制 | ✅ | `computer_use/` | `tools/computer_use/` | 工具调用 | cua-driver实现 |
| 代码执行 | ✅ | `code_execution_tool.py` | `tools/code_execution_tool.py` | 工具调用 | 受限沙箱 |

## 4. 会话/记忆能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 会话持久化 | ✅ | SQLite WAL模式 | `hermes_state.py` | 自动保存 | FTS5全文搜索 |
| 会话搜索 | ✅ | FTS5搜索 | `tools/session_search_tool.py` | 工具调用 | 跨会话全文检索 |
| 会话改名 | ✅ | session更新 | `hermes_state.py` | CLI/API | 直接操作SQLite |
| 会话删除 | ✅ | session删除 | `hermes_state.py` | CLI/API | 直接操作SQLite |
| 记忆系统 | ✅ | `memory_manager.py` | `agent/memory_manager.py` | 自动/工具 | MEMORY.md + USER.md |
| 会话分叉/恢复 | ✅ | `parent_session_id` | `hermes_state.py` | 自动 | 压缩分叉+子代理会话 |

## 5. 协作/网关能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 多Agent协作 | ✅ | `delegate_tool.py` | `tools/delegate_tool.py` | 工具调用 | 子代理委托 |
| IM Bot网关 | ✅ | 9+平台适配器 | `gateway/platforms/` | `hermes gateway` | Telegram/Discord/Slack/微信/QQ等 |
| 定时任务 | ✅ | `cron/scheduler.py` | `cron/scheduler.py` | `croniter`库 | cron表达式调度 |
| 看板协作 | ✅ | `kanban_tools.py` | `tools/kanban_tools.py` | 工具调用 | SQLite持久化 |

## 6. 独有原生能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| MoA多模型仲裁 | ✅ | `moa_loop.py` | `agent/moa_loop.py` | `/moa`命令 | 参考模型池+聚合模型 |
| ACP协议 | ✅ | `acp_adapter/` | `acp_adapter/entry.py` | `hermes-acp` | Agent Client Protocol |
| 上下文压缩 | ✅ | `context_compressor.py` | `agent/context_compressor.py` | 自动触发 | 50%阈值+独立压缩模型 |
| 看板协作 | ✅ | `kanban_tools.py` | `tools/kanban_tools.py` | 工具调用 | 多智能体任务管理 |
| 工具审批 | ✅ | `approval.py` | `tools/approval.py` | 自动 | 自动/手动审批 |
| 并发实例检测 | ✅ | `dead_targets.py` | `gateway/dead_targets.py` | 启动时 | 多实例冲突检测 |
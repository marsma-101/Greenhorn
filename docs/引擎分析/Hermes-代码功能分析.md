# Hermes Agent 代码功能分析

> 基于 `d:\program\GreenHorn\ai-agent\hermes\program\` 源码的深度分析
> 生成日期: 2026-08-02

---

## 1. 引擎基本信息

| 项目 | 详情 |
|------|------|
| **语言** | Python (≥3.11, <3.14) |
| **包名** | `hermes-agent` v0.17.0 |
| **构建系统** | setuptools (≥77.0, <83) |
| **主要依赖** | openai, httpx, pydantic, prompt_toolkit, fire, rich, tenacity, pyyaml, croniter, fastapi, uvicorn, websockets |
| **入口点** | `hermes` → `hermes_cli.main:main`; `hermes-agent` → `run_agent:main`; `hermes-acp` → `acp_adapter.entry:main` |
| **安装方式** | `pip install hermes-agent` 或 `uv sync`; 支持 Docker/Nix/Homebrew 打包 |
| **启动机制** | 交互式 CLI (`hermes chat`)、网关守护进程 (`hermes gateway`)、一次性查询 (`hermes -q`)、ACP 协议模式 (`hermes-acp`) |
| **代码位置** | `d:\program\GreenHorn\ai-agent\hermes\program\` |

### 关键架构模块

```
program/
├── run_agent.py          # AIAgent 核心类（对话循环、工具调用、流式处理）
├── cli.py                # 交互式 CLI 入口（prompt_toolkit TUI）
├── hermes_constants.py   # 全局常量、路径解析、环境检测
├── hermes_state.py       # SQLite 状态存储（会话历史、FTS5 全文搜索）
├── hermes_bootstrap.py   # Windows UTF-8 stdio 引导
├── toolsets.py           # 工具集定义与组合
├── model_tools.py        # 工具发现与调度（同步→异步桥接）
├── tools/                # 77+ 工具实现（文件/终端/浏览器/搜索/MCP...）
├── agent/                # Agent 子系统（对话循环、压缩、MoA、记忆、思考...）
├── gateway/              # 多平台网关（Telegram/Discord/Slack/微信/QQ/WhatsApp...）
├── hermes_cli/           # CLI 子命令实现（config/tools/skills/mcp/moa...）
├── acp_adapter/          # Agent Client Protocol 适配器
├── plugins/              # 可选插件（web搜索后端、memory、google_meet等）
├── skills/               # 内置技能包（SKILL.md 定义）
├── cron/                 # 定时任务调度
└── tui_gateway/          # TUI 网关服务端
```

---

## 2. 配置体系

### 2.1 配置文件位置与格式

| 配置文件 | 路径 | 格式 | 说明 |
|----------|------|------|------|
| 主配置 | `~/.hermes/config.yaml` | YAML | 用户级配置，优先级最高 |
| 项目配置 | `./cli-config.yaml` | YAML | 项目级回退配置 |
| 环境变量 | `~/.hermes/.env` | dotenv | API密钥等敏感信息 |
| 可选技能 | `~/.hermes/optional-skills/` | 目录 | 用户安装的可选技能 |
| 可选MCP | `~/.hermes/optional-mcps/` | 目录 | 用户安装的可选MCP服务器 |
| 记忆 | `~/.hermes/memories/` | Markdown | MEMORY.md + USER.md |

**配置加载顺序**（`cli.py:load_cli_config`）:
1. `~/.hermes/config.yaml` (用户配置)
2. `./cli-config.yaml` (项目配置)
3. 环境变量覆盖
4. `managed_scope` 管理员覆盖（最后生效）

### 2.2 关键配置字段

```yaml
# 模型配置
model:
  default: ""          # 默认模型名
  base_url: ""         # API端点
  provider: "auto"     # auto | openai | anthropic | openrouter | ...

# 终端配置
terminal:
  env_type: "local"    # local | docker | modal | singularity | ssh | daytona
  cwd: "."
  timeout: 300         # 命令超时(秒)
  home_mode: "auto"    # auto | real | profile
  docker_image: "nikolaik/python-nodejs:python3.11-nodejs20"

# 浏览器配置
browser:
  inactivity_timeout: 120
  engine: "auto"       # auto | chrome | lightpanda

# Agent配置
agent:
  max_turns: 90        # 最大工具调用迭代次数
  verbose: false
  reasoning_effort: "" # minimal | low | medium | high | xhigh
  service_tier: ""     # normal | priority

# 显示配置
display:
  streaming: true
  show_reasoning: false
  skin: "default"

# 工具集
toolsets: [...]        # 启用的工具集列表

# MCP服务器
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]

# 技能管理
skills:
  disabled: [...]      # 全局禁用的技能
  platform_disabled:   # 平台特定禁用
    telegram: [...]

# 委托/子代理
delegation:
  max_iterations: 45
  model: ""
  subagent_auto_approve: false
```

### 2.3 配置存储位置

- **配置文件**: `~/.hermes/config.yaml` (YAML, 可版本控制)
- **敏感信息**: `~/.hermes/.env` (dotenv 格式, 不提交到git)
- **会话数据**: `~/.hermes/sessions/` (SQLite数据库 `hermes_state.py`)
- **日志文件**: `~/.hermes/logs/` (agent.log, errors.log)
- **技能目录**: `~/.hermes/skills/` (用户技能 + 从仓库内置技能)
- **记忆文件**: `~/.hermes/memories/` (MEMORY.md, USER.md)

---

## 3. 能力清单

### 3.1 核心能力总表

| 能力 | 支持 | 代码证据 | 触发方式 |
|------|------|----------|----------|
| **流式对话** | ✅ | `agent/conversation_loop.py` `_fire_stream_delta()`; `gateway/stream_consumer.py` `GatewayStreamConsumer`; `gateway/stream_dispatch.py` `GatewayEventDispatcher` | 默认开启 (`display.streaming: true`); 同步 `stream_delta_callback` + asyncio 队列消费 |
| **思考/推理** | ✅ | `agent/think_scrubber.py` `StreamingThinkScrubber`; `agent/reasoning_timeouts.py` 推理模型超时地板; `hermes_constants.py:794` `VALID_REASONING_EFFORTS` | `reasoning_effort` 配置; 自动识别 `<think>`/`<thinking>`/`<reasoning>` 标签 |
| **工具调用** | ✅ | `tools/registry.py` `ToolRegistry`; `model_tools.py` `get_tool_definitions()/handle_function_call()`; `toolsets.py` 工具集定义 | 自动: LLM function calling; 77+ 已注册工具 |
| **文件操作** | ✅ | `tools/file_tools.py` `read_file/write_file/patch/search_files`; `tools/file_operations.py` `ShellFileOperations` | 自动: 作为工具注册; `file_read_max_chars` 限制 |
| **脚本执行** | ✅ | `tools/terminal_tool.py` 支持 local/docker/modal/singularity/ssh/daytona 后端; `tools/environments/` 环境实现 | 工具调用: `terminal` 工具; `code_execution` 工具 |
| **浏览器控制** | ✅ | `tools/browser_tool.py` (agent-browser CDP); `tools/browser_cdp_tool.py` (原生CDP); `tools/browser_supervisor.py` | 工具集: `browser`; 支持 Browser Use/ Browserbase/ 本地Chromium |
| **任务规划** | ✅ | `tools/todo_tool.py` `TodoStore`; `tools/delegate_tool.py` 子代理; `tools/kanban_tools.py` 看板 | `todo` 工具; `delegate_task` 子代理; `kanban` 工具集 |
| **搜索** | ✅ | `tools/web_tools.py` (Exa/Firecrawl/Parallel/Tavily); `tools/x_search_tool.py` (X/Twitter搜索); `tools/session_search_tool.py` (会话搜索) | 工具集: `web`, `search`, `x_search`; 插件化搜索后端 |
| **MCP协议** | ✅ | `tools/mcp_tool.py` 完整stdio/HTTP/SSE传输; `hermes_cli/mcp_*.py` MCP管理 | `mcp_servers` 配置; `hermes mcp` CLI命令 |
| **计算机控制** | ✅ | `tools/computer_use/` 包 (cua-driver); `tools/computer_use_tool.py` 注册 | 工具集: `computer_use`; macOS/Windows/Linux |
| **视觉分析** | ✅ | `tools/vision_tools.py`; 多后端路由(OpenRouter/Nous/Codex/Anthropic) | 工具集: `vision`; 工具: `vision_analyze` |
| **图像生成** | ✅ | `tools/image_generation_tool.py`; `agent/image_gen_registry.py` | 工具集: `image_gen`; 工具: `image_generate` |
| **语音/TTS** | ✅ | `tools/tts_tool.py`; `agent/tts_registry.py`; 支持 Edge/ ElevenLabs/ MiniMax | 工具集: `tts`; 工具: `text_to_speech` |
| **视频生成** | ✅ | `tools/video_generation_tool.py`; `tools/xai_video_tools.py` | 工具集: `video_gen` |
| **记忆系统** | ✅ | `tools/memory_tool.py`; `agent/memory_manager.py`; `agent/memory_provider.py` | 工具: `memory`; MEMORY.md + USER.md |
| **技能系统** | ✅ | `tools/skills_tool.py` (skills_list/skill_view); `tools/skill_manager_tool.py` (create/edit/delete); `hermes_cli/skills_hub.py` (技能商店) | 工具: `skills_list`, `skill_view`, `skill_manage`; progressive disclosure |
| **定时任务** | ✅ | `cron/scheduler.py`; `cron/jobs.py`; `tools/cronjob_tools.py`; `croniter`库 | 工具: `cronjob`; `hermes cron` CLI |
| **桌面项目** | ✅ | `tools/project_tools.py`; TUI专用 | 工具集: `project`; TUI网关加载 |
| **家庭助手** | ✅ | `tools/homeassistant_tool.py` (4个工具) | 工具集: `homeassistant`; Home Assistant REST API |
| **飞书集成** | ✅ | `tools/feishu_doc_tool.py`, `feishu_drive_tool.py` | 飞书插件; 文档/云盘操作 |
| **元宝集成** | ✅ | `tools/yuanbao_tools.py` | 元宝平台专用工具 |
| **Discord集成** | ✅ | `tools/discord_tool.py` | Discord平台消息工具 |
| **会话搜索** | ✅ | `tools/session_search_tool.py` | 工具: `session_search`; SQLite FTS5 |
| **代码执行** | ✅ | `tools/code_execution_tool.py` | 工具: `execute_code`; 受限沙箱 |
| **工具审批** | ✅ | `tools/approval.py`; `tools/write_approval.py`; `tools/slash_confirm.py` | 自动/手动审批; 危险命令拦截 |

### 3.2 工具注册表证据

所有工具通过 `tools/registry.py` 的 `ToolRegistry.register()` 自注册。以下为注册的关键工具：

**文件操作类** (`file_tools.py:1912-1915`):
- `read_file`, `write_file`, `patch`, `search_files`

**浏览器类** (`browser_tool.py:4418-4492`):
- `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_scroll`, `browser_back`, `browser_press`, `browser_get_images`, `browser_vision`, `browser_console`, `browser_cdp`, `browser_dialog`

**终端/进程类** (`terminal_tool.py:2970`, `process_registry.py:2227`):
- `terminal`, `process`, `read_terminal`, `close_terminal`

**技能类** (`skills_tool.py:1598,1633`, `skill_manager_tool.py:1423`):
- `skills_list`, `skill_view`, `skill_manage`

**搜索类** (`web_tools.py:964,974`, `x_search_tool.py:516`):
- `web_search`, `web_extract`, `x_search`

**规划/委托类** (`todo_tool.py:317`, `delegate_tool.py:3219`):
- `todo`, `delegate_task`

**MCP类** (`mcp_tool.py:4107,4144`):
- `mcp_tool_call`, `mcp_list_servers`

**看板类** (`kanban_tools.py:1563-1635`):
- `kanban_show`, `kanban_list`, `kanban_complete`, `kanban_block`, `kanban_heartbeat`, `kanban_comment`, `kanban_create`, `kanban_link`, `kanban_unblock`

---

## 4. 特有功能

### 4.1 MoA (Mixture of Agents) — 混合代理

**代码位置**: `agent/moa_loop.py`, `hermes_cli/moa_config.py`, `hermes_cli/moa_cmd.py`

MoA 是 Hermes 的多模型协作机制，通过 `/moa` 斜杠命令触发。

**核心机制**:
- **参考模型池** (Reference Models): 多个模型独立分析同一对话状态，给出建议
- **聚合模型** (Aggregator): 汇总所有参考模型的建议，做出最终决策
- **默认预设**: `gpt-5.5` + `deepseek-v4-pro` 作为参考，`claude-opus-4.8` 作为聚合
- **并发执行**: `_MAX_REFERENCE_WORKERS = 8` 个参考模型并行调用（`moa_loop.py:27`）
- **工具结果裁剪**: `_REFERENCE_TOOL_RESULT_BUDGET = 4000` 字符（`moa_loop.py:37`），避免大结果撑爆参考模型上下文
- **系统提示**: `_REFERENCE_SYSTEM_PROMPT` (moa_loop.py:46-64) 明确参考模型是"顾问"而非"执行者"
- **标记协议**: `MOA_MARKER_PREFIX = "__HERMES_MOA_TURN_V1__"` (moa_config.py:10)

**触发方式**: 用户输入 `/moa` 命令标记当前轮次为 MoA 模式

### 4.2 Skills (技能系统)

**代码位置**: `tools/skills_tool.py`, `tools/skill_manager_tool.py`, `agent/skill_utils.py`, `hermes_cli/skills_config.py`, `hermes_cli/skills_hub.py`

**Progressive Disclosure（渐进式披露）架构**:
1. **Tier 1 - 元数据**: `skills_list` 返回名称+描述（低成本）
2. **Tier 2 - 内容**: `skill_view` 按需加载完整 SKILL.md
3. **Tier 3 - 关联文件**: references/templates 按需加载

**技能结构** (`skills_tool.py:16-27`):
```
skills/
├── my-skill/
│   ├── SKILL.md           # YAML frontmatter + 指令
│   ├── references/        # 参考文档
│   ├── templates/         # 输出模板
│   └── scripts/           # 脚本
```

**SKILL.md Frontmatter** (`skills_tool.py:29-46`):
```yaml
---
name: skill-name
description: Brief description
version: 1.0.0
platforms: [macos, linux, windows]
prerequisites:
  env_vars: [API_KEY]
  commands: [curl, jq]
metadata:
  hermes:
    tags: [fine-tuning]
---
```

**技能管理**:
- `skill_manager_tool.py` — agent 自主创建/编辑/删除技能（`create`, `edit`, `patch`, `delete`, `write_file`, `remove_file`）
- `skills_hub.py` — 技能商店，从 GitHub/Hub 安装技能
- `skills_guard.py` — 技能安全扫描

### 4.3 Gateway (多平台网关)

**代码位置**: `gateway/run.py`, `gateway/stream_consumer.py`, `gateway/stream_dispatch.py`, `gateway/platforms/`

**支持的平台适配器** (共9+个):

| 平台 | 适配器文件 | 类名 |
|------|-----------|------|
| Telegram | `gateway/platforms/telegram.py` | `TelegramAdapter` |
| Discord | `gateway/platforms/discord.py` | `DiscordAdapter` |
| Slack | `gateway/platforms/slack.py` | `SlackAdapter` |
| WhatsApp (Cloud) | `gateway/platforms/whatsapp_cloud.py` | `WhatsAppCloudAdapter` |
| WhatsApp (Web) | `gateway/platforms/whatsapp_web.py` | `WhatsAppWebAdapter` |
| 微信/Weixin | `gateway/platforms/weixin.py` | `WeixinAdapter` |
| QQ机器人 | `gateway/platforms/qqbot/adapter.py` | `QQAdapter` |
| Signal | `gateway/platforms/signal.py` | `SignalAdapter` |
| MS Graph Webhook | `gateway/platforms/msgraph_webhook.py` | `MSGraphWebhookAdapter` |
| Webhook | `gateway/platforms/webhook.py` | `WebhookAdapter` |
| API Server | `gateway/platforms/api_server.py` | `APIServerAdapter` |
| BlueBubbles | `gateway/platforms/bluebubbles.py` | `BlueBubblesAdapter` |
| 元宝 | `gateway/platforms/yuanbao.py` | `YuanbaoAdapter` |
| 飞书 | `gateway/platforms/feishu.py` | `FeishuAdapter` |
| DingTalk | `gateway/platforms/dingtalk.py` | `DingTalkAdapter` |

**网关架构**:
- `GatewayRunner` (run.py) 管理所有平台适配器生命周期
- `GatewayStreamConsumer` (stream_consumer.py) 将同步 agent 回调桥接到异步平台投递
- `GatewayEventDispatcher` (stream_dispatch.py) 适配流式事件投递
- Agent 缓存: `_AGENT_CACHE_MAX_SIZE = 128`, `_AGENT_CACHE_IDLE_TTL_SECS = 3600` (run.py:66-67)
- 多平台复用: 同一 AIAgent 可在平台间切换

### 4.4 MCP (Model Context Protocol)

**代码位置**: `tools/mcp_tool.py`, `hermes_cli/mcp_*.py`

**支持的传输协议** (`mcp_tool.py`):
- **Stdio**: `command` + `args` 启动子进程
- **HTTP/StreamableHTTP**: `url` 直接连接远程MCP
- **SSE**: 传统 SSE 协议

**MCP 功能**:
- 自动发现服务器工具并注册到工具注册表
- 环境变量安全过滤
- 指数退避重连（最多5次）
- 服务器采样 (Sampling): MCP server 主动发起 LLM 请求
- 并发工具调用支持

### 4.5 Kanban (看板多智能体协作)

**代码位置**: `tools/kanban_tools.py`, `hermes_cli/kanban_db.py`, `hermes_cli/kanban_swarm.py`

- 结构化工具调用: `kanban_show/list/complete/block/heartbeat/comment/create/link/unblock`
- 工具集门控: 仅在 `HERMES_KANBAN_TASK` 环境变量或 `kanban` 工具集启用时可用
- SQLite 持久化 (`~/.hermes/kanban.db`)

### 4.6 Context Compression (上下文压缩)

**代码位置**: `agent/context_compressor.py`, `agent/context_engine.py`, `agent/context_breakdown.py`

- 自动压缩: 达到上下文50%阈值时触发 (`compression.threshold: 0.50`)
- 独立压缩模型: 可配置专用压缩模型 (`auxiliary.compression`)
- 压缩触发器: 保留工具调用，压缩对话历史

### 4.7 ACP (Agent Client Protocol)

**代码位置**: `acp_adapter/`

- 独立协议适配器: `acp_adapter/entry.py:main`
- 会话管理: `acp_adapter/session.py`
- 事件协议: `acp_adapter/events.py`
- 权限控制: `acp_adapter/permissions.py`

### 4.8 Computer Use (桌面控制)

**代码位置**: `tools/computer_use/`

- 通用桌面控制: 通过 cua-driver (MCP stdio) 实现
- 支持 macOS/Windows/Linux
- 后台操作: 不抢占用户光标/键盘焦点

---

## 5. 数据目录与状态

### 5.1 数据目录结构

```
~/.hermes/                              # HERMES_HOME (默认)
├── config.yaml                         # 主配置 (YAML)
├── .env                                # 环境变量/API密钥
├── agent.log                           # Agent运行日志
├── errors.log                          # 错误日志
├── sessions/                           # 会话数据
│   ├── hermes_state.db                 # SQLite (WAL模式, FTS5全文搜索)
│   └── *.jsonl                         # 会话JSONL导出
├── skills/                             # 用户技能
│   ├── my-skill/
│   │   ├── SKILL.md
│   │   └── ...
│   └── ...
├── optional-skills/                    # 可选技能包
├── optional-mcps/                      # 可选MCP服务器
├── memories/                          # 记忆
│   ├── MEMORY.md                       # Agent通用记忆
│   └── USER.md                         # 用户画像
├── cache/                              # 缓存
│   ├── images/                         # 图像缓存
│   └── ...
├── kanban.db                           # 看板数据库
├── node/                               # Hermes管理的Node.js
├── logs/                               # 运行日志
├── profiles/                           # 配置档案
│   ├── default/
│   ├── coder/
│   └── ...
├── platforms/                          # 平台配对数据
├── pairings/                           # 用户配对
├── home/                               # 容器HOME
└── active_profile                      # 当前激活的档案标记
```

### 5.2 会话数据格式

**代码位置**: `hermes_state.py`

- **存储引擎**: SQLite (WAL模式，支持并发读+单写)
- **FTS5 全文搜索**: 跨会话消息全文检索
- **会话链**: 通过 `parent_session_id` 支持压缩分叉和子代理会话
- **关键表结构**:
  - `sessions`: id, source, model, model_config, system_prompt, parent_session_id, cwd, started_at, ended_at, end_reason
  - `messages`: session_id, role, content, position
  - FTS5 虚拟表: 跨会话消息搜索

### 5.3 状态检测机制

**代码位置**: `hermes_constants.py`, `gateway/status.py`

| 检测项 | 代码位置 | 说明 |
|--------|----------|------|
| 容器检测 | `hermes_constants.py:is_container()` | Docker/Podman/Kubernetes 识别 |
| WSL检测 | `hermes_constants.py:is_wsl()` | `/proc/version` microsoft 标记 |
| Termux检测 | `hermes_constants.py:is_termux()` | Android Termux 环境 |
| 节点检测 | `hermes_constants.py:find_hermes_node_executable()` | 管理型Node.js运行时 |
| 浏览器检测 | `hermes_constants.py:agent_browser_runnable()` | agent-browser CLI 可用性 |
| 并发实例 | `gateway/dead_targets.py` | 多实例冲突检测 |
| 活跃档案 | `hermes_constants.py` + `active_profile` 文件 | Profile 切换检测 |

### 5.4 平台默认路径

| 平台 | HERMES_HOME |
|------|-------------|
| Windows | `%LOCALAPPDATA%\hermes` |
| Linux/macOS | `~/.hermes` |
| 自定义 | `HERMES_HOME` 环境变量指定 |

---

## 6. 已踩的坑与适配问题

### 6.1 Windows 平台

| 问题 | 代码证据 | 解决方案 |
|------|----------|----------|
| UTF-8 stdio | `hermes_bootstrap.py` | Windows 下强制设置 UTF-8 编码 |
| 进程管理 | `hermes_constants.py:psutil` | 使用 psutil 替代 POSIX-only 的 os.killpg |
| 日志轮转 | `pyproject.toml:concurrent-log-handler` | Windows 下使用 concurrent-log-handler 解决 PermissionError |
| 路径分隔符 | `cli.py:_normalize_git_bash_path()` | Git Bash 路径转换 |
| Node.js Shim | `hermes_constants.py:_candidate_node_command_names()` | `.cmd`/`.exe` 后缀处理 |
| 终端模式泄漏 | `cli.py:_reset_terminal_input_modes_on_exit()` | TUI 退出时重置输入模式 |

### 6.2 模型/API 适配

| 问题 | 代码证据 | 解决方案 |
|------|----------|----------|
| 推理模型超时 | `agent/reasoning_timeouts.py` | 为 o1/o3/R1/QwQ 等推理模型设置超时地板 |
| 流式思考标签 | `agent/think_scrubber.py` | `StreamingThinkScrubber` 处理 `<think>`/`<reasoning>` 标签 |
| Codex 推理重放 | `run_agent.py:_disable_codex_reasoning_replay()` | 禁用加密推理重放 |
| 令牌污染修复 | `agent/message_sanitization.py` | `_repair_tool_call_arguments`, surrogate 字符清理 |
| 上下文压缩 | `agent/context_compressor.py` | 独立压缩模型，保留工具调用 |
| 速率限制恢复 | `run_agent.py:_pool_may_recover_from_rate_limit()` | 凭证池轮转 vs 回退模型 |

### 6.3 部署/打包

| 问题 | 代码证据 | 解决方案 |
|------|----------|----------|
| 可选依赖懒加载 | `pyproject.toml:[all]` 注释 | 仅核心依赖进[all]，其余 lazy-install |
| Mini Shai-Hulud 蠕虫 | `pyproject.toml:30-33` | 精确版本锁定 (==X.Y.Z) |
| Nix 兼容性 | `nix/` 目录 | 完整 Nix 构建支持 |
| 打包数据文件 | `pyproject.toml:[tool.setuptools.data-files]` | locales + optional-mcps 打包进 wheel |
| Docker 镜像 | `Dockerfile`, `docker-compose.yml` | 精简 Docker 部署 |

### 6.4 安全相关

| 问题 | 代码证据 | 解决方案 |
|------|----------|----------|
| 密钥脱敏 | `agent/redact.py` | 输出中自动脱敏 API key |
| 技能安全扫描 | `tools/skills_guard.py` | 外部技能安装强制扫描 |
| SQL注入防护 | `tests/test_sql_injection.py` | 输入验证测试 |
| 会话ID路径安全 | `run_agent.py:_safe_session_filename_component()` | 路径遍历防护 |
| 文件读取限制 | `tools/file_tools.py:_DEFAULT_MAX_READ_CHARS = 100_000` | 单文件读取字符上限 |
| 子代理权限 | `tools/delegate_tool.py:DELEGATE_BLOCKED_TOOLS` | 子代理无法调用 delegate/memory/execute_code 等 |
| IPv4优先 | `hermes_constants.py:apply_ipv4_preference()` | 修复 IPv6 不可用环境的连接问题 |

---

## 附录: 文件索引

### 核心入口
| 文件 | 说明 |
|------|------|
| `hermes` | CLI launcher → `hermes_cli.main:main` |
| `cli.py` | 交互式终端界面 (prompt_toolkit) |
| `run_agent.py` | AIAgent 核心类 |
| `hermes_constants.py` | 常量/路径/环境检测 |
| `hermes_state.py` | SQLite 状态存储 |
| `hermes_bootstrap.py` | Windows UTF-8 引导 |
| `hermes_logging.py` | 日志系统 |
| `toolsets.py` | 工具集定义 |
| `model_tools.py` | 工具调度中心 |

### Agent 子系统
| 文件 | 说明 |
|------|------|
| `agent/conversation_loop.py` | 对话循环 (run_conversation) |
| `agent/moa_loop.py` | MoA 多模型协作 |
| `agent/think_scrubber.py` | 思考标签流式清理 |
| `agent/reasoning_timeouts.py` | 推理模型超时适配 |
| `agent/context_compressor.py` | 上下文压缩 |
| `agent/context_engine.py` | 上下文引擎 |
| `agent/memory_manager.py` | 记忆管理 |
| `agent/memory_provider.py` | 记忆提供者 |
| `agent/system_prompt.py` | 系统提示构建 |
| `agent/prompt_builder.py` | 提示词构建 |
| `agent/redact.py` | 敏感信息脱敏 |
| `agent/tool_guardrails.py` | 工具安全护栏 |
| `agent/trajectory.py` | 轨迹记录 |
| `agent/message_sanitization.py` | 消息清理/修复 |
| `agent/task_reasoning.py` | 任务推理 |

### 工具系统
| 文件 | 说明 |
|------|------|
| `tools/registry.py` | 工具注册表 |
| `tools/file_tools.py` | read/write/patch/search |
| `tools/terminal_tool.py` | 终端执行 (多后端) |
| `tools/browser_tool.py` | 浏览器自动化 |
| `tools/web_tools.py` | 网页搜索/抓取 |
| `tools/delegate_tool.py` | 子代理委托 |
| `tools/todo_tool.py` | 任务规划 |
| `tools/mcp_tool.py` | MCP 协议客户端 |
| `tools/vision_tools.py` | 视觉分析 |
| `tools/image_generation_tool.py` | 图像生成 |
| `tools/tts_tool.py` | 语音合成 |
| `tools/skills_tool.py` | 技能查询 |
| `tools/skill_manager_tool.py` | 技能管理 |
| `tools/memory_tool.py` | 记忆工具 |
| `tools/kanban_tools.py` | 看板协作 |
| `tools/computer_use/` | 桌面控制 |
| `tools/environments/` | 执行环境 (docker/modal/ssh/singularity) |
| `tools/code_execution_tool.py` | 代码执行沙箱 |

### 网关
| 文件 | 说明 |
|------|------|
| `gateway/run.py` | 网关主入口 |
| `gateway/stream_consumer.py` | 流式消费桥接 |
| `gateway/stream_dispatch.py` | 事件分发 |
| `gateway/delivery.py` | 消息投递 |
| `gateway/session.py` | 会话管理 |
| `gateway/platforms/` | 9+ 平台适配器 |

### CLI 子命令
| 文件 | 说明 |
|------|------|
| `hermes_cli/config.py` | 配置管理 |
| `hermes_cli/mcp_*.py` | MCP 管理 |
| `hermes_cli/moa_cmd.py` | MoA 命令 |
| `hermes_cli/skills_hub.py` | 技能商店 |
| `hermes_cli/skills_config.py` | 技能配置 |
| `hermes_cli/gateway.py` | 网关命令 |
| `hermes_cli/doctor.py` | 诊断命令 |
| `hermes_cli/setup.py` | 安装向导 |
| `hermes_cli/tools.py` | 工具配置 |
| `hermes_cli/bundles.py` | 包管理 |
| `hermes_cli/plugins.py` | 插件系统 |
| `hermes_cli/goals.py` | 目标管理 |
| `hermes_cli/cron.py` | 定时任务命令 |
| `hermes_cli/kanban.py` | 看板命令 |
| `hermes_cli/memory_setup.py` | 记忆设置 |

---

*本分析基于 Hermes Agent 源码 v0.17.0，代码路径: `d:\program\GreenHorn\ai-agent\hermes\program\`*
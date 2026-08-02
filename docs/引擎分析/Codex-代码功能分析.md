# Codex 引擎代码功能分析

> 基于 `d:\program\GreenHorn\ai-agent\codex\program\` 源码仓库的深度分析
> 分析时间：2026-08-03

---

## 1. 引擎基本信息

| 属性 | 详情 |
|------|------|
| **主要语言** | Rust (Cargo Workspace，多 crate 架构) |
| **辅助语言** | Node.js (启动器 `codex-cli/bin/codex.js`)、TypeScript (协议类型定义 `app-server-protocol/schema/typescript/v2/`) |
| **异步框架** | Tokio (全异步运行时) |
| **TUI 框架** | Ratatui (原 tui-rs) |
| **Rust 工具链** | 1.95.0 (`codex-rs/rust-toolchain.toml`) |
| **数据库** | SQLite (bundled，含 WAL 模式) |
| **序列化** | serde (JSON/TOML)、schemars (JSON Schema 生成) |
| **HTTP** | reqwest (HTTP 客户端)、hyper (HTTP 服务端) |
| **安装位置** | `d:\program\GreenHorn\ai-agent\codex\program\` |

### 启动机制

1. **CLI 入口**：`codex-cli/bin/codex.js` — Node.js 脚本，根据 OS/CPU 架构动态选择预编译的 Rust 二进制文件（如 `codex-linux-x64`、`codex-darwin-arm64`、`codex-windows-x64`）
2. **二进制分发**：`codex-cli/package.json` 通过 optionalDependencies 按平台安装预编译二进制
3. **app-server 模式**：`codex app-server` 子命令启动 JSON-RPC 服务端，支持 stdio/websocket/unix socket 三种传输
4. **TUI 模式**：`codex` 直接启动交互式终端界面

### Crate 架构概览

```
codex-rs/
├── core/               # 核心库：CodexThread、ThreadManager、agent、skills、tools
├── config/             # 配置系统：多层级加载、合并、验证
├── state/              # SQLite 状态管理：线程元数据、rollback、goals
├── rollout/            # Rollout 持久化：JSONL 读写、过滤策略
├── tools/              # 工具框架：ToolCall、ToolSpec、ToolRouter
├── exec/               # 非交互式执行引擎
├── app-server/         # JSON-RPC 2.0 服务端
├── app-server-protocol/# 协议类型定义 (Rust + TypeScript schema)
├── tui/                # 终端 UI
├── mcp-server/         # MCP (Model Context Protocol) 服务
├── skills/             # Skill 技能系统
├── prompts/            # Prompt 模板
├── model-provider/     # 模型提供者适配 (OpenAI、Bedrock、Ollama、LM Studio)
├── shell-command/      # Shell 命令执行
├── sandboxing/         # 沙箱隔离
├── ext/                # 扩展：web-search、image-generation、items
├── features/           # Feature flag 管理
├── otel/               # OpenTelemetry 追踪/指标
├── protocols/          # 协议定义 (ResponseItem、EventMsg)
└── ...                 # login、feedback、realtime、cloud-tasks 等
```

---

## 2. 配置体系

### 2.1 配置文件位置与格式

| 配置文件 | 路径 | 格式 |
|----------|------|------|
| 主配置 | `$CODEX_HOME/config.toml` | TOML |
| Profile 覆盖 | `$CODEX_HOME/config.toml` 中 `[profiles.<name>]` | TOML (内嵌) |
| 项目级配置 | 项目根目录 `.codex/config.toml` | TOML |
| 系统需求 | `$CODEX_HOME/requirements.toml` | TOML |
| MCP 服务器 | `$CODEX_HOME/config.toml` 中 `[mcp_servers.<name>]` | TOML |
| Skill 配置 | `$CODEX_HOME/config.toml` 中 `[skills]` | TOML |
| 环境变量 | `CODEX_HOME`、`CODEX_SQLITE_HOME` | 环境变量 |

> 常量定义：`codex-rs/config/src/lib.rs:35` — `pub const CONFIG_TOML_FILE: &str = "config.toml";`

### 2.2 配置层级体系

Codex 采用**多层级配置合并**机制，按优先级从低到高排列：

| 层级 | 来源 | 说明 |
|------|------|------|
| 1 | System | 系统级 `config.toml` (管理员设置) |
| 2 | MDM | 移动设备管理 (企业级) |
| 3 | EnterpriseManaged | 企业后端托管配置 |
| 4 | Project (根→cwd) | `.codex/config.toml` 从项目根目录到 cwd 逐层合并 |
| 5 | User (基础) | `$CODEX_HOME/config.toml` |
| 6 | User (Profile) | Profile V2 覆盖层 |
| 7 | SessionFlags | 会话级参数覆盖 |

> 代码证据：`codex-rs/config/src/state.rs:243-273` — `ConfigLayerStack` 结构体管理层级栈
> 代码证据：`codex-rs/config/src/state.rs:534-548` — `get_layers()` 方法按优先级排序获取层级

### 2.3 关键配置字段

**代码证据：** `codex-rs/config/src/config_toml.rs:147-413` — `ConfigToml` 结构体定义

| 字段 | 类型 | 说明 |
|------|------|------|
| `model` | `Option<String>` | 模型选择 (如 `gpt-5.1-codex`) |
| `model_provider` | `Option<String>` | 模型提供者 ID |
| `model_context_window` | `Option<i64>` | 上下文窗口大小 (token) |
| `approval_policy` | `Option<AskForApproval>` | 命令审批策略 (`always`/`never`/`on_request`) |
| `sandbox_mode` | `Option<SandboxMode>` | 沙箱模式 |
| `default_permissions` | `Option<String>` | 默认权限配置 |
| `personality` | `Option<Personality>` | 模型人格 (`friendly`/`pragmatic`/`none`) |
| `model_reasoning_effort` | `Option<ReasoningEffort>` | 推理努力程度 |
| `model_reasoning_summary` | `Option<ReasoningSummary>` | 推理摘要开关 |
| `instructions` | `Option<String>` | 系统指令 |
| `developer_instructions` | `Option<String>` | 开发者指令 |
| `mcp_servers` | `HashMap<String, McpServerConfig>` | MCP 服务器配置 |
| `sqlite_home` | `Option<AbsolutePathBuf>` | SQLite 数据库目录 |
| `log_dir` | `Option<AbsolutePathBuf>` | 日志目录 |
| `services_tier` | `Option<String>` | 服务等级 |
| `features` | (嵌套) | Feature flag 控制 |
| `permissions` | `Option<PermissionsToml>` | 权限配置表 |
| `memories` | `MemoriesToml` | 记忆/摘要配置 |
| `otel` | `OtelConfigToml` | OpenTelemetry 配置 |
| `tui` | `Tui` | TUI 外观/行为配置 |

### 2.4 配置存储位置

| 数据类型 | 位置 | 说明 |
|----------|------|------|
| 主配置 | `$CODEX_HOME/config.toml` | TOML 格式，用户可编辑 |
| SQLite 状态库 | `$CODEX_HOME/state/db.sqlite` | 包含 `runtime.db`、`log.db` 等 |
| 会话文件 | `$CODEX_HOME/sessions/*.jsonl` | JSONL 格式的 rollout 文件 |
| 归档会话 | `$CODEX_HOME/archived_sessions/*.jsonl` | 已归档的会话 |
| 历史记录 | `$CODEX_HOME/history.jsonl` | CLI 使用历史 |
| 记忆数据 | `$CODEX_HOME/memories/` | 记忆合并结果 |
| MCP 凭证 | `$CODEX_HOME/.credentials.json` 或 OS keyring | OAuth token 存储 |

---

## 3. 能力清单

### 3.1 能力总览表

| 能力 | 支持 | 代码证据 | 触发方式 |
|------|------|----------|----------|
| **流式对话** | ✅ | `codex-rs/protocol/src/protocol.rs` — `ResponseStream`、`EventMsg` 事件流；`codex-rs/core/src/event_mapping.rs` — 事件映射 | 通过 `turn/start` API，模型输出经 `item/agentMessage/delta` 事件流推送 |
| **思考/推理** | ✅ | `codex-rs/config/src/config_toml.rs:347` — `model_reasoning_effort: Option<ReasoningEffort>`；`codex-rs/protocol/src/config_types.rs:691` — `reasoning_effort()` 方法；`codex-rs/rollout/src/policy.rs:43` — `ResponseItem::Reasoning` 持久化 | `ReasoningEffort` 枚举控制 (`low`/`medium`/`high`)，通过 `AgentReasoning`/`AgentReasoningRawContent` 事件流式输出思考内容 |
| **工具调用** | ✅ | `codex-rs/tools/src/tool_call.rs:89-101` — `ToolCall` 结构体；`codex-rs/tools/src/tool_spec.rs` — `ToolSpec`/`ResponsesApiNamespace`；`codex-rs/core/src/tools/spec_plan.rs:114` — `build_tool_router()` | 模型通过 Responses API `function_call` 触发，经 `ToolRouter` → `ToolExecutor` 执行 |
| **文件操作** | ✅ | `codex-rs/core/src/app-server/README.md:200-209` — `fs/readFile`、`fs/writeFile`、`fs/createDirectory`、`fs/remove`、`fs/copy`、`fs/watch`；`codex-rs/file-system/` — 文件系统抽象层 | 通过 app-server `fs/*` JSON-RPC 方法或内置 `apply_patch` 工具 |
| **脚本执行** | ✅ | `codex-rs/exec/src/lib.rs` — 非交互式执行引擎；`codex-rs/core/src/tools/spec_plan.rs:719-768` — `add_shell_tools()` 注册 `exec_command`/`write_stdin`/`shell_command` 工具；`codex-rs/shell-command/` — Shell 执行后端 | 模型通过 `exec_command` 工具调用，支持 bash/zsh 执行，经沙箱隔离 |
| **浏览器控制** | ✅ | `codex-rs/config/src/config_requirements.rs:60-61` — `BrowserUseRequirementsToml`、`ComputerUseRequirementsToml`；`codex-rs/app-server-protocol/schema/typescript/v2/BrowserUseRequirements.ts` — `{ disableAutoReview: boolean \| null }`；`codex-rs/core/src/config/mod.rs` — `browser_use`/`computer_use` 特性开关 | 通过配置启用 `browser_use`/`computer_use`，Guardian 安全审查流程，`disableAutoReview` 控制自动审批 |
| **任务规划** | ✅ | `codex-rs/core/src/tools/handlers/plan.rs` — `PlanHandler` 实现 `update_plan` 工具；`codex-rs/core/src/tools/handlers/plan_spec.rs` — `create_update_plan_tool()`；`codex-rs/core/src/tools/spec_plan.rs:797-799` — `add_core_utility_tools()` 中注册 `PlanHandler` | 模型调用 `update_plan` function tool，触发 `PlanDelta`/`PlanUpdate` 事件流 |
| **搜索 (Web Search)** | ✅ | `codex-rs/ext/web-search/src/tool.rs:45-55` — `WebSearchTool` 结构体 (web.run 命名空间)；`codex-rs/ext/web-search/src/extension.rs` — 扩展注册；`codex-rs/core/src/web_search.rs` — `web_search_action_detail()` | 模型调用 `web.run` 工具，支持 `Search`/`OpenPage`/`FindInPage` 三种操作类型 |
| **多 Agent 协作** | ✅ | `codex-rs/core/src/tools/spec_plan.rs:886-971` — `add_collaboration_tools()` 注册 V1/V2 多 Agent 工具；`codex-rs/core/src/tools/handlers/multi_agents/` — `SpawnAgentHandler`/`SendInputHandler`/`WaitAgentHandler`/`CloseAgentHandler`；`codex-rs/core/src/tools/handlers/multi_agents_v2/` — V2 版本 | 模型调用 `spawn_agent` 创建子 Agent，V2 版本增加 `followup_task`/`interrupt_agent`/`list_agents` |
| **代码模式 (Code Mode)** | ✅ | `codex-rs/core/src/tools/spec_plan.rs:242-268` — `finalize_tool_router()` 中 code mode 工具增强；`codex-rs/core/src/tools/spec_plan.rs:507-597` — `register_code_mode_executors()` 注册 `execute`/`wait` 工具 | `ToolMode::CodeMode`/`CodeModeOnly` 模式，工具转为 Code Mode JSON 协议 |
| **实时语音对话** | ✅ | `codex-rs/app-server/README.md:183-187` — `thread/realtime/start`、`thread/realtime/appendAudio`、`thread/realtime/appendText`、`thread/realtime/stop`；`codex-rs/core/src/realtime_conversation.rs` — 实时对话管理；V1/V2/V3 三种协议版本 | 通过 `thread/realtime/start` 启动 Realtime 会话，支持音频/文本输入，BEM 信封协议 |
| **Guardian 审查** | ✅ | `codex-rs/core/src/guardian/` — 自动审查器；`codex-rs/core/src/guardian/policy.md` — 审查策略；`codex-rs/app-server/README.md:188` — `review/start` API | 通过 `review/start` 启动，内联审查在 turn 中进行，分离审查创建独立线程 |
| **MCP 协议** | ✅ | `codex-rs/mcp-server/src/codex_tool_runner.rs` — MCP 工具执行；`codex-rs/core/src/mcp/` — MCP 管理器；`codex-rs/app-server/README.md:247-250` — `mcpServerStatus/list`、`mcpServer/tool/call` | 配置 `[mcp_servers.<name>]` 后，MCP 工具自动注入工具列表 |
| **Memory 记忆** | ✅ | `codex-rs/state/src/runtime.rs` — `MemoryStore`；`codex-rs/config/src/types.rs:288-319` — `MemoriesToml` 配置；`codex-rs/config/src/config_toml.rs` — `memory_mode` 线程级设置 | 启动时自动从 rollout 提取记忆，支持 `generate_memories`/`use_memories` 开关 |
| **安全审查** | ✅ | `codex-rs/sandboxing/` — 沙箱隔离 (bubblewrap/Windows Sandbox)；`codex-rs/config/src/config_requirements.rs` — `SandboxMode`/`NetworkConstraints`；`codex-rs/core/src/exec_policy.rs` — 执行策略检查 | 多层安全：代码执行前审批 → 命令安全检查 → 沙箱隔离 → 网络策略限制 |

### 3.2 工具系统架构

```
                    ┌──────────────────┐
                    │   ToolRouter      │
                    │  (路由中心)       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐ ┌───▼────┐  ┌───────▼──────┐
    │  ToolRegistry   │ │ 命名空间 │  │ 动态工具     │
    │  (注册表)       │ │ 合并    │  │ (MCP/插件)   │
    └─────────┬──────┘ └────────┘  └───────┬──────┘
              │                              │
    ┌─────────▼──────────────────────────────▼──────┐
    │  ToolExecutor<ToolCall>  (统一执行接口)       │
    ├───────────────────────────────────────────────┤
    │ • ExecCommandHandler    (shell 执行)           │
    │ • ApplyPatchHandler     (补丁应用)             │
    │ • PlanHandler           (任务规划)             │
    │ • WebSearchTool         (网页搜索)             │
    │ • SpawnAgentHandler     (多 Agent)             │
    │ • CodeModeExecuteHandler(Code Mode)           │
    │ • ExtensionToolAdapter  (扩展工具)             │
    │ • ...更多                                     │
    └────────────────────────────────────────────────┘
```

> 代码证据：`codex-rs/core/src/tools/spec_plan.rs:114-167` — `build_tool_router()` 构建完整工具路由

---

## 4. 特有功能

### 4.1 App-Server Protocol (JSON-RPC 2.0)

Codex 的核心差异化特性：将整个引擎封装为 **JSON-RPC 2.0 服务**，可供 IDE 扩展等外部客户端调用。

**代码证据：** `codex-rs/app-server/README.md:20-56`

| 特性 | 说明 |
|------|------|
| **协议** | JSON-RPC 2.0 (无 `"jsonrpc":"2.0"` 头) |
| **传输层** | stdio (JSONL) / WebSocket / Unix Socket / 关闭 |
| **核心原语** | Thread（对话线程）→ Turn（对话轮次）→ Item（对话项） |
| **生命周期** | initialize → thread/start → turn/start → item/* 流 → turn/completed |
| **TypeScript 绑定** | `codex-rs/app-server-protocol/schema/typescript/v2/` — 自动生成的 TS 类型 |

**核心 API 方法（节选）：**

| 方法 | 功能 |
|------|------|
| `initialize` | 握手，声明客户端能力 |
| `thread/start` | 创建新对话 |
| `thread/resume` | 恢复已有对话 |
| `thread/fork` | 从已有对话分支 |
| `thread/list` | 分页列出历史对话 |
| `turn/start` | 发送用户输入并开始生成 |
| `turn/interrupt` | 中断正在进行的生成 |
| `command/exec` | 执行单条命令 (无需会话) |
| `fs/readFile`、`fs/writeFile` | 文件操作 |
| `model/list` | 列出可用模型 |
| `review/start` | 启动 Guardian 审查 |
| `skills/list`、`hooks/list` | 列出技能和钩子 |

### 4.2 Thread/Turn/Item 三层抽象

Codex 的会话管理采用三层抽象：

- **Thread**：持久化的对话容器，有唯一 ID，包含多个 Turn
- **Turn**：一次模型交互（用户输入 → 模型输出），包含多个 Item
- **Item**：最小对话单元（userMessage / agentMessage / agentReasoning / shellCommand / fileEdit / webSearchCall 等）

> 代码证据：`codex-rs/app-server/README.md:68-74`

### 4.3 多 Agent 协作系统

支持在单一对话中衍生子 Agent 执行并行/串行任务：

- **V1 模式**：`spawn_agent` → `send_input` → `wait_agent` → `close_agent`
- **V2 模式**：增加 `followup_task`（后续任务）、`interrupt_agent`（中断）、`list_agents`（列出）
- 子 Agent 有独立的模型配置和上下文

> 代码证据：`codex-rs/core/src/tools/spec_plan.rs:886-971`

### 4.4 Marketplace / Plugin 系统

内置插件市场系统：

- 远程市场：`marketplace/add`、`marketplace/remove`、`marketplace/upgrade`
- 插件管理：`plugin/list`、`plugin/install`、`plugin/read`、`plugin/uninstall`
- 插件可包含：Skills（技能）、Hooks（钩子）、Apps（连接器）、MCP Servers
- 支持远程插件目录搜索

> 代码证据：`codex-rs/app-server/README.md:223-230`

### 4.5 Code Mode

特殊的"代码模式"，将所有工具转为基于 JSON 的协议格式：

- `ToolMode::CodeMode`：正常模式 + Code Mode 工具
- `ToolMode::CodeModeOnly`：仅 Code Mode 工具
- 工具命名空间扁平化
- 工具描述转为代码可解析的格式

> 代码证据：`codex-rs/core/src/tools/spec_plan.rs:242-268`、`codex-rs/core/src/tools/spec_plan.rs:507-597`

### 4.6 Realtime 语音对话

支持实时语音交互（实验性）：

- V1/V2/V3 三种协议版本
- 支持 WebSocket 和 WebRTC 传输
- BEM（Brain-Emotion-Mind）信封协议
- 音频/文本双通道

> 代码证据：`codex-rs/app-server/README.md:183-187`

### 4.7 Guardian 自动审查

内置代码审查器：

- 内联审查：在 turn 中直接审查代码变更
- 分离审查：创建独立审查线程
- 支持 `review/start` API 触发

> 代码证据：`codex-rs/core/src/guardian/`

---

## 5. 数据目录与状态

### 5.1 数据目录结构

```
$CODEX_HOME/
├── config.toml                  # 主配置
├── auth.json                    # 认证凭证
├── .credentials.json            # MCP OAuth 凭证
├── state/
│   ├── db.sqlite                # SQLite 状态库
│   ├── runtime.db               # 运行时数据库
│   └── log.db                   # 日志数据库
├── sessions/
│   ├── <thread-id>.jsonl        # 会话 rollout 文件
│   └── ...
├── archived_sessions/
│   └── <thread-id>.jsonl        # 归档的会话
├── memories/                    # 记忆数据
├── log/                         # 日志文件
├── app-server-control/
│   └── app-server-control.sock  # Unix Socket 控制
├── skills/                      # 用户级 skill 定义
├── pets/<pet-id>/pet.json       # 终端宠物配置
├── themes/                      # 自定义主题
├── AGENTS.md                    # 项目级指令
└── history.jsonl                # CLI 历史
```

> 代码证据：`codex-rs/config/src/config_toml.rs:319-326` — `sqlite_home`、`log_dir` 路径配置

### 5.2 会话格式 (Rollout JSONL)

会话以 **JSONL（每行一个 JSON 对象）** 格式存储：

| RolloutItem 类型 | 说明 |
|-------------------|------|
| `ResponseItem::Message` | 用户/开发者消息 |
| `ResponseItem::AgentMessage` | 模型回复 |
| `ResponseItem::Reasoning` | 模型思考内容 |
| `ResponseItem::LocalShellCall` | 本地 Shell 调用 |
| `ResponseItem::FunctionCall` | 函数/工具调用 |
| `ResponseItem::FunctionCallOutput` | 工具调用输出 |
| `ResponseItem::WebSearchCall` | Web 搜索调用 |
| `ResponseItem::ImageGenerationCall` | 图片生成调用 |
| `ResponseItem::Compaction` | 上下文压缩 |
| `EventMsg::TurnStarted` | Turn 开始事件 |
| `EventMsg::TurnComplete` | Turn 完成事件 |
| `EventMsg::TokenCount` | Token 计数 |
| `EventMsg::ThreadGoalUpdated` | 目标更新 |
| ...更多 | |

**持久化策略：**
- `ThreadHistoryMode::Legacy`：传统模式，只持久化关键事件
- `ThreadHistoryMode::Paginated`：分页模式，持久化完整 `TurnItem`
- 不同 Item 类型有不同的持久化过滤规则

> 代码证据：`codex-rs/rollout/src/policy.rs:9-58` — `is_persisted_rollout_item()`、`should_persist_response_item()`

### 5.3 SQLite 状态库

| 数据库 | 用途 |
|--------|------|
| `runtime.db` | 线程元数据、目标存储、记忆存储、远程控制注册 |
| `log.db` | 操作日志、审计记录 |

**关键数据模型：**

| 模型 | 说明 |
|------|------|
| `ThreadMetadata` | 线程元数据 (ID、模型、cwd、gitInfo、memoryMode) |
| `ThreadGoal` / `ThreadGoalStatus` | 线程级目标及状态 |
| `LogEntry` / `LogRow` | 日志条目 |
| `Anchor` | 分页锚点 |
| `ThreadSection` | 线程分组/分区 |

> 代码证据：`codex-rs/state/src/runtime.rs:1-80`；`codex-rs/state/src/lib.rs:49-82`

### 5.4 状态检测机制

| 检测项 | 机制 |
|--------|------|
| SQLite 完整性 | `sqlite_integrity_check()` 完整性校验 |
| SQLite 损坏 | `is_sqlite_corruption_error()` 错误检测 + `backup_runtime_db_for_fresh_start()` 备份恢复 |
| SQLite 锁冲突 | `sqlite_error_detail_is_lock()` 锁检测 |
| 环境连接 | `EnvironmentConnected`/`EnvironmentDisconnected` 事件 |
| 模型可用性 | `model/list` API + NUX (New User Experience) 提示 |
| 特性开关 | `Feature` enum + `experimentalFeature/list` API |

> 代码证据：`codex-rs/state/src/lib.rs:69-76`

---

## 6. 已踩的坑 (适配问题)

### 6.1 配置层级复杂度

| 问题 | 说明 | 建议 |
|------|------|------|
| **多层级合并歧义** | 7 层配置优先级复杂，用户配置可能被 MDM/企业层覆盖 | 调试时使用 `config/read` API 查看最终生效配置 |
| **Profile V2 兼容性** | Profile 覆盖层与基础用户层叠加，需注意编辑目标 | 使用 `config/value/write` 或 `config/batchWrite` 原子写入 |
| **requirements.toml 限制** | 企业需求可能将某些配置设为只读 (`configRequirementReadonly`) | 通过 `configRequirements/read` 检查限制 |

### 6.2 会话持久化

| 问题 | 说明 | 建议 |
|------|------|------|
| **JSONL 格式脆弱** | 单行 JSON 损坏会导致整个会话恢复失败 | 定期备份 `sessions/` 目录 |
| **两种历史模式** | Legacy vs Paginated 模式的持久化策略不同 | Paginated 模式功能更完整，建议使用 |
| **Session 大小无硬性限制** | 长时间会话 JSONL 文件可能非常大 | 注意 `model_auto_compact_token_limit` 配置 |
| **Rollout 与 SQLite 双写** | 会话数据同时存在于 JSONL 文件和 SQLite 中 | SQLite 用于元数据查询，JSONL 用于完整恢复 |

### 6.3 工具集成

| 问题 | 说明 | 建议 |
|------|------|------|
| **工具暴露级别复杂** | `ToolExposure` 有 `Direct`/`Deferred`/`DirectModelOnly`/`Hidden` 四种 | 集成时明确工具的暴露级别 |
| **Code Mode 转换** | Code Mode 下工具协议完全不同 | 需要为 Code Mode 单独适配 |
| **MCP 工具认证** | OAuth 流程需 HTTP 回调服务器 | 配置 `mcp_oauth_callback_port` 避免端口冲突 |
| **并行工具调用** | 部分工具支持并行 (`supports_parallel_tool_calls`) ，部分不支持 | 注意工具的并行能力声明 |

### 6.4 沙箱与安全

| 问题 | 说明 | 建议 |
|------|------|------|
| **平台差异** | 沙箱实现依赖平台：Linux (bubblewrap)、Windows (WinSta0)、macOS (seatbelt) | 跨平台部署需分别测试 |
| **网络限制** | `NetworkConstraints` 可能阻止 MCP/Web 搜索等需要联网的功能 | 通过 `configRequirements/read` 检查网络策略 |
| **Windows 沙箱模式** | `WindowsSandboxModeToml` 支持 `Elevated`/`Unelevated` | 非管理员权限下需使用 `Unelevated` 模式 |

### 6.5 App-Server 集成

| 问题 | 说明 | 建议 |
|------|------|------|
| **Websocket 实验性** | WebSocket 传输标记为 experimental/unsupported | 生产环境使用 stdio 或 Unix Socket |
| **连接限流** | 过载时返回 `-32001` 错误码 | 客户端需实现指数退避重试 |
| **初始化握手** | 所有请求前必须完成 `initialize` → `initialized` 握手 | 未初始化请求会被拒绝 |
| **Notification 退订** | 不活跃线程 30 分钟后卸载 | 注意线程保活策略 |

### 6.6 模型提供者适配

| 问题 | 说明 | 建议 |
|------|------|------|
| **多提供者支持** | 内置 OpenAI/Bedrock/Ollama/LM Studio + 自定义 | 通过 `model_providers` 添加自定义提供者 |
| **能力差异** | 不同提供者的 `capabilities()` 返回不同 (web_search、namespace_tools 等) | 检查提供者能力后再启用相关功能 |
| **Reasoning Effort 兼容性** | 部分提供者不支持 `reasoning_effort` | 降级处理，仅在支持的模型上启用 |

### 6.7 性能与稳定性

| 问题 | 说明 | 建议 |
|------|------|------|
| **SQLite WAL 模式** | 需要 SQLite ≥ 3.51.0 以避免 WAL 重置损坏 | 确认 bundled SQLite 版本满足要求 |
| **Token 预算管理** | `tool_output_token_limit` 和上下文压缩影响对话质量 | 根据场景调整 `model_auto_compact_token_limit` |
| **内存占用** | 大型会话 + 多 Agent 场景内存占用高 | 使用 `thread/unsubscribe` 及时卸载非活跃线程 |

---

## 附录：关键文件索引

| 文件路径 | 用途 |
|----------|------|
| `codex-rs/config/src/config_toml.rs` | 主配置结构体 `ConfigToml` (400+ 字段) |
| `codex-rs/config/src/types.rs` | 配置子类型定义 (MemoriesToml、OtelConfigToml、Tui 等) |
| `codex-rs/config/src/state.rs` | 配置层级栈 `ConfigLayerStack` |
| `codex-rs/core/src/lib.rs` | 核心库入口，导出 CodexThread、ThreadManager 等 |
| `codex-rs/core/src/tools/spec_plan.rs` | 工具路由构建 `build_tool_router()` |
| `codex-rs/core/src/tools/handlers/plan.rs` | 任务规划工具 `PlanHandler` |
| `codex-rs/core/src/tools/handlers/multi_agents.rs` | 多 Agent 工具处理 |
| `codex-rs/core/src/web_search.rs` | Web 搜索详情格式化 |
| `codex-rs/tools/src/tool_call.rs` | ToolCall 通用结构 |
| `codex-rs/tools/src/tool_spec.rs` | ToolSpec、ResponsesApiNamespace 定义 |
| `codex-rs/ext/web-search/src/tool.rs` | WebSearchTool 实现 |
| `codex-rs/state/src/runtime.rs` | SQLite 运行时状态管理 |
| `codex-rs/state/src/lib.rs` | State crate 入口 |
| `codex-rs/rollout/src/policy.rs` | Rollout 持久化策略 |
| `codex-rs/app-server/README.md` | App-Server 协议文档 |
| `codex-rs/config/src/config_requirements.rs` | 配置需求/限制定义 |
| `codex-rs/protocol/src/config_types.rs` | 协议层配置类型 (ReasoningEffort、SandboxMode 等) |
| `codex-rs/exec/src/lib.rs` | 非交互式执行引擎 |
| `codex-rs/codex-cli/bin/codex.js` | Node.js 启动器 |
| `codex-rs/rust-toolchain.toml` | Rust 工具链版本 |
| `codex-rs/Cargo.toml` | Cargo workspace 定义 |
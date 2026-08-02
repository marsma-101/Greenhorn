# Reasonix 代码功能分析

> 基于 `ai-agent/reasonix/program/` 源码深度分析，覆盖引擎架构、配置体系、能力清单、特有功能、数据目录结构及适配注意事项。

---

## 1. 引擎基本信息

### 1.1 语言与框架

| 项目 | 详情 |
|------|------|
| **主语言** | Go 1.25.0（toolchain go1.26.5） |
| **桌面框架** | Wails v2（`github.com/wailsapp/wails/v2`） |
| **CLI TUI 框架** | Bubble Tea v2（`charm.land/bubbletea/v2`） + Bubbles v2 |
| **配置格式** | TOML（`github.com/BurntSushi/toml`） |
| **HTTP 服务** | 标准库 `net/http` |
| **MCP 协议** | 通过 stdio / HTTP 连接 MCP Server |
| **ACP 协议** | Agent Client Protocol v1（stdio JSON-RPC 2.0） |
| **数据库** | 无独立数据库，会话持久化使用 JSONL 文件 |

**关键依赖**（来自 `go.mod`）：

- `mvdan.cc/sh/v3` — Shell 解析与执行
- `golang.org/x/text` — 文本处理
- `golang.org/x/term` — 终端控制
- `github.com/spf13/pflag` — 命令行参数解析
- `github.com/tree-sitter/go-tree-sitter` — 多语言代码解析（JS/Python/Rust/TS）
- `github.com/yuin/goldmark` — Markdown 渲染

### 1.2 版本

- 当前版本在 `cmd/reasonix/main.go` 中定义为 `var version = "dev"`，由构建时 `-ldflags "-X main.version=..."` 注入
- `go.mod` 模块名：`reasonix`

### 1.3 安装位置

Reasonix 采用单二进制分发策略，编译后为单个可执行文件。安装位置因平台而异：

| 平台 | 安装路径 |
|------|----------|
| macOS | `/usr/local/bin/reasonix` 或 Homebrew 路径 |
| Linux | `/usr/local/bin/reasonix` |
| Windows | 安装目录下的 `reasonix.exe` |

### 1.4 启动机制

**CLI 启动流程**（`cmd/reasonix/main.go`）：

```
main()
  → runWithCrashCapture(os.Args[1:], version)
    → cli.Run(args, version)
      → config.Load()                           // 加载配置
      → 路由到子命令（run/chat/serve/setup/acp/mcp/remote/bot/doctor...）
      → boot.Build()                            // 组装 Controller
      → ctrl.Run(ctx, prompt)                   // 启动 Agent 执行
```

核心入口在 `internal/cli/cli.go:51` 的 `Run()` 函数，通过子命令路由分发到不同功能。

**桌面端启动**（`desktop/main.go` + `desktop/app.go`）：

基于 Wails v2 框架，通过 `wails dev` 开发或编译后的桌面应用，前端为 React/Vite 项目（`desktop/frontend/`），后端 Go 逻辑通过 Wails 绑定暴露给前端。

**后台/守护进程模式**：
- `reasonix serve` — HTTP+SSE 服务模式
- `reasonix bot start` — IM Bot 网关
- `reasonix acp` — ACP 协议 stdio 模式（供编辑器集成）

---

## 2. 配置体系

### 2.1 配置文件位置与格式

**全局配置文件**（TOML 格式）：

| 平台 | 路径 |
|------|------|
| macOS | `~/.reasonix/config.toml` |
| Linux | `~/.reasonix/config.toml` |
| Windows | `%APPDATA%\reasonix\config.toml` |

可通过 `REASONIX_HOME` 环境变量覆盖。

**项目级配置文件**：`./reasonix.toml`（项目根目录下）

**配置优先级**（`internal/config/config.go:1-2` 注释）：
```
命令行参数 > 项目 reasonix.toml > 全局 config.toml > 旧兼容路径 > 内置默认值
```

**凭据存储**：
- 全局凭据文件：`<Reasonix home>/.env`（`internal/config/paths.go:394-400`）
- Provider API Key 通过 `api_key_env` 字段指定环境变量名，不直接存入 TOML

### 2.2 关键配置字段

来自 `internal/config/config.go:40-76` 的 `Config` 结构体：

| 配置块 | 关键字段 | 说明 |
|--------|----------|------|
| `[config]` | `config_version` | 配置版本号 |
| `[default]` | `default_model` | 默认模型 |
| | `language` | UI/模型语言 |
| `[ui]` | `theme`, `cursor_shape`, `show_reasoning` | CLI 外观 |
| `[desktop]` | `theme`, `layout_style`, `language` | 桌面端外观 |
| `[agent]` | `system_prompt`, `temperature`, `planner_model` | Agent 行为 |
| | `subagent_model`, `max_subagent_depth` | 子 Agent 配置 |
| | `compact_ratio`, `context_window` | 上下文管理 |
| `[[providers]]` | `name`, `kind`, `base_url`, `model`, `api_key_env` | Provider 列表 |
| `[tools]` | — | 工具配置 |
| `[permissions]` | — | 权限控制 |
| `[sandbox]` | `workspace_root`, `allow_write`, `forbid_read` | 文件写入沙箱 |
| `[skills]` | `paths`, `disabled_skills` | Skill 发现路径 |
| `[bot]` | `enabled`, `qq/feishu/weixin` | Bot 平台配置 |
| `[mcp]` | — | MCP Server 配置 |
| `[telemetry]` | `cli_metrics` | 遥测开关 |

### 2.3 存储位置

来自 `internal/config/paths.go`：

| 数据类型 | 路径解析函数 | 默认路径 |
|----------|-------------|----------|
| 全局配置 | `UserConfigPath()` | `<home>/config.toml` |
| 全局凭据 | `UserCredentialsPath()` | `<home>/.env` |
| 会话文件 | `SessionDir()` | `<state>/sessions/` |
| 项目会话 | `ProjectSessionDir(root)` | `<state>/projects/<slug>/sessions/` |
| 归档 | `ArchiveDir()` | `<state>/archive/` |
| 缓存 | `CacheDir()` | 系统缓存目录 |
| 记忆 | `MemoryUserDir()` | `<state>/` |
| 远程状态 | `RemoteStateDir()` | `<home>/remote/` |
| 工作区租约 | `WorkspaceLeaseDir()` | `<cache>/workspace-leases/` |
| Delivery 工作树 | `DeliveryWorktreeDir()` | `<home>/worktrees/` |
| 全局命令 | `CommandDirs()` | `<home>/commands/` |
| Hook 配置 | `<home>/settings.json` | 全局 hooks |
| Skill 目录 | ConventionDirs | `.reasonix/` `.agents/` `.agent/` `.claude/` |

---

## 3. 能力清单

### 3.1 内建工具列表

通过 `tool.RegisterBuiltin()` 注册的编译期内建工具（来自 `internal/tool/builtin/`）：

| 工具名 | 文件 | 类型 | 说明 |
|--------|------|------|------|
| `bash` | `bash.go` | 执行 | Shell 命令执行，支持沙箱 |
| `read_file` | `readfile.go` | 只读 | 读取文本文件 |
| `write_file` | `writefile.go` | 写入 | 写入/覆盖文件 |
| `edit_file` | `editfile.go` | 写入 | 精确替换文件中的字符串 |
| `multi_edit` | `multiedit.go` | 写入 | 对单文件批量原子编辑 |
| `move_file` | `movefile.go` | 写入 | 移动/重命名文件 |
| `notebook_edit` | `notebookedit.go` | 写入 | 编辑 Jupyter Notebook 单元格 |
| `delete_range` | `delete_range.go` | 写入 | 按范围删除代码 |
| `delete_symbol` | `delete_symbol.go` | 写入 | 按符号删除代码 |
| `grep` | `grep.go` | 只读 | 正则搜索文件内容 |
| `glob` | `glob.go` | 只读 | 按 glob 模式查找文件 |
| `ls` | `ls.go` | 只读 | 列出目录内容 |
| `code_index` | `codeindex.go` | 只读 | 轻量代码符号索引 |
| `web_fetch` | `webfetch.go` | 只读 | HTTP/HTTPS 抓取 |
| `bash_output` | `bgjobs.go` | 只读 | 后台作业输出轮询 |
| `kill_shell` | `bgjobs.go` | 执行 | 终止后台作业 |
| `wait` | `bgjobs.go` | 只读 | 等待后台作业完成 |
| `todo_write` | `todo.go` | 计划 | 结构化任务列表 |
| `complete_step` | `completestep.go` | 计划 | 带证据的步骤完成 |

### 3.2 能力支持详情

| 能力 | 是否支持 | 代码证据 | 触发方式 |
|------|----------|----------|----------|
| **流式对话（Streaming Chat）** | ✅ | `internal/agent/agent.go` 的 `Run()` 方法通过 Provider 的流式 API 实现；`internal/agent/textsink.go` 处理文本增量输出 | CLI 交互模式 / `reasonix run` |
| **思考过程（Thinking）** | ✅ | Provider 配置中的 `Thinking`/`Effort` 字段（`config.go:1254-1255`），Agent 的 `reasoningLanguage`/`responseLanguage` 控制（`agent.go:582-598`），`UIConfig.ShowReasoning` 控制显示 | Provider 原生支持（如 Claude Extended Thinking、DeepSeek reasoning_effort），`--show-thinking` 或 `show_reasoning=true` |
| **工具调用（Tool Calling）** | ✅ | `internal/tool/tool.go` 的 `Tool` 接口和 `Registry`，`internal/agent/execute_one.go` 执行单次工具调用，`internal/agent/run_loop.go` 的工具循环 | 模型自动选择工具，或通过 `/` 斜杠命令 |
| **文件操作** | ✅ | `read_file`、`write_file`、`edit_file`、`multi_edit`、`move_file`、`delete_range`、`delete_symbol`、`notebook_edit` | 模型按需调用，受 `sandbox.write_root` 限制 |
| **脚本执行（Bash）** | ✅ | `internal/tool/builtin/bash.go`，基于 `mvdan.cc/sh/v3` 解析，支持沙箱隔离（`sandbox.Command`），Windows 上自动降级为 PowerShell | 模型调用 `bash` 工具，支持 `run_in_background=true` 后台执行 |
| **网页抓取** | ✅ | `internal/tool/builtin/webfetch.go`，支持 HTML→纯文本转换，SSRIP 防护，代理支持 | 模型调用 `web_fetch` 工具 |
| **代码搜索** | ✅ | `grep` 工具（正则搜索）、`glob` 工具（文件模式匹配）、`code_index` 工具（符号索引，基于 go/parser + tree-sitter） | 模型调用 `grep`/`glob`/`code_index` |
| **任务规划** | ✅ | `todo_write` 工具（结构化待办）、`complete_step` 工具（带证据完成）、Fleet 并行调度（`internal/agent/fleet.go`）、Task 子 Agent（`internal/agent/task.go`） | 自动规划 / Plan Mode（`Ctrl+Y` 切换） |
| **子 Agent / 任务委派** | ✅ | `TaskTool`（`internal/agent/task.go`）创建隔离上下文子 Agent，`FleetTool`（`fleet.go`）并行派发 2-64 个子任务，支持 `run_as` profile | 模型调用 `task`/`read_only_task`/`fleet` |
| **MCP 协议** | ✅ | `internal/mcpregistry/registry.go` 连接 MCP Server，`internal/control/mcp.go` 管理工具调用，支持 stdio 和 HTTP 传输 | `reasonix mcp` 命令或配置中添加 MCP Server |
| **ACP 协议（编辑器集成）** | ✅ | `internal/acp/protocol.go` 实现 ACP v1 协议，`internal/acp/server.go` 通过 JSON-RPC stdio 暴露 | `reasonix acp` 命令 |
| **IM Bot 网关** | ✅ | `internal/bot/gateway.go` 多平台 Bot（QQ 官方 API v2、飞书自建应用、微信 iLink），`internal/bot/feishu/`、`internal/bot/qq/`、`internal/bot/weixin/` | `reasonix bot start` 或桌面端内置 Bot |
| **HTTP 服务模式** | ✅ | `internal/cli/cli.go:736` 的 `runServe()`，支持 token/password 认证，SSE 事件流 | `reasonix serve` |
| **技能系统（Skills）** | ✅ | `internal/control/skill.go` 管理 Skill 集，Skill 以 Markdown 文件（SKILL.md）形式存在于 `.reasonix/skills/` 等目录 | `/skill` 命令或 Skill 选择器 |
| **Hook 系统** | ✅ | `internal/hook/hook.go` 支持 `PreToolUse`/`PostToolUse`/`PostLLMCall`/`SubagentStop`/`PreCompact` | `<home>/settings.json` 配置 |
| **记忆系统** | ✅ | `internal/control/memory.go` 的 `remember`/`forget` 工具，项目级和用户级记忆 | `remember`/`forget` 工具 |
| **模型切换** | ✅ | `internal/cli/model.go` 支持运行时切换模型，Controller 重建时保留对话历史 | CLI `/model` 命令，桌面端模型选择器 |
| **上下文压缩** | ✅ | `internal/agent/compact.go` 自动压缩过长会话，保留近期 tail，归档历史到 `archive/` | 自动触发或 CLI `/compact` |
| **沙箱隔离** | ✅ | `internal/sandbox/` 实现 OS 级文件写入和 Bash 沙箱，`config.SandboxConfig` 配置读写根目录 | 自动约束，Windows 上降级为逻辑约束 |
| **权限控制** | ✅ | `internal/agent/agent.go` 的 `Gate` 接口，支持 ask/auto/yolo 三种审批模式 | `--permission-mode` 或 `Ctrl+Y` 切换 |
| **桌面端 GUI** | ✅ | `desktop/app.go` 暴露 Wails 绑定方法，前端 React/Vite（`desktop/frontend/`）提供 Web UI | Wails `wails dev` 或编译后运行 |
| **远程 SSH 工作流** | ✅ | `internal/remote/` 模块，支持远程开发模式 | `reasonix remote` 命令 |

---

## 4. 特有功能

### 4.1 ACP 协议（Agent Client Protocol）

**代码位置**：`internal/acp/`

Reasonix 完整实现了 ACP v1 协议（`internal/acp/protocol.go:24`），通过 stdio JSON-RPC 2.0 与编辑器通信：

- **会话生命周期**：`session/new`、`session/load`、`session/resume`、`session/list`、`session/close`、`session/delete`
- **内容块支持**：文本、资源（embeddedContext）、图片、音频
- **权限请求**：`session/request_permission` → `allow_once`/`allow_always`/`reject_once`/`reject_always`
- **会话指引**：`_reasonix.io/session/steer` 供应商扩展方法
- **MCP 能力发现**：支持 HTTP 和 SSE 传输的 MCP Server

关键结构：
- `InitializeParams`/`InitializeResult`（`protocol.go:40-75`）
- `SessionPromptParams`/`SessionPromptResult`（`protocol.go:437-469`）
- `PermissionRequestParams`（`protocol.go:675-692`）

### 4.2 Delivery Profile（交付配置）

**代码位置**：`internal/agent/agent.go:56-62`

Delivery Profile 是一种运行时强制契约模式，要求在变更前完成以下流程：

```go
const DeliveryRuntimeMarker = `<delivery-runtime>
This session is in delivery-first mode. Before any state-changing tool call,
establish concrete, verifiable acceptance criteria with todo_write. After the
change, inspect the result, run relevant verification, and sign off each step
with complete_step citing the successful verification command. The host enforces
these gates and will reject mutation or finalization when evidence is missing.
</delivery-runtime>`
```

核心机制：
- `deliveryProfile` 字段控制是否启用（`agent.go:426`）
- `beginRunTurn()` 在每轮开始时注入 marker
- 强制执行 `todo_write` 建立验收标准 → `complete_step` 带证据签核
- 无证据的变更或最终回答会被拒绝

### 4.3 双模型协作（Coordinator）

**代码位置**：`internal/agent/coordinator.go`

Reasonix 支持 Planner-Executor 双模型协作：

- **Planner 模型**（`planner_model`）：负责规划，使用只读工具，产出执行计划
- **Executor 模型**：负责执行，完成所有工具调用
- **两种模式**：`plan` 模式（规划需用户确认）、`delivery` 模式（强制交付）

关键配置：
```toml
[agent]
planner_model = "deepseek/deepseek-v4-pro"    # 规划模型
subagent_model = "deepseek/deepseek-v4-flash" # 子 Agent 模型
max_subagent_depth = 2                        # 最大嵌套深度
```

### 4.4 Auto Guard（自动守卫）

**代码位置**：`internal/agent/agent.go:324-338`

Auto Guard 是一个独立的安全审查层：
- `RecoveryGate` 接口（`agent.go:326`）在每次工具调用前检查
- 独立的 `RecoveryModel`（可不同于主模型）执行审查
- 检测高风险变更、验证失败恢复
- `RecoveryAgentID`/`RecoveryTaskID` 标识来源

### 4.5 MCP 完整支持

**代码位置**：`internal/mcpregistry/`、`internal/control/mcp.go`

- MCP Server 可通过配置或 CLI `reasonix mcp` 添加
- 支持 stdio 和 HTTP/SSE 传输
- 自动发现 Server 能力并转为工具注册
- 安全分级：`readOnlyHint` 标记只读工具，`destructiveHint` 标记破坏性工具
- 内置能力路由：`use_capability`/`list_capabilities`/`inspect_capability`

### 4.6 证据驱动的任务完成

**代码位置**：`internal/tool/builtin/completestep.go`

`complete_step` 工具强制要求证据：
- 支持 5 种证据类型：`verification`（验证命令）、`review`（代码审查）、`diff`（变更差异）、`files`（文件列表）、`manual`（手动检查）
- 无证据的完成声明会被主机拒绝
- 与 `todo_write` 协作，自动推进任务列表

### 4.7 多平台 IM Bot

**代码位置**：`internal/bot/gateway.go`

支持三大 IM 平台作为 AI Bot：
- **QQ Bot**（`internal/bot/qq/`）：QQ 官方 Bot API v2，支持沙箱模式
- **飞书 Bot**（`internal/bot/feishu/`）：自建应用，支持 webhook 和 websocket 两种接入模式
- **微信 Bot**（`internal/bot/weixin/`）：iLink Bot API

功能包括：
- 消息合并窗口（debounce）
- 会话路由（Workspace Root 隔离）
- 配对机制（Pairing）
- 白名单/权限控制
- 桌面端"上帝视角"（/desktop watch 通知）

### 4.8 桌面端多标签管理

**代码位置**：`desktop/tabs.go`、`desktop/sessions.go`

- 多会话标签页支持
- 每个标签独立的模型选择、会话、设置
- 会话文件锁（Session Lease）防止多标签写入冲突
- 自动保存（`desktop/autosave_warn_test.go`）

### 4.9 Skill 自动发现

**代码位置**：`internal/control/skill.go`、`internal/config/config.go:928-983`

自动扫描以下目录中的 Skill（`.md` 文件）：
- `.reasonix/skills/`（本项目）
- `.agents/skills/`（兼容）
- `.agent/skills/`（兼容）
- `.claude/skills/`（兼容）
- 全局 `<home>/skills/`

支持 Skill 禁用列表（`disabled_skills`）和排除路径（`excluded_paths`）。

### 4.10 Run Loop 执行引擎

**代码位置**：`internal/agent/run_loop.go`

核心执行流程：
1. `beginRunTurn()` — 初始化证据、交付范围、背景作业
2. 构建 Provider 请求（含工具列表、系统提示、历史消息）
3. 流式接收模型回复（文本增量 + 工具调用）
4. 工具执行（含权限检查、沙箱约束、Hook 触发）
5. 结果反馈给模型
6. 循环直到模型返回最终文本
7. `handleFinalResponse()` — 最终检查（交付标准、证据完整性、上下文压缩）
8. 持久化会话状态

---

## 5. 数据目录与状态

### 5.1 会话存储

**格式**：JSONL（每行一条 JSON 消息）

**文件位置**：
- 全局会话：`<state>/sessions/<timestamp>-<id>.jsonl`
- 项目会话：`<state>/projects/<slug>/sessions/<timestamp>-<id>.jsonl`

**结构**（`internal/agent/session.go:16-46`）：
```go
type Session struct {
    Messages       []provider.Message  // 消息历史
    version        uint64              // 内部版本号
    rewriteVersion int                 // 重写次数
    persistedRewriteVersion int         // 已持久化的重写版本
    rawMessages    []provider.Message  // 原始消息（加载时规范化前）
}
```

**消息格式**（`provider.Message`）：
- `Role`：system / user / assistant / tool
- `Content`：消息内容
- `ToolCalls`：工具调用列表
- `ToolCallID`：关联的工具调用 ID
- 支持 reasoning_content、thinking 等扩展字段

**会话文件锁**（`internal/agent/session_lease.go`）：
- `.jsonl.lock` — 传统文件锁
- `.jsonl.lease.lock` — 租约锁
- `.jsonl.lease.json` — 租约信息

### 5.2 配置数据

| 数据 | 默认路径 | 说明 |
|------|----------|------|
| `config.toml` | `<home>/config.toml` | 全局配置 |
| `.env` | `<home>/.env` | Provider API Key |
| `settings.json` | `<home>/settings.json` | 全局 Hooks 配置 |
| `commands/` | `<home>/commands/` | 全局斜杠命令 |
| `skills/` | `<home>/skills/` | 全局 Skill |
| `memory/` | `<state>/memory/` | 用户级记忆 |
| `projects/<slug>/` | `<state>/projects/` | 项目级记忆 |
| `archive/` | `<state>/archive/` | 压缩归档 |
| `remote/` | `<home>/remote/` | SSH known_hosts |
| `worktrees/` | `<home>/worktrees/` | Delivery 工作树 |

### 5.3 状态检测

**会话恢复**（`internal/agent/session.go`、`internal/agent/session_lease.go`）：
- `LoadSession(path)` — 从 JSONL 加载会话
- `ListSessions(dir)` — 列出所有会话
- `ErrSessionLeaseHeld` — 会话被其他进程持有时返回
- 支持 `.cleanup-pending.json` 标记清理中会话

**引擎状态检测**：
Reasonix 本身无独立状态 API，状态通过以下方式暴露：
- `session.Messages` 长度判断会话是否存在
- `cache` 目录下的缓存文件
- Bot 网关连接状态（`gateway.go` 的 `Enabled` 字段）
- 进程存活检测（PID 文件、端口监听）

---

## 6. 已踩的坑（适配注意事项）

### 6.1 会话格式差异

| 问题 | 说明 |
|------|------|
| **Reasonix 使用 JSONL** | 与 PI 的 JSON 数组格式不同，需要逐行解析 |
| **消息 Role 映射** | Reasonix 使用 `provider.RoleSystem`/`RoleUser`/`RoleAssistant`/`RoleTool`，需映射到 PI v3 的 `role` 字段 |
| **ToolCall 结构** | Reasonix 的 `ToolCalls` 包含 `ID`、`Function.Name`、`Function.Arguments`，与 PI v3 的 `toolCall` 格式不同 |
| **流式格式** | Reasonix 原生支持 SSE 事件流（`session/update` notifications），需要适配到目标引擎的流式协议 |

### 6.2 配置加载

| 问题 | 说明 |
|------|------|
| **双配置文件** | 全局 `config.toml` 和项目 `reasonix.toml` 可能同时存在，加载逻辑复杂 |
| **凭据分离** | API Key 在 `.env` 中，TOML 中只存环境变量名，集成时需读取 `.env` |
| **配置迁移** | 存在 `MigrateLegacyIfNeeded()` 自动迁移机制，首次启动可能触发 |

### 6.3 工具系统适配

| 问题 | 说明 |
|------|------|
| **沙箱约束** | 文件操作受 `workspace_root` 和 `forbid_read` 限制，外部集成需正确设置根目录 |
| **Windows 特殊处理** | `BashModeForGOOS()` 在 Windows 上强制返回 `off`，不支持 OS 级 Bash 沙箱（`config.go:1128-1130`） |
| **工具注册时机** | 内建工具通过 `init()` 注册，第三方工具需通过 MCP 或 plugin 机制接入 |
| **Preview 机制** | 写入工具支持 `Preview()` 预览变更，权限系统依赖此特性做审批 |

### 6.4 ACP 协议适配

| 问题 | 说明 |
|------|------|
| **stdio vs HTTP** | ACP 默认使用 stdio JSON-RPC，嵌入 Web 服务时需使用 `reasonix serve` |
| **会话状态同步** | ACP 的 `session/new`/`session/load` 与 RESTful 的会话管理需映射 |
| **权限请求** | `session/request_permission` 是异步双向通信，需要实现等待/超时机制 |

### 6.5 Bot 网关适配

| 问题 | 说明 |
|------|------|
| **平台依赖** | QQ/飞书/微信 Bot 各有独立 SDK 和认证流程 |
| **消息去重** | `IgnoreSelfMessages` 和 `SelfUserIDs` 配置需要正确设置 |
| **Webhook 端口** | 飞书 webhook 模式需要固定端口（`WebhookPort`） |
| **沙箱模式** | QQ Bot 的 `sandbox` 模式使用不同的 API 端点 |

### 6.6 跨平台差异

| 问题 | 说明 |
|------|------|
| **Windows 路径** | 使用 `filepath.Join` 处理，但 Reasonix 内部统一使用正斜杠 |
| **Windows 沙箱** | Bash 工具在 Windows 上自动降级到 PowerShell，且无 OS 级沙箱 |
| **文件编码** | Reasonix 自动检测 GBK/UTF-16/BOM 编码并保留（`fileutil/encoding`），其他引擎可能不支持 |
| **单实例锁** | Windows 使用命名互斥量，Unix 使用文件锁 |

### 6.7 远程工作流

| 问题 | 说明 |
|------|------|
| **SSH 配置** | 远程模式需要配置 SSH 连接（`remote/known_hosts`） |
| **工作树** | Delivery 模式使用 Git worktree 隔离变更，需要 Git 支持 |
| **端口转发** | 远程开发涉及端口映射和文件同步 |

---

## 附录：关键文件索引

| 分类 | 文件路径 | 功能 |
|------|----------|------|
| **入口** | `cmd/reasonix/main.go` | CLI 入口 |
| | `desktop/main.go` | 桌面端入口 |
| **配置** | `internal/config/config.go` | 配置结构体定义 |
| | `internal/config/paths.go` | 路径解析 |
| | `internal/config/load.go` | 配置加载 |
| **Agent 核心** | `internal/agent/agent.go` | Agent 结构体与 Run 方法 |
| | `internal/agent/run_loop.go` | 执行循环 |
| | `internal/agent/session.go` | 会话结构 |
| | `internal/agent/save.go` | 会话持久化 |
| | `internal/agent/coordinator.go` | 双模型协调 |
| | `internal/agent/fleet.go` | 并行子任务 |
| | `internal/agent/task.go` | 子 Agent 任务 |
| **工具系统** | `internal/tool/tool.go` | Tool 接口与 Registry |
| | `internal/tool/builtin/` | 16 个内建工具 |
| **CLI** | `internal/cli/cli.go` | CLI 路由与子命令 |
| | `internal/cli/chat_tui.go` | 交互式 TUI |
| **桌面** | `desktop/app.go` | Wails 绑定（核心 API） |
| | `desktop/sessions.go` | 会话管理 |
| | `desktop/tabs.go` | 多标签 |
| **ACP** | `internal/acp/protocol.go` | ACP 协议定义 |
| | `internal/acp/server.go` | ACP 服务实现 |
| | `internal/acp/dispatch.go` | 事件分发 |
| **Bot** | `internal/bot/gateway.go` | Bot 网关核心 |
| | `internal/bot/qq/gateway.go` | QQ Bot 适配 |
| | `internal/bot/feishu/feishu.go` | 飞书 Bot 适配 |
| | `internal/bot/weixin/weixin.go` | 微信 Bot 适配 |
| **MCP** | `internal/mcpregistry/registry.go` | MCP 注册中心 |
| | `internal/control/mcp.go` | MCP 控制器 |
| **Boot** | `internal/boot/boot.go` | 启动组装 |
| | `internal/boot/resolver.go` | 模型/Provider 解析 |
| **文档** | `docs/CONFIG_PATHS.zh-CN.md` | 配置路径说明 |
| | `docs/ACP.zh-CN.md` | ACP 协议说明 |
| | `docs/BOT_GUIDE.zh-CN.md` | Bot 使用指南 |

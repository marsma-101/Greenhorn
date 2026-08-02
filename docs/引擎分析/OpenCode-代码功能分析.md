# OpenCode 代码功能分析

## 1. 引擎基本信息

| 项目 | 详情 |
|------|------|
| **项目名称** | OpenCode (opencode) |
| **语言/框架** | TypeScript + Bun 运行时 + Effect v4 函数式框架 |
| **UI 框架** | Solid.js (TUI 和 Web 前端) |
| **数据库** | SQLite (通过 Drizzle ORM) |
| **版本** | 1.18.10 (packages/core/package.json, packages/opencode/package.json) |
| **包管理器** | Bun 1.3.14 (monorepo workspaces) |
| **仓库地址** | https://github.com/anomalyco/opencode |
| **安装方式** | curl -fsSL https://opencode.ai/install \| bash 或 npm/bun 本地构建 |

### 1.1 核心包结构

| 包名 | 路径 | 职责 |
|------|------|------|
| `@opencode-ai/core` | `packages/core/` | 核心服务层：配置、会话、工具、Agent、权限、文件系统、系统上下文 |
| `@opencode-ai/llm` | `packages/llm/` | LLM 协议层：Provider 路由、协议适配、LLMEvent 流、Tool 定义与分发 |
| `opencode` | `packages/opencode/` | CLI 入口、会话运行时编排、TUI 集成 |
| `@opencode-ai/schema` | `packages/schema/` | 共享 Schema 定义（Agent、Session、Prompt、Skill、Plugin 等） |
| `@opencode-ai/protocol` | `packages/protocol/` | HTTP API 协议定义（API Groups、中间件） |
| `@opencode-ai/server` | `packages/server/` | HTTP 服务器实现（路由、处理器、认证） |
| `@opencode-ai/sdk` | `packages/sdk/js/` | JavaScript SDK（客户端/服务端/V2 API） |
| `@opencode-ai/tui` | `packages/tui/` | 终端 UI 组件（Solid.js TUI） |
| `@opencode-ai/plugin` | `packages/plugin/` | 插件系统（Shell/Tool/TUI 插件接口） |
| `@opencode-ai/codemode` | `packages/codemode/` | 代码模式（Code Mode）支持 |

### 1.2 启动机制

**CLI 入口**: `packages/opencode/src/index.ts`

使用 `yargs` 构建命令行界面，支持以下子命令：
- `opencode run` — 启动交互式 TUI 会话
- `opencode serve` — 启动 HTTP API 服务
- `opencode tui` — 启动 TUI 线程
- `opencode mcp` — MCP 服务器管理
- `opencode github` — GitHub 集成
- `opencode web` — Web 应用
- `opencode models` / `opencode providers` — 模型/提供者管理
- `opencode session` — 会话管理
- `opencode plug` — 插件管理
- `opencode acp` — ACP 协议

**启动流程**:
1. `yargs` 解析 CLI 参数 → 中间件设置环境变量 (`AGENT=1`, `OPENCODE=1`)
2. 加载配置层（Config）→ 发现并合并 `opencode.json` / `opencode.jsonc`
3. 初始化 Location 层 → 装载工具、Agent、Catalog、Skill、Plugin 等服务
4. 启动 SessionRunner → 执行 LLM 流式推理循环

**开发模式**: `bun dev` 从 `packages/opencode` 启动，运行 `src/index.ts` 并附带 `--conditions=browser`。

---

## 2. 配置体系

### 2.1 配置文件位置与格式

**文件名**: `opencode.json` 或 `opencode.jsonc`（支持 JSONC 格式，含注释）

**发现顺序**（优先级从低到高）:
1. 全局配置目录 (`xdgConfig/opencode/`)
2. 项目根目录的 `opencode.json` / `opencode.jsonc` 文件
3. 上级目录中发现的 `.opencode/` 目录
4. 当前项目 `.opencode/` 目录中的文件

**代码证据**:
- `packages/core/src/config.ts:142` — 定义文件名列表 `["opencode.json", "opencode.jsonc"]`
- `packages/core/src/config.ts:179-203` — 配置发现与合并逻辑

### 2.2 关键配置字段

| 字段 | 类型 | 说明 | 代码位置 |
|------|------|------|----------|
| `shell` | string | 默认 Shell 路径 | `config.ts:33-35` |
| `model` | string | 默认模型 | `config.ts:37-39` |
| `default_agent` | string | 默认 Agent | `config.ts:39-41` |
| `autoupdate` | boolean/"notify" | 自动更新 | `config.ts:42-46` |
| `share` | "manual"/"auto"/"disabled" | 会话分享控制 | `config.ts:47-49` |
| `username` | string | 显示用户名 | `config.ts:57-59` |
| `permissions` | Permission.Ruleset | 工具权限规则 | `config.ts:60-62` |
| `agents` | Record<string, ConfigAgent.Info> | Agent 定义 | `config.ts:63-65` |
| `snapshots` | boolean | 快照/撤销功能 | `config.ts:66-68` |
| `watcher` | ConfigWatcher.Info | 文件监控配置 | `config.ts:69-71` |
| `formatter` | ConfigFormatter.Info | 代码格式化配置 | `config.ts:72-74` |
| `lsp` | ConfigLSP.Info | 语言服务器配置 | `config.ts:75-77` |
| `mcp` | ConfigMCP.Info | MCP 服务器配置 | `config.ts:84-86` |
| `skills` | string[] | 额外 Skill 路径/URL | `config.ts:90-92` |
| `commands` | Record<string, ConfigCommand.Info> | 自定义斜杠命令 | `config.ts:93-95` |
| `instructions` | string[] | 环境指令路径 | `config.ts:96-98` |
| `references` | ConfigReference.Info | 外部上下文引用 | `config.ts:99-101` |
| `plugins` | ConfigPlugin.Plugins | 外部插件列表 | `config.ts:102-104` |
| `providers` | Record<string, ConfigProvider.Info> | Provider 配置 | `config.ts:106` |
| `experimental` | ConfigExperimental.Experimental | 实验性功能 | `config.ts:105` |

### 2.3 MCP 服务器配置

**代码证据**: `packages/core/src/config/mcp.ts`

支持两种 MCP 服务器类型：
- **Local**: 本地进程（`command`、`cwd`、`environment`、`timeout`）
- **Remote**: 远程 HTTP（`url`、`headers`、`oauth`、`timeout`）

### 2.4 存储位置

**代码证据**: `packages/core/src/global.ts`

使用 XDG 目录规范：
- `data`: `xdgData/opencode/` → 数据库、日志、仓库
- `config`: `xdgConfig/opencode/` → 全局配置
- `state`: `xdgState/opencode/` → 运行时状态
- `cache`: `xdgCache/opencode/` → 缓存、二进制
- `bin`: `{cache}/bin/` → 可执行文件
- `log`: `{data}/log/` → 日志

---

## 3. 能力清单

### 3.1 能力总览

| 能力 | 支持 | 代码证据 | 触发方式 |
|------|------|----------|----------|
| **流式对话 (Streaming Chat)** | ✅ | `packages/llm/src/llm.ts:47` — `LLMClient.stream()`<br>`packages/core/src/session/runner/llm.ts:232` — `llm.stream(request)`<br>`packages/llm/src/schema/events.ts:84-104` — TextDelta/TextStart/TextEnd 事件 | SessionRunner 启动 LLM 流式请求，模型输出通过 `text-delta` 事件逐步推送 |
| **思考/推理 (Thinking/Reasoning)** | ✅ | `packages/llm/src/schema/events.ts:106-126` — ReasoningStart/ReasoningDelta/ReasoningEnd 事件<br>`packages/llm/src/schema/events.ts:57` — `reasoningTokens` Usage 字段<br>`packages/llm/src/schema/events.ts:572` — `LLMResponse.reasoning` getter | 模型原生支持（如 Claude Extended Thinking、OpenAI o-series），通过 `reasoning-delta` 事件流推送 |
| **工具调用 (Tool Calling)** | ✅ | `packages/llm/src/llm.ts:19` — `makeTool()` / `toDefinitions()`<br>`packages/llm/src/llm.ts:110-144` — `generateObject()` 强制工具调用<br>`packages/core/src/session/runner/llm.ts:242-271` — 工具调用执行与结果回写 | 模型输出 `tool-call` 事件 → ToolRegistry 调度 → 执行结果通过 `tool-result` 事件回写 |
| **文件操作 (File Operations)** | ✅ | `packages/core/src/tool/read.ts` — read 工具（含分页、目录列表、图片读取）<br>`packages/core/src/tool/write.ts` — write 工具<br>`packages/core/src/tool/edit.ts` — edit 工具（精确字符串替换，含 diff 预览） | Agent 在会话中调用，通过 `ToolRegistry` 注册，受权限系统控制 |
| **脚本执行 (Script/Shell Execution)** | ✅ | `packages/core/src/tool/bash.ts:18-201` — bash 工具（Shell 命令执行）<br>`packages/core/src/tool/bash.ts:49` — Windows 自动检测 COMSPEC/cmd.exe<br>`packages/core/src/tool/bash.ts:19` — 默认超时 2 分钟，最大 10 分钟 | Agent 调用 bash 工具执行任意 Shell 命令，含超时、输出截断、外部目录检测 |
| **代码搜索 (Search)** | ✅ | `packages/core/src/tool/glob.ts` — glob 工具（文件路径搜索，基于 ripgrep）<br>`packages/core/src/tool/grep.ts` — grep 工具（正则内容搜索，基于 ripgrep）<br>`packages/core/src/tool/glob.ts:76` — `ripgrep.glob()`<br>`packages/core/src/tool/grep.ts:97` — `ripgrep.grep()` | Agent 调用 glob/grep 工具进行文件/内容搜索 |
| **Skill 系统** | ✅ | `packages/core/src/skill.ts` — SkillV2 服务<br>`packages/core/src/tool/skill.ts` — skill 工具<br>`packages/core/src/skill.ts:73-105` — Skill 加载逻辑 | Agent 调用 skill 工具加载特定技能，Skill 定义为 SKILL.md 含 YAML Frontmatter |
| **Agent 系统** | ✅ | `packages/core/src/agent.ts` — AgentV2 服务<br>`packages/core/src/catalog.ts` — Model/Provider Catalog<br>`packages/core/src/agent.ts:10` — 默认 Agent: "build" | 配置文件定义自定义 Agent，或使用内置 "build" Agent |
| **任务规划 (Task Planning)** | ✅ | `packages/core/src/session/sql.ts:100-117` — TodoTable 数据库表<br>`packages/core/src/session/runner/llm.ts:202-203` — Agent step 限制<br>`packages/core/src/session/runner/max-steps.ts` — MAX_STEPS_PROMPT | 会话内 Todo 列表、Agent 最大步数限制、上下文压缩 |
| **权限控制 (Permission)** | ✅ | `packages/core/src/permission.ts` — PermissionV2 服务<br>`packages/core/src/permission.ts:76-86` — `evaluate()` 规则匹配<br>`packages/core/src/permission.ts:190-218` — `ask()`/`assert()` 交互式授权 | 基于通配符的 allow/deny/ask 三级权限，支持 "always" 记忆授权 |
| **MCP 协议支持** | ✅ | `packages/core/src/config/mcp.ts` — MCP 配置（Local/Remote）<br>`packages/opencode/src/index.ts:82` — `McpCommand`<br>`packages/core/src/skill.ts:76` — Skill URL 源加载 | 通过配置文件定义 MCP 服务器，支持本地进程和远程 HTTP |
| **插件系统 (Plugin)** | ✅ | `packages/core/src/plugin.ts` — PluginV2 服务<br>`packages/core/src/plugin.ts:43-83` — `add()`/`remove()`/`wait()` 生命周期 | 配置文件定义插件包列表，动态加载/卸载 |
| **HTTP API 服务器** | ✅ | `packages/server/src/api.ts` — API 定义<br>`packages/server/src/routes.ts` — 路由创建<br>`packages/server/src/handlers.ts` — 17 个 Handler 组 | 17 个 API 组：Health、Session、Message、Model、Provider、Filesystem、Command、Skill、Event、Pty、Question、Agent 等 |
| **数据库会话持久化** | ✅ | `packages/core/src/session/sql.ts` — SessionTable、MessageTable、PartTable、TodoTable、SessionMessageTable、SessionInputTable、SessionContextEpochTable<br>`packages/core/src/session.ts` — SessionV2 CRUD | SQLite + Drizzle，完整会话/消息/工具调用持久化 |
| **SDK (JavaScript)** | ✅ | `packages/sdk/js/src/client.ts` — 客户端 SDK<br>`packages/sdk/js/src/v2/index.ts` — V2 SDK<br>`packages/sdk/js/src/server.ts` — 服务端 SDK | 支持客户端和服务端 SDK，自动生成类型 |
| **TUI 终端界面** | ✅ | `packages/tui/src/index.tsx` — TUI 入口<br>`packages/tui/src/app.tsx` — 主应用组件<br>`packages/tui/src/routes/home.tsx` — 首页路由 | Solid.js 构建的跨平台 TUI |
| **快照/撤销 (Snapshot/Revert)** | ✅ | `packages/core/src/session.ts:433-453` — revert.stage/clear/commit<br>`packages/core/src/session/sql.ts:41` — `summary_diffs` 字段 | 文件变更快照，支持多步骤撤销 |
| **上下文压缩 (Compaction)** | ✅ | `packages/core/src/session/runner/llm.ts:109` — `SessionCompaction.make()`<br>`packages/core/src/session/runner/llm.ts:215` — `compactIfNeeded()`<br>`packages/core/src/session/runner/llm.ts:355-381` — 溢出压缩恢复 | 自动检测上下文溢出并执行压缩 |
| **图像理解 (Image Understanding)** | ✅ | `packages/core/src/tool/read.ts:17` — SUPPORTED_IMAGE_MIMES<br>`packages/core/src/tool/read.ts:86-90` — 图像读取与缩放 | read 工具支持 jpeg/png/gif/webp 图片读取，自动缩放 |

---

## 4. 特有功能

### 4.1 流式 LLM 事件体系（Event Sourcing LLM Stream）

OpenCode 构建了一套细粒度的 LLM 事件类型系统，每种事件都有明确语义：

**代码证据**: `packages/llm/src/schema/events.ts`

| 事件类型 | 说明 |
|----------|------|
| `step-start` / `step-finish` | Provider 调用步起止 |
| `text-start` / `text-delta` / `text-end` | 文本内容流式推送 |
| `reasoning-start` / `reasoning-delta` / `reasoning-end` | 思考过程流式推送 |
| `tool-input-start` / `tool-input-delta` / `tool-input-end` | 工具参数流式推送 |
| `tool-call` | 工具调用完成（含 `providerExecuted` 标记） |
| `tool-result` | 工具执行结果 |
| `tool-error` | 工具执行错误 |
| `finish` | 完整响应结束（含 usage 统计） |
| `provider-error` | Provider 层错误 |

**关键特点**：
- 支持 provider-hosted 工具（`providerExecuted: true` 跳过本地调度）
- Usage 统计细分为 input/output/cache-read/cache-write/reasoning 五类
- 支持多步推理（Step 概念）

### 4.2 V2 会话架构（Durable Session Architecture）

**代码证据**: `packages/core/src/session/runner/llm.ts`

核心设计：
- **Prompt 接纳与执行分离**: `SessionV2.prompt()` 先持久化 `session_input` 行，再调度 `SessionExecution.wake()`
- **本地进程协调**: `SessionExecution` 是进程全局的 Session-ID 路由
- **Provider Turn 限制**: 每次执行恰好一次 `llm.stream(request)` 调用
- **工具调用调度**: 工具调用在持久化后立即开始执行（Eager Start），通过 `FiberSet` 并行管理
- **增量持久化**: LLM 事件通过 `createLLMEventPublisher` 逐步持久化

### 4.3 系统上下文代数（System Context Algebra）

**代码证据**: `packages/core/src/system-context/index.ts`

独特的可组合上下文源系统：
- **Source<A>**: 定义可观察、可比较、可渲染的上下文源
- **baseline/update/removed**: 三种渲染模式（初始、变更、移除）
- **快照对比**: `initialize()` 创建基准，`reconcile()` 增量更新，`replace()` 完全替换
- **内置源**: 环境信息 (`core/environment`)、日期 (`core/date`)
- **扩展源**: 通过 `SystemContextRegistry` 注册 Location 级源

### 4.4 协议-端点-认证-帧分离架构

**代码证据**: `packages/llm/src/route/`

LLM 请求路由的四轴分解：
- **Protocol**: 语义 API 契约（请求体构造、事件流解析、状态机）
- **Endpoint**: URL 构造（host、path、query）
- **Auth**: 每请求认证（Bearer、Header、SigV4、OAuth）
- **Framing**: 字节到帧的转换（SSE、AWS EventStream）

支持的 Provider 协议：
- OpenAI Chat / Responses
- Anthropic Messages
- Gemini
- Bedrock Converse
- OpenAI Compatible Chat

### 4.5 Skill 技能系统

**代码证据**: `packages/core/src/skill.ts`

Skill 是结构化的 Markdown 文件（SKILL.md）：
- **Frontmatter**: name、description、slash
- **内容**: 自由格式 Markdown 指令
- **来源**: 本地目录、远程 URL、嵌入式
- **缓存**: 基于 Source.key 的 Map 缓存
- **权限过滤**: `PermissionV2.evaluate("skill", skill.name, agent.permissions)`

### 4.6 可插拔插件架构

**代码证据**: `packages/core/src/plugin.ts`

- **生命周期**: `add()` 加载 → `wait()` 等待 → `remove()` 卸载
- **KeyedMutex**: 每个 Plugin ID 独立锁控制并发
- **Scope 隔离**: 每个 Plugin 在独立 Scope 中运行，卸载时自动清理
- **Host 注入**: Plugin 通过 `PluginHost` 获取核心服务引用

### 4.7 权限系统

**代码证据**: `packages/core/src/permission.ts`

基于通配符的三级权限模型：
- **allow**: 自动执行
- **ask**: 交互式授权（用户弹窗确认）
- **deny**: 拒绝执行
- **"always" 记忆**: 用户选择 "always" 后自动保存授权规则
- **Source 追踪**: 每次请求带 `messageID` / `callID` 溯源
- **Saved Rules**: 持久化授权规则到数据库

---

## 5. 数据目录与状态

### 5.1 数据目录结构

**代码证据**: `packages/core/src/global.ts`

```
XDG_DATA_HOME/opencode/
├── log/              # 日志文件
├── repos/            # 克隆的仓库
└── (SQLite 数据库)   # 会话/事件/消息存储

XDG_CONFIG_HOME/opencode/
└── opencode.json     # 全局配置

XDG_STATE_HOME/opencode/
└── (运行时状态)

XDG_CACHE_HOME/opencode/
├── bin/              # 可执行文件缓存
└── (缓存数据)
```

### 5.2 会话格式

**代码证据**: `packages/core/src/session/sql.ts`

**Session 表** (`session`):
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | 会话 ID (ses_xxx) |
| project_id | text (FK) | 项目 ID |
| workspace_id | text | 工作空间 ID |
| slug | text | URL 友好标识 |
| directory | text | 工作目录 |
| title | text | 会话标题 |
| version | text | 引擎版本 |
| cost | real | 累计费用 |
| tokens_input/output/reasoning/cache_read/cache_write | integer | Token 统计 |
| agent | text | 选中 Agent |
| model | json | 选中模型 (providerID/modelID/variant) |
| revert | json | 撤销状态 |
| permission | json | 权限规则 |

**SessionMessage 表** (`session_message`):
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | 消息 ID |
| session_id | text (FK) | 所属会话 |
| type | text | 消息类型 (user/assistant/tool/system) |
| seq | integer | 会话内序号 |
| data | json | 消息内容 |

**SessionInput 表** (`session_input`):
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | 输入消息 ID |
| session_id | text (FK) | 所属会话 |
| prompt | json | Prompt 内容 |
| delivery | text | 投递模式 (steer/queue) |
| admitted_seq | integer | 接纳序号 |
| promoted_seq | integer | 提升序号（进入模型可见历史） |

**其他表**: `TodoTable`（任务列表）、`SessionContextEpochTable`（上下文快照）、`MessageTable`/`PartTable`（V1 兼容）

### 5.3 事件溯源

**代码证据**: `packages/core/src/session.ts:346-351`

```
SessionV2.events(input)
  → Stream.unwrap(result.get(sessionID).pipe(
      Effect.as(events.durable({ aggregateID: input.sessionID, after: input.after }))
    ))
  → Stream.filter(isDurableSessionEvent)
```

通过 `EventV2` 发布/订阅机制实现事件溯源，支持实时事件流和历史事件回放。

### 5.4 状态检测

**代码证据**: `packages/core/src/session.ts:425`

```typescript
active: execution.active  // 返回当前进程活跃的 Session ID 集合
```

- `SessionExecution.active` — 快照当前进程拥有的活跃会话
- `SessionExecution.wake(sessionID)` — 注册新的唤醒信号
- `SessionExecution.interrupt(sessionID)` — 中断当前执行
- `SessionExecution.resume(sessionID)` — 恢复/加入执行

---

## 6. 已踩的坑（适配注意事项）

### 6.1 运行时依赖

| 问题 | 说明 | 代码位置 |
|------|------|----------|
| **Bun 运行时必需** | 项目使用 Bun 特有的 API（`Bun.file()`、`bun:sqlite`、`process.versions.bun`），无法在 Node.js 上直接运行 | `package.json:7` — `"packageManager": "bun@1.3.14"` |
| **Effect v4 beta** | 核心依赖 Effect v4 beta.83 API，与 Effect v3 不兼容 | `package.json:66` — `"effect": "4.0.0-beta.83"` |
| **原生二进制依赖** | `node-pty`、`@lydell/node-pty` 需要原生编译；`parcel-watcher` 需要平台特定二进制 | `packages/core/package.json:88-101` |

### 6.2 配置加载

| 问题 | 说明 | 代码位置 |
|------|------|----------|
| **JSONC 解析** | 使用 `jsonc-parser` 而非 `JSON.parse`，支持注释和尾逗号 | `packages/core/src/config.ts:152` |
| **配置优先级** | `.opencode/` 目录中的配置优先级最高，全局配置最低 | `packages/core/src/config.ts:200-203` |
| **V1→V2 迁移** | 配置文件自动检测 V1 格式并迁移到 V2 | `packages/core/src/config.ts:156-157` |
| **配置热重载** | 配置在 Location 打开时加载一次，后续复用，需要重启才能生效 | `packages/core/src/config.ts:177-178` |

### 6.3 工具调用

| 问题 | 说明 | 代码位置 |
|------|------|----------|
| **Windows Shell** | Windows 上默认使用 COMSPEC（cmd.exe），PowerShell 支持为 TODO | `packages/core/src/tool/bash.ts:66-77` — 多个 TODO 标记 |
| **超时限制** | bash 命令默认 2 分钟，最大 10 分钟 | `packages/core/src/tool/bash.ts:19-21` |
| **输出截断** | 最大 1MB 输出，超出部分标记截断 | `packages/core/src/tool/bash.ts:21` — MAX_CAPTURE_BYTES |
| **外部目录权限** | Bash 命令引用外部绝对路径时触发 `external_directory` 权限审批 | `packages/core/src/tool/bash.ts:81-95` |
| **Edit 精确匹配** | edit 工具要求 oldString 精确匹配（含空白/缩进），TODO 中标记了模糊匹配策略 | `packages/core/src/tool/edit.ts:84` — TODO: fuzzy correction |

### 6.4 会话执行

| 问题 | 说明 | 代码位置 |
|------|------|----------|
| **进程本地执行** | V2 Session 执行绑定到本地进程，无分布式会话支持 | `packages/core/src/session/runner/llm.ts`（多处 "process-global" 注释） |
| **崩溃恢复有限** | 崩溃后会话恢复需要独立设计，不自动重试 provider 工作 | `packages/core/src/session/runner/llm.ts` 注释 |
| **Step 限制** | Agent 可配置最大步数，达到后强制禁用工具 | `packages/core/src/session/runner/llm.ts:202-203` |
| **上下文溢出** | 自动检测并执行压缩恢复（compactAfterOverflow） | `packages/core/src/session/runner/llm.ts:283-288` |

### 6.5 Provider 兼容性

| 问题 | 说明 | 代码位置 |
|------|------|----------|
| **Provider SDK 覆盖** | 支持 20+ AI SDK Provider（OpenAI、Anthropic、Google、Azure、Bedrock、Mistral 等） | `packages/core/package.json:64-83` |
| **Provider-hosted 工具** | `providerExecuted: true` 的工具跳过本地调度（如 Claude web_search、OpenAI code_interpreter） | `packages/llm/src/schema/events.ts:152-160` |
| **Authentication 变体** | 支持 API Key、OAuth、SigV4（AWS Bedrock）、API Header 等多种认证方式 | `packages/llm/src/route/auth.ts` |

### 6.6 已知缺口（TODO 列表）

**代码证据**: `packages/core/src/tool/bash.ts:66-77`

- [ ] 基于 tree-sitter 的 Bash/PowerShell 解析器审批减少
- [ ] BashArity 可复用命令前缀审批
- [ ] PowerShell 和 cmd 特定路径处理恢复
- [ ] Plugin shell.env 环境增强
- [ ] 持久化后台任务状态与重启恢复
- [ ] HTTP 后台任务观测
- [ ] 全量 Shell 输出流式存储
- [ ] Edit 模糊匹配策略
- [ ] Formatter/LSP/快照/撤销集成
- [ ] 多节点集群会话执行
- [ ] Provider 调用重试边界
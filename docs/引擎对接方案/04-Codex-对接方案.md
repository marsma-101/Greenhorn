# Codex 引擎对接方案

> 分析对象: Codex（Rust v1.0.0）
> 生成日期: 2026-08-02
> 代码分析参考: docs/引擎分析/Codex-代码功能分析.md

## 一、启动与生命周期管理

### 1.1 启动方式
- **CLI 启动**: `codex` 或 `codex-cli/bin/codex.js`（Node.js 启动器，自动选择平台二进制）
- **app-server 模式**: `codex app-server` 启动 JSON-RPC 2.0 服务端
- **传输协议**: stdio（JSONL）/ WebSocket / Unix Socket
- **oneshot 命令**: `codex command/exec` 执行单条命令（无需会话）

### 1.2 状态检测
- **CLI 可执行检测**: 检查 `codex` 命令或 `codex-cli/bin/codex.js` 是否存在
- **app-server 检测**: stdio 传输通过 JSON-RPC `initialize` 握手检测
- **SQLite 完整性**: `sqlite_integrity_check()` 检测数据库完整性
- **环境连接**: `EnvironmentConnected`/`EnvironmentDisconnected` 事件

### 1.3 停止方式
- app-server: 关闭 stdin 或 kill 进程
- CLI: Ctrl+C 或 exit
- oneshot: 执行完毕自动退出

### 1.4 进程管理
- app-server 模式需要进程管理（启动/停止 stdio 子进程）
- oneshot 模式无需进程管理

---

## 二、对话接入方式

### 2.1 接口类型
- **JSON-RPC 2.0 协议**: app-server 模式提供完整 RPC 接口
- **stdio 传输**: 通过 JSONL 行进行通信（推荐用于集成）
- **WebSocket 传输**: 实验性，不推荐生产使用
- **核心原语**: Thread（对话线程）→ Turn（对话轮次）→ Item（对话项）

### 2.2 请求格式（JSON-RPC over stdio）
```json
// 初始化握手
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"GreenHorn","version":"1.0"}}}

// 创建对话
{"jsonrpc":"2.0","id":2,"method":"thread/start","params":{"model":"gpt-4.1"}}

// 发送消息
{"jsonrpc":"2.0","id":3,"method":"turn/start","params":{"threadId":"...","input":{"type":"text","text":"Hello"}}}
```

### 2.3 响应格式（JSON-RPC + 事件通知）
```json
// 初始化响应
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2.0","capabilities":{...}}}

// 对话创建响应
{"jsonrpc":"2.0","id":2,"result":{"threadId":"abc123"}}

// 消息流事件（通知格式）
{"jsonrpc":"2.0","method":"notifications","params":{"event":{"type":"item","item":{"type":"agentMessage","content":[{"type":"text","text":"Hello"}]}}}}
{"jsonrpc":"2.0","method":"notifications","params":{"event":{"type":"item","item":{"type":"turnComplete"}}}}
```

### 2.4 流式支持
- ✅ 完整支持流式（JSON-RPC 通知机制）
- 流式事件类型: agentMessage, agentReasoning, shellCommand, functionCall, webSearchCall 等
- 支持 token 计数事件
- 支持多步推理（Step 概念）

### 2.5 现有 Adapter 复用分析
- **可复用**: `EngineAdapter` 抽象基类的 `chat()` 异步生成器模式
- **需新建**: `CodexAdapter extends EngineAdapter`
- **核心实现**: JSON-RPC stdio 子进程管理（initialize → thread/start → turn/start → 事件流消费）
- **复杂度高**: JSON-RPC 协议握手 + 事件流解析 + Thread/Turn 生命周期管理
- **Adapter 类名**: `CodexAdapter`

---

## 三、会话存储接入

### 3.1 引擎原生存储格式
- **格式**: JSONL（每行一个 JSON 对象），文件路径 `$CODEX_HOME/sessions/<thread-id>.jsonl`
- **Rollout 事件类型**: Message, AgentMessage, Reasoning, LocalShellCall, FunctionCall, FunctionCallOutput, WebSearchCall, Compaction 等
- **SQLite**: 元数据存储在 `$CODEX_HOME/state/db.sqlite`（ThreadMetadata, ThreadGoal）
- **归档**: `$CODEX_HOME/archived_sessions/<thread-id>.jsonl`

### 3.2 对接策略
- **使用 Codex 原生会话**: Codex 的 Thread 模型功能完善，建议直接使用
- **会话列表**: 通过 `thread/list` API 获取历史对话列表
- **会话恢复**: 通过 `thread/resume` API 恢复已有对话
- **会话分叉**: 通过 `thread/fork` API 从已有对话分支

### 3.3 与会话 API 兼容
- 需要实现 Codex 会话 → GreenHorn Session 格式的转换层
- `thread/list` 返回 → 映射为 GreenHorn 会话列表
- `thread/resume` / `thread/start` → 对应 GreenHorn 会话加载/新建

---

## 四、配置接入

### 4.1 配置文件位置
- **主配置**: `$CODEX_HOME/config.toml`（TOML 格式，400+ 字段）
- **项目级配置**: `<project>/.codex/config.toml`
- **多层级配置**: 7 层配置合并（System/MDM/Enterprise/Project/User/Profile/Session）

### 4.2 需暴露给用户的配置项
- ✅ 模型选择（model, model_provider, model_context_window）
- ✅ 推理设置（model_reasoning_effort, model_reasoning_summary）
- ✅ 权限策略（approval_policy, default_permissions）
- ✅ 沙箱模式（sandbox_mode, NetworkConstraints）
- ✅ MCP 服务器（mcp_servers）
- ✅ 工具暴露级别（ToolExposure）

### 4.3 读写方式
- **配置读写**: 通过 app-server `config/read` / `config/value/write` API
- **直接编辑**: 直接修改 `config.toml` 文件（TOML 格式）
- **配置查询**: `config/read` API 查看最终生效配置

---

## 五、工具调用接入

### 5.1 工具接口
- **原生工具系统**: `ToolRouter` → `ToolExecutor` 统一执行接口
- **工具类型**: shell, file, plan, web-search, multi-agent, code-mode 等
- **MCP 协议**: `mcpServerStatus/list` + `mcpServer/tool/call`
- **Guardian 审查**: 内联/分离审查模式

### 5.2 工具暴露方案
- **Codex 自动管理工具**: 工具在 app-server 启动时自动注册
- **MCP 注入**: 通过 `config.toml` 的 `[mcp_servers.<name>]` 配置注入
- **GreenHorn 侧**: 管理 MCP 服务器列表 → 写入 Codex 配置 → Codex 自动发现

### 5.3 工具调用结果流式返回
- JSON-RPC 事件通知: `item` 事件包含 `functionCall` 和 `functionCallOutput`
- 流式传递: 工具调用通过事件流逐步推送
- Code Mode: 特殊 JSON 协议格式

### 5.4 MCP 跨引擎共享
- ✅ Codex 原生支持 MCP
- **统一管理**: GreenHorn 后端 MCP 服务 → Codex 配置注入
- **优势**: Codex 的 MCP 实现支持 OAuth 认证、并发工具调用、工具能力声明

---

## 六、特有功能对接

### 6.1 独有功能
- **App-Server Protocol**: JSON-RPC 2.0 服务化接口（可被 IDE 扩展直接调用）
- **Thread/Turn/Item 三层抽象**: 会话管理精细化
- **Code Mode**: 特殊代码模式（工具转为 JSON 协议）
- **Realtime 语音对话**: 实时语音交互（实验性）
- **Guardian 自动审查**: 内联/分离代码审查
- **多 Agent 协作**: V1/V2 模式，支持子 Agent 并行
- **Marketplace/Plugin**: 远程插件市场
- **Memory 记忆**: 自动从 rollout 提取记忆

### 6.2 接入优先级
| 功能 | 优先级 | 接入方式 | 备注 |
|------|--------|---------|------|
| app-server stdio 对接 | 高 | CodexAdapter 实现 JSON-RPC | 核心对话通路 |
| Thread/Turn 会话管理 | 高 | 使用 Codex 原生 API | 会话生命周期 |
| 工具调用 | 高 | Codex 原生工具系统 | 工具自动注册 |
| MCP 注入 | 高 | 配置注入 | 工具通道 |
| Code Mode | 中 | 通过 `ToolMode::CodeMode` | 特殊代码场景 |
| Guardian 审查 | 低 | `review/start` API | 高级审查 |
| Realtime 语音 | 暂不 | 实验性 | 需要语音 UI |
| Marketplace | 暂不 | 长期规划 | 插件生态 |

---

## 七、风险与注意

### 7.1 已知坑
- **多层级配置复杂度**: 7 层配置合并可能导致配置被覆盖
- **JSONL 格式脆弱**: 单行损坏会导致整个会话恢复失败
- **工具暴露级别复杂**: 4 种 ToolExposure 级别需正确配置
- **WebSocket 实验性**: 生产环境使用 stdio
- **初始化握手**: 所有请求前必须完成 initialize
- **SQLite WAL 模式**: 需 SQLite ≥ 3.51.0

### 7.2 数据目录/权限
- **可配置路径**: `CODEX_HOME` 环境变量覆盖
- **SQLite 权限**: Windows 下可能遇到锁冲突
- **沙箱约束**: 文件系统和网络限制

### 7.3 兼容性
- **Rust 平台**: 预编译二进制需匹配 OS/CPU 架构
- **Node.js**: 启动器需要 Node.js 环境
- **SQLite 版本**: 需 bundled SQLite ≥ 3.51.0

---

## 八、接入建议

| 维度 | 建议 |
|------|------|
| **接入程度** | 基础接入（app-server stdio + 会话 + 工具 + MCP） |
| **理由** | Codex 的 app-server JSON-RPC 协议是所有引擎中最规范的，stdio 传输适合集成。基础接入可快速实现完整能力 |
| **预估工作量** | 大 |
| **优先级** | 中

**接入路线图**:
1. 📋 **第一步**: CodexAdapter（JSON-RPC stdio 子进程管理 + initialize 握手）
2. 📋 **第二步**: Thread/Turn 会话生命周期对接
3. 📋 **第三步**: 工具调用事件流解析
4. 📋 **第四步**: MCP 配置注入
5. 🔮 **后续**: Guardian/Code Mode/多 Agent 高级功能
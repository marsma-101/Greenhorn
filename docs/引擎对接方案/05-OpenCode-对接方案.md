# OpenCode 引擎对接方案

> 分析对象: OpenCode（TypeScript + Bun v1.18.10）
> 生成日期: 2026-08-02
> 代码分析参考: docs/引擎分析/OpenCode-代码功能分析.md

## 一、启动与生命周期管理

### 1.1 启动方式
- **HTTP API 服务**: `opencode serve` 启动 HTTP API 服务
- **CLI 交互模式**: `opencode run` 启动 TUI 会话
- **启动流程**: yargs 解析 CLI → 加载配置层 → 初始化 Location 层 → 启动 SessionRunner
- **开发模式**: `bun dev` 从 `packages/opencode` 启动

### 1.2 状态检测
- **HTTP 健康检查**: GET 服务器根路径或 `/health` 端点
- **进程检测**: 检测 OpenCode HTTP 服务是否在指定端口监听
- **配置完整性**: 检查 `opencode.json` 是否存在且有效
- **依赖检测**: 检查 Bun 运行时是否可用（`Bun.file()`、`bun:sqlite` 等）

### 1.3 停止方式
- HTTP 服务: kill 进程或发送关闭信号
- CLI: Ctrl+C 或 exit

### 1.4 进程管理
- HTTP 服务模式需要进程管理（启动/停止 OpenCode serve）
- 可选：由 start.bat 统一管理所有引擎进程

---

## 二、对话接入方式

### 2.1 接口类型
- **HTTP API**: `opencode serve` 提供 RESTful API
- **API 分组**: 17 个 Handler 组（Health, Session, Message, Model, Provider, Filesystem, Command, Skill, Event, Pty, Question, Agent 等）
- **SDK**: 提供 JavaScript SDK（客户端/服务端/V2 API）

### 2.2 请求格式（HTTP API）
```json
// 创建会话
POST /api/sessions
Body: {"agentId": "build"}

// 发送消息
POST /api/sessions/{sessionId}/messages
Body: {
  "content": "Hello",
  "type": "user"
}

// 流式接收
GET /api/sessions/{sessionId}/events
// SSE 事件流
```

### 2.3 响应格式（SSE 事件流）
```
event: step-start
data: {"provider":"..."}

event: text-start
data: {}

event: text-delta
data: {"delta":"Hello"}

event: text-end
data: {}

event: tool-call
data: {"toolName":"bash","args":"...","providerExecuted":false}

event: tool-result
data: {"toolName":"bash","result":"...","isError":false}

event: finish
data: {"usage":{"input_tokens":100,"output_tokens":50,"reasoning_tokens":20}}
```

### 2.4 流式支持
- ✅ 完整支持流式（SSE 协议）
- 11 种事件类型: step-start/finish, text-start/delta/end, reasoning-start/delta/end, tool-input-start/delta/end, tool-call, tool-result, tool-error, finish, provider-error
- 细粒度 token 统计（input/output/cache-read/cache-write/reasoning 五类）

### 2.5 现有 Adapter 复用分析
- **可复用**: `EngineAdapter` 抽象基类的 `chat()` 异步生成器模式
- **可复用**: SSE 解析逻辑（与 PIAdapter 类似）
- **需新建**: `OpenCodeAdapter extends EngineAdapter`
- **核心实现**: HTTP API 调用 + SSE 事件流解析
- **复用度**: 高（PIAdapter 的 SSE 解析可直接复用）
- **Adapter 类名**: `OpenCodeAdapter`

---

## 三、会话存储接入

### 3.1 引擎原生存储格式
- **格式**: SQLite + Drizzle ORM
- **核心表**: session, session_message, session_input, session_context_epoch, TodoTable
- **会话 ID**: `ses_xxx` 格式
- **事件溯源**: EventV2 发布/订阅机制
- **快照/撤销**: revert.stage/clear/commit 支持多步骤撤销

### 3.2 对接策略
- **使用 OpenCode 原生会话**: OpenCode 的 V2 会话架构功能完善
- **HTTP API 管理**: 通过 `/api/sessions` 和 `/api/messages` 管理会话
- **会话列表**: GET `/api/sessions` 获取列表
- **会话恢复**: 发送消息时自动恢复历史

### 3.3 与会话 API 兼容
- OpenCode 的 HTTP API 与 GreenHorn 的 RESTful 接口天然兼容
- 会话 CRUD 通过 HTTP API 完成
- 消息历史通过 GET `/api/sessions/{id}/messages` 获取

---

## 四、配置接入

### 4.1 配置文件位置
- **配置文件**: `opencode.json` 或 `opencode.jsonc`（支持 JSONC 格式，含注释）
- **配置发现**: 全局 `xdgConfig/opencode/` → 项目根 → `.opencode/` 目录
- **存储**: XDG 目录规范（data/config/state/cache）

### 4.2 需暴露给用户的配置项
- ✅ 模型选择（model, default_agent）
- ✅ Provider 配置（providers: 20+ AI SDK Provider）
- ✅ 权限控制（permissions: allow/deny/ask 三级）
- ✅ Shell 配置（shell 路径、超时）
- ✅ MCP 服务器（mcp: Local/Remote）
- ✅ Agent 定义（agents 自定义 Agent）

### 4.3 读写方式
- **HTTP API**: 通过 OpenCode 的 config 相关端点
- **直接编辑**: 直接修改 `opencode.json` 文件
- **配置热重载**: 配置在 Location 打开时加载，需要重启生效

---

## 五、工具调用接入

### 5.1 工具接口
- **原生工具**: read, write, edit, bash, glob, grep 等
- **工具系统**: ToolRegistry 统一注册 + 权限控制
- **MCP 协议**: 支持 Local（进程）和 Remote（HTTP）两种类型
- **插件系统**: 外部插件动态加载/卸载

### 5.2 工具暴露方案
- **OpenCode 自动管理工具**: 工具在 SessionRunner 中自动注册和调度
- **MCP 注入**: 通过 `opencode.json` 的 `mcp` 配置注入服务器
- **GreenHorn 侧**: 管理 MCP 服务器列表 → 写入 OpenCode 配置

### 5.3 工具调用结果流式返回
- SSE 事件流: `tool-call` → `tool-result`/`tool-error`
- 细粒度: `tool-input-start/delta/end` 流式推送工具参数
- 支持 `providerExecuted` 标记（Provider 级工具跳过本地调度）

### 5.4 MCP 跨引擎共享
- ✅ OpenCode 原生支持 MCP
- **统一管理**: GreenHorn 后端 MCP 服务 → OpenCode 配置注入
- **优势**: OpenCode 的 MCP 实现支持 Local/Remote 两种类型，权限过滤

---

## 六、特有功能对接

### 6.1 独有功能
- **V2 会话架构**: Prompt 接纳与执行分离，进程全局 Session-ID 路由
- **系统上下文代数**: Source<A> 可组合上下文源系统
- **协议-端点-认证-帧分离**: LLM 请求路由四轴分解
- **权限系统**: 基于通配符的 allow/deny/ask 三级模型
- **快照/撤销**: 文件变更多步骤撤销
- **事件溯源**: EventV2 发布/订阅
- **插件系统**: 可插拔架构（Shell/Tool/TUI 插件接口）

### 6.2 接入优先级
| 功能 | 优先级 | 接入方式 | 备注 |
|------|--------|---------|------|
| HTTP API 对话 | 高 | OpenCodeAdapter 调用 /api/sessions | 核心对话通路 |
| SSE 流式解析 | 高 | 复用 PIAdapter 解析逻辑 | text-delta 等事件 |
| 会话管理 | 高 | HTTP API CRUD | 完整会话生命周期 |
| 工具调用 | 高 | OpenCode 原生工具系统 | 自动注册调度 |
| MCP 接入 | 高 | 配置注入 | 工具通道 |
| 权限系统 | 中 | 配置映射 | 权限策略对接 |
| 快照撤销 | 低 | 通过 HTTP API | 高级功能 |
| 插件系统 | 暂不 | 需逐个插件适配 | 长期规划 |

---

## 七、风险与注意

### 7.1 已知坑
- **Bun 运行时必需**: 无法在 Node.js 上直接运行（使用 Bun 特有 API）
- **Effect v4 beta 依赖**: 核心依赖 Effect v4 beta.83
- **配置热重载**: 配置在启动时加载一次，需重启生效
- **Windows Shell**: 默认使用 COMSPEC/cmd.exe，PowerShell 支持为 TODO
- **Edit 精确匹配**: 要求 oldString 精确匹配，模糊匹配为 TODO
- **进程本地执行**: V2 Session 执行绑定到本地进程，无分布式支持

### 7.2 数据目录/权限
- **XDG 目录规范**: data/config/state/cache 四个目录
- **SQLite 权限**: Windows 下 SQLite 可能遇到锁冲突
- **外部目录权限**: Bash 引用外部路径时触发权限审批

### 7.3 兼容性
- **Bun 版本**: 要求 Bun 1.3.14
- **原生二进制**: node-pty 等需要原生编译
- **Provider 覆盖**: 支持 20+ AI SDK Provider

---

## 八、接入建议

| 维度 | 建议 |
|------|------|
| **接入程度** | 基础接入（HTTP API + SSE + 会话 + 工具 + MCP） |
| **理由** | OpenCode 提供了完整的 HTTP API，与 GreenHorn 的架构天然兼容。SSE 解析可复用 PIAdapter 代码，工作量相对较小 |
| **预估工作量** | 中 |
| **优先级** | 高

**接入路线图**:
1. 📋 **第一步**: OpenCodeAdapter（HTTP API 调用 + SSE 事件流解析）
2. 📋 **第二步**: 会话对接（OpenCode Session API → GreenHorn 会话映射）
3. 📋 **第三步**: 配置对接（opencode.json 读写）
4. 📋 **第四步**: MCP 配置注入
5. 🔮 **后续**: 权限系统对接
6. 🔮 **后续**: 快照撤销功能

# Reasonix 引擎对接方案

> 分析对象: Reasonix（Go v1.0.0）
> 生成日期: 2026-08-02
> 代码分析参考: docs/引擎分析/Reasonix-代码功能分析.md

---

## 一、启动与生命周期管理

### 1.1 启动方式
- **HTTP 服务模式**: `reasonix serve` 启动 HTTP+SSE 服务
- **CLI 交互模式**: `reasonix run` 启动 TUI 会话
- **ACP 协议模式**: `reasonix acp` 通过 stdio JSON-RPC 暴露 ACP v1
- **Bot 网关**: `reasonix bot start` 启动 IM Bot（QQ/飞书/微信）
- **oneshot 子命令**: 各功能子命令独立执行

### 1.2 状态检测
- **HTTP 健康检查**: GET 服务器根路径或健康检查端点
- **ACP 握手**: 通过 ACP `initialize` 方法检测
- **配置完整性**: 检查 `config.toml` 是否存在
- **进程检测**: 检查 reasonix 进程是否运行

### 1.3 停止方式
- HTTP 服务: kill 进程
- ACP 模式: 关闭 stdin 或发送关闭信号
- CLI: Ctrl+C

### 1.4 进程管理
- HTTP 服务/ACP 模式需要进程管理
- 可选：由 start.bat 统一管理

---

## 二、对话接入方式

### 2.1 接口类型
- **HTTP+SSE**: `reasonix serve` 提供 RESTful API + SSE 事件流
- **ACP 协议**: `reasonix acp` 通过 stdio JSON-RPC 2.0 暴露
- **CLI**: `reasonix run` 交互式（不适合 Web 对接）
- **推荐**: HTTP 服务模式（成熟的 Web API）

### 2.2 请求格式（HTTP API）
```json
// 创建/加载会话
POST /api/sessions
Body: {"model": "deepseek/deepseek-v4-pro"}

// 发送消息
POST /api/sessions/{sessionId}/prompt
Body: {
  "content": "Hello",
  "systemPrompt": "You are..."
}

// 流式接收 SSE
GET /api/sessions/{sessionId}/stream
```

### 2.3 响应格式（SSE 事件流）
```
event: session/start
data: {"sessionId":"..."}

event: message/start
data: {"messageId":"..."}

event: message/delta
data: {"content":"Hello","reasoning":false}

event: reasoning/delta
data: {"content":"Let me think..."}

event: tool/start
data: {"toolName":"bash","args":"ls -la"}

event: tool/result
data: {"toolName":"bash","result":"file1.txt\nfile2.txt"}

event: session/complete
data: {"usage":{"input_tokens":100,"output_tokens":50}}
```

### 2.4 流式支持
- ✅ 完整支持流式（SSE 协议）
- 支持文本增量、思考增量、工具调用事件
- 支持 token 使用统计
- 支持上下文压缩事件

### 2.5 现有 Adapter 复用分析
- **可复用**: `EngineAdapter` 抽象基类的 `chat()` 异步生成器模式
- **可复用**: SSE 解析逻辑（与 PIAdapter/OpenCodeAdapter 类似）
- **需新建**: `ReasonixAdapter extends EngineAdapter`
- **核心实现**: HTTP API 调用 + SSE 事件流解析
- **复用度**: 高（PIAdapter 的 SSE 解析可直接复用）
- **Adapter 类名**: `ReasonixAdapter`

---

## 三、会话存储接入

### 3.1 引擎原生存储格式
- **格式**: JSONL（每行一条 JSON 消息）
- **文件位置**: `<state>/sessions/<timestamp>-<id>.jsonl`
- **消息格式**: Role（system/user/assistant/tool）+ Content + ToolCalls
- **会话锁**: `.jsonl.lock` + `.jsonl.lease.lock`（租约锁防止多标签写入冲突）
- **归档**: `<state>/archive/` 存储压缩归档

### 3.2 对接策略
- **使用 Reasonix 原生会话**: Reasonix 的 JSONL 格式与 GreenHorn 兼容
- **HTTP API 管理**: 通过 Reasonix 的会话 API 管理
- **会话列表**: GET 会话列表端点
- **会话恢复**: 发送消息时自动恢复历史

### 3.3 与会话 API 兼容
- Reasonix 的 JSONL 格式可与 GreenHorn 的 JSONL 格式互转
- 通过 HTTP API 管理会话 CRUD
- 消息历史可通过 API 获取

---

## 四、配置接入

### 4.1 配置文件位置
- **全局配置**: `~/.reasonix/config.toml`（TOML 格式）
- **项目配置**: `<project>/reasonix.toml`
- **凭据**: `<home>/.env`（API Key 环境变量）
- **Hooks**: `<home>/settings.json`
- **Skills**: `.reasonix/skills/` 等目录

### 4.2 需暴露给用户的配置项
- ✅ Provider 配置（`[[providers]]` 数组，支持多 Provider）
- ✅ 模型选择（default_model, provider model）
- ✅ 双模型协作（planner_model, subagent_model）
- ✅ Agent 配置（system_prompt, temperature）
- ✅ 沙箱配置（workspace_root, allow_write, forbid_read）
- ✅ 权限控制（权限模式：ask/auto/yolo）
- ✅ MCP 服务器配置

### 4.3 读写方式
- **TOML 读写**: 直接解析/修改 `config.toml`（TOML 格式）
- **凭据**: 读取 `.env` 文件获取 API Key
- **配置优先级**: 命令行参数 > 项目配置 > 全局配置 > 默认值

---

## 五、工具调用接入

### 5.1 工具接口
- **内建工具**: 16 个编译期注册工具（bash, read_file, write_file, edit_file, multi_edit, grep, glob, web_fetch, todo_write 等）
- **MCP 协议**: 支持 stdio 和 HTTP/SSE 传输
- **权限控制**: 三级权限（allow/ask/deny）+ "always" 记忆授权
- **沙箱约束**: 文件操作受 workspace_root 限制

### 5.2 工具暴露方案
- **Reasonix 自动管理工具**: 内建工具通过 `init()` 注册
- **MCP 注入**: 通过 `config.toml` 的 MCP 配置注入外部工具
- **GreenHorn 侧**: 管理 MCP 服务器列表 → 写入 Reasonix 配置

### 5.3 工具调用结果流式返回
- SSE 事件流: `tool/start` → `tool/result`
- 工具参数流式: `tool/start` 包含 args
- 支持后台作业: `bash_output`, `wait`, `kill_shell` 工具

### 5.4 MCP 跨引擎共享
- ✅ Reasonix 原生支持 MCP
- **统一管理**: GreenHorn 后端 MCP 服务 → Reasonix 配置注入
- **优势**: Reasonix 的 MCP 实现支持安全分级（readOnlyHint, destructiveHint）

---

## 六、特有功能对接

### 6.1 独有功能
- **ACP 协议**: 完整 ACP v1 实现（会话生命周期、内容块、权限请求）
- **双模型协作**: Planner-Executor 模式（规划模型 + 执行模型）
- **Delivery Profile**: 交付优先模式（强制验收标准 + 证据签核）
- **Auto Guard**: 独立安全审查层（RecoveryModel）
- **Fleet 并行**: 2-64 个子任务并行执行
- **IM Bot 网关**: QQ/飞书/微信 Bot 集成
- **桌面端 GUI**: Wails v2 桌面应用（多标签、自动保存）

### 6.2 接入优先级
| 功能 | 优先级 | 接入方式 | 备注 |
|------|--------|---------|------|
| HTTP API 对话 | 高 | ReasonixAdapter 调用 serve API | 核心对话通路 |
| SSE 流式解析 | 高 | 复用 PIAdapter 解析逻辑 | text-delta/reasoning-delta |
| 会话管理 | 高 | HTTP API CRUD | JSONL 格式兼容 |
| 工具调用 | 高 | Reasonix 原生工具系统 | 16 个内建工具 |
| MCP 接入 | 高 | 配置注入 | 工具通道 |
| 双模型协作 | 中 | planner_model 配置 | 高级规划 |
| ACP 协议 | 中 | reasonix acp 模式 | 编辑器集成 |
| Delivery Profile | 低 | 特定场景启用 | 交付验收 |
| IM Bot | 暂不 | 面向 IM 场景 | 非 Web 范围 |
| 桌面 GUI | 暂不 | Wails 框架 | 独立桌面应用 |

---

## 七、风险与注意

### 7.1 已知坑
- **Windows 沙箱**: Bash 工具在 Windows 上自动降级到 PowerShell，且无 OS 级沙箱
- **会话格式差异**: Reasonix JSONL 格式与 PI 格式需映射
- **双配置文件**: 全局 `config.toml` 和项目 `reasonix.toml` 加载逻辑复杂
- **凭据分离**: API Key 在 `.env` 中，TOML 只存环境变量名
- **工具注册时机**: 内建工具通过 `init()` 注册

### 7.2 数据目录/权限
- **默认路径（Windows）**: `%APPDATA%\reasonix\`
- **可覆盖**: `REASONIX_HOME` 环境变量
- **会话锁**: `.jsonl.lock` 和 `.jsonl.lease.lock`
- **沙箱约束**: workspace_root 限制文件操作范围

### 7.3 兼容性
- **Go 版本**: 要求 Go 1.25.0 (toolchain go1.26.5)
- **单二进制**: 编译后为单个可执行文件
- **跨平台**: macOS/Linux/Windows 均支持

---

## 八、接入建议

| 维度 | 建议 |
|------|------|
| **接入程度** | 基础接入（HTTP API + SSE + 会话 + 工具 + MCP） |
| **理由** | Reasonix 提供了完整的 HTTP+SSE API 和 ACP 协议，与 GreenHorn 架构兼容。Go 单二进制部署简单，启动快速 |
| **预估工作量** | 中 |
| **优先级** | 中

**接入路线图**:
1. 📋 **第一步**: ReasonixAdapter（HTTP+SSE 调用）
2. 📋 **第二步**: 会话对接（JSONL 格式兼容 + HTTP API）
3. 📋 **第三步**: 配置对接（TOML 读写 + .env 读取）
4. 📋 **第四步**: MCP 配置注入
5. 🔮 **后续**: 双模型协作
6. 🔮 **后续**: ACP 协议对接

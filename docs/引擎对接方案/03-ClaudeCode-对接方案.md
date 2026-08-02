# Claude Code 对接方案

> 分析对象: Claude Code（TypeScript/Node.js v1.0.0）
> 生成日期: 2026-08-02
> 代码分析参考: docs/引擎分析/ClaudeCode-代码功能分析.md

## 一、启动与生命周期管理

### 1.1 启动方式
- **CLI 启动**: `claude` 命令（交互式 TUI）
- **安装方式**: `curl -fsSL https://claude.ai/install.sh | bash` 或 `npm install -g @anthropic-ai/claude-code`（已转为官方安装脚本）
- **非交互模式**: 支持通过 Agent SDK 子进程调用
- **当前状态**: 已安装在 `ai-agent/claude-code/program/`

### 1.2 状态检测
- **CLI 可执行检测**: 检查 `claude` 命令是否在 PATH 中
- **Node.js 版本检测**: 要求 Node.js ≥18
- **API 凭证检测**: 检查 `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` 环境变量
- **API 可达性探测**: HEAD 请求到 `api.anthropic.com`
- **SDK 可用性**: 检查 `claude_agent_sdk` Python 包是否已安装

### 1.3 停止方式
- CLI 模式：Ctrl+C 或 exit 退出
- 子进程模式：kill 子进程

### 1.4 进程管理
- 可选：作为子进程由我们管理（Agent SDK 模式）
- 或：用户手动启动 CLI

---

## 二、对话接入方式

### 2.1 接口类型
- **Agent SDK 子进程**: 通过 `claude_agent_sdk` Python 包调用（`_call_claude_via_sdk()`）
- **直接 HTTP API**: 调用 `api.anthropic.com/v1/messages`（支持流式 SSE）
- **第三方提供商**: 支持 Bedrock/Vertex/Foundry/Mantle（通过环境变量切换）

### 2.2 请求格式（直接 HTTP）
```json
{
  "model": "claude-sonnet-4.6",
  "system": "You are...",
  "messages": [
    {"role": "user", "content": [{"type": "text", "text": "Hello"}]}
  ],
  "stream": true,
  "thinking": {"type": "adaptive"}
}
```

### 2.3 响应格式（SSE 流）
```
event: message_start
data: {"message":{"id":"...","type":"message","role":"assistant","model":"..."}}

event: content_block_start
data: {"index":0,"content_block":{"type":"thinking"}}

event: content_block_delta
data: {"delta":{"type":"thinking_delta","thinking":"..."}}

event: content_block_stop
data: {"index":0}

event: content_block_start
data: {"index":1,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"delta":{"type":"text_delta","text":"Hello"}}

event: message_delta
data: {"delta":{"type":"output_tokens","output_tokens":5}}

event: message_stop
data: {"stop_reason":"end_turn","stop_sequence":null}
```

### 2.4 流式支持
- ✅ 完整支持流式（SSE 协议）
- 支持思考过程的流式输出（`thinking_delta` 事件）
- 支持工具调用的流式输出
- 支持 token 使用统计（`output_tokens` 事件）

### 2.5 现有 Adapter 复用分析
- **可复用**: `EngineAdapter` 抽象基类的 `chat()` 异步生成器模式
- **需新建**: `ClaudeCodeAdapter extends EngineAdapter`
- **核心实现**: 直接调用 Anthropic Messages API（`/v1/messages`）
- **SSE 解析**: 解析 `event:` / `data:` 行，处理 `content_block_delta` 事件
- **Adapter 类名**: `ClaudeCodeAdapter`

---

## 三、会话存储接入

### 3.1 引擎原生存储格式
- **状态文件**: `~/.claude/security/security_warnings_state_{key}.json`（每会话一个）
- **会话 ID**: UUID 格式（或 `CLAUDE_CODE_REMOTE_SESSION_ID` 环境变量指定）
- **锁文件**: `~/.claude/security/security_warnings_state_{key}.lock`（fcntl，Windows 下降级为无锁）
- **安全审查状态**: 包含 shown_warnings, touched_paths, baseline_sha, previous_findings 等

### 3.2 对接策略
- **使用 GreenHorn 会话存储**: 不依赖 Claude Code 的原生会话格式（过于复杂且 Windows 不兼容）
- **直接 API 调用**: 每次对话传递完整 messages 历史给 API
- **会话持久化**: 使用 GreenHorn 的 JSONL 格式存储会话
- **会话 API**: 通过 `/api/sessions` 管理

### 3.3 与会话 API 兼容
- 完全对齐：GreenHorn 管理会话，Claude Code 只管对话
- messages 数组直接传递给 API
- 支持刷新恢复（从 JSONL 读取历史）

---

## 四、配置接入

### 4.1 配置文件位置
- **用户设置**: `~/.claude/settings.json`（JSON 格式）
- **项目设置**: `<project>/.claude/settings.json`
- **安全规则**: `~/.claude/security-patterns.yaml` 或 `security-patterns.json`
- **安全指南**: `~/.claude/claude-security-guidance.md`（Markdown）
- **API Key**: `ANTHROPIC_API_KEY` 环境变量

### 4.2 需暴露给用户的配置项
- ✅ API Key（`ANTHROPIC_API_KEY`）
- ✅ 模型选择（Claude 3.5 Sonnet/Haiku/Opus）
- ✅ 思考模式（adaptive / budget_tokens）
- ✅ 权限模式（disableBypassPermissionsMode, ask/deny 规则）
- ✅ 沙箱模式（sandbox.enabled, sandbox.network）

### 4.3 读写方式
- **API Key**: 通过环境变量（`process.env.ANTHROPIC_API_KEY`）
- **模型/参数**: 通过 API 请求体传递
- **安全规则**: 直接编辑 `security-patterns.yaml`（高级功能）

---

## 五、工具调用接入

### 5.1 工具接口
- **原生工具**: Claude Code 内置 Read/Write/Edit/Bash 工具
- **Hook 系统**: 5 种事件（SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop）
- **插件扩展**: 插件可声明commands, agents, hooks, mcpServers
- **MCP 集成**: 支持 Stdio/SSE/HTTP 三种 MCP 服务器集成

### 5.2 工具暴露方案
- **第一阶段**: 通过 Claude Code 的 Messages API 直接调用，不暴露自定义工具
- **后续**: 通过 MCP 注入自定义工具（需插件开发）
- **简化策略**: 先使用 Claude Code 原生工具能力，自定义工具通过 MCP 桥接

### 5.3 工具调用结果流式返回
- Claude Code 的 `/v1/messages` API 原生支持工具调用
- 工具调用通过 `tool_use` content block 返回
- 工具结果通过 `tool_result` content block 传回
- 流式事件: `content_block_delta` 包含工具调用 ID 和参数

### 5.4 MCP 跨引擎共享
- ✅ Claude Code 支持 MCP（通过插件 `mcpServers` 声明）
- **接入方式**: 开发一个 GreenHorn 插件，声明 MCP servers
- **简化方案**: 第一阶段直接使用 Claude Code 原生工具，MCP 工具通过后端中转

---

## 六、特有功能对接

### 6.1 独有功能
- **插件系统**: 12 个内置插件（security-guidance, code-review, frontend-design 等）
- **Hook 系统**: 5 种事件拦截，支持 sync/asyncRewake 两种执行模式
- **双重审查**: 并行两次 LLM 调用 OR 合并
- **竞态 Agent 审查**: Agent 式审查与单次审查竞速
- **Git 基线驱动审查**: 基于 git stash 的变更检测
- **沙箱模式**: Bash 网络/文件系统隔离
- **MDM 企业部署**: 支持 Windows ADML/ADMX + macOS .mobileconfig

### 6.2 接入优先级
| 功能 | 优先级 | 接入方式 | 备注 |
|------|--------|---------|------|
| 直接 API 对话 | 高 | ClaudeCodeAdapter 直接调用 /v1/messages | 核心对话能力 |
| 原生工具调用 | 高 | API 原生支持，自动启用 | Read/Write/Edit/Bash |
| MCP 集成 | 中 | 开发 GreenHorn 插件或通过 API 中转 | 需要插件开发 |
| 安全审查 Hook | 低 | 复用 security-guidance 插件 | 高级功能 |
| 沙箱模式 | 暂不 | Windows 沙箱兼容性问题 | 实验性功能 |
| 插件系统 | 暂不 | 需逐个插件适配 | 长期规划 |

---

## 七、风险与注意

### 7.1 已知坑
- **Windows 不支持 fcntl**: 文件锁降级为无锁，存在并发竞态
- **Windows 跳过 Agent SDK**: venv 的 Lib/ 布局不被 consumer glob 处理
- **自适应思考兼容性**: 4.6+ 模型用 adaptive，旧模型用 budget_tokens
- **OAuth vs API Key**: 401 时自动回退，需正确的 system prompt
- **Hook 并发竞态**: 多 Hook 并行执行可能导致状态丢失

### 7.2 数据目录/权限
- **API Key 安全**: 通过环境变量传递，不存文件
- **会话状态**: `~/.claude/security/` 目录权限
- **日志轮转**: 1MB 自动轮转

### 7.3 兼容性
- **Node.js 版本**: 要求 Node.js ≥18
- **API 端点**: `api.anthropic.com` vs 3P 提供商端点
- **代理环境**: NO_PROXY 需包含正确的域名

---

## 八、接入建议

| 维度 | 建议 |
|------|------|
| **接入程度** | 基础接入（对话 + 会话 + 配置） |
| **理由** | Claude Code 通过直接 API 即可使用核心能力，无需启动独立进程。基础接入可快速实现对话通路，后续通过插件/Hook 扩展 |
| **预估工作量** | 小 |
| **优先级** | 高

**接入路线图**:
1. 📋 **第一步**: ClaudeCodeAdapter（直接 /v1/messages API + SSE 流式解析）
2. 📋 **第二步**: 会话对接（GreenHorn JSONL 存储 + messages 传递）
3. 📋 **第三步**: 配置对接（API Key + 模型选择）
4. 🔮 **后续**: MCP 集成（插件开发）
5. 🔮 **后续**: Hook/安全审查接入

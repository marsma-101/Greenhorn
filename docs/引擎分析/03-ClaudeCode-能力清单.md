# Claude Code 引擎原生能力清单

> 分析日期: 2026-08-02
> 依据: docs/引擎分析/ClaudeCode-代码功能分析.md
> 原则: 只列引擎原生代码直接实现的能力，排除 MCP/Skill 实现的

---

## 1. 核心对话能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 流式对话 | ✅ | `/v1/messages` API | `llm.py:_call_claude()` | 默认开启 | SSE event流 |
| 思考/推理 | ✅ | adaptive thinking | `llm.py:_model_supports_adaptive_thinking()` | 模型自动 | 4.6+自适应/旧budget_tokens |
| 多模型支持 | ✅ | 3P提供商路由 | `llm.py:_is_3p_provider()` | 环境变量切换 | Bedrock/Vertex/Foundry/Mantle |
| Token统计 | ✅ | usage tracking | `_base.py:_record_usage()` | 自动 | input/output/cache/cost |
| 上下文压缩 | ❌ | — | — | — | — |

## 2. 原生工具能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 文件读写 | ✅ | Read/Write/MultiEdit | Agent内置工具 | 模型调用 | 通过API原生支持 |
| 脚本/终端执行 | ✅ | Bash工具 | Agent内置工具 | 模型调用 | 含PreToolUse Hook审批 |
| 代码搜索 | ✅ | Grep/Glob | Agent内置工具 | 模型调用 | 通过API原生支持 |
| 任务规划 | ❌ | — | — | — | — |
| 多工具并行 | ❌ | — | — | — | — |

## 3. 内置特殊工具

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 浏览器控制 | ❌ | — | — | — | — |
| 图像生成 | ❌ | — | — | — | — |
| 视觉分析 | ❌ | — | — | — | — |
| 语音/TTS | ❌ | — | — | — | — |
| 实时语音对话 | ❌ | — | — | — | — |
| 桌面控制 | ❌ | — | — | — | — |

## 4. 会话/记忆能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 会话持久化 | ✅ | JSON状态文件 | `session_state.py` | 自动 | security_warnings_state_*.json |
| 会话搜索 | ❌ | — | — | — | — |
| 会话改名 | ❌ | — | — | — | — |
| 会话删除 | ❌ | — | — | — | — |
| 记忆系统 | ❌ | — | — | — | — |
| 会话分叉/恢复 | ❌ | — | — | — | — |

## 5. 协作/网关能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 多Agent协作 | ❌ | — | — | — | — |
| IM Bot网关 | ❌ | — | — | — | — |
| 定时任务 | ❌ | — | — | — | — |
| 看板协作 | ❌ | — | — | — | — |

## 6. 独有原生能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| Hook安全审查 | ✅ | 5种Hook事件 | `hooks.json` + `security_reminder_hook.py` | SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Stop | 同步+异步重唤醒 |
| 双重审查 | ✅ | `_call_claude_dual_or()` | `llm.py:521-597` | SG_DUAL_OR=on | 并行两次LLM调用 |
| 竞态Agent审查 | ✅ | `_agentic_review_with_race()` | `security_reminder_hook.py:832-899` | 自动 | Agent式审查竞速 |
| Git基线审查 | ✅ | `capture_git_baseline()` | `diffstate.py:163-204` | UserPromptSubmit | git stash捕获基线 |
| 沙箱模式 | ✅ | Bash沙箱配置 | `examples/settings/settings-bash-sandbox.json` | 配置启用 | 网络/文件隔离 |
| 可扩展安全规则 | ✅ | `_has_redos_structure()` | `extensibility.py:272-289` | 用户自定义 | YAML/JSON正则规则 |
| Agent SDK自引导 | ✅ | `ensure_agent_sdk.py` | `ensure_agent_sdk.py` | SessionStart | 自动创建venv |
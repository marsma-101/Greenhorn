# Codex 引擎原生能力清单

> 分析日期: 2026-08-02
> 依据: docs/引擎分析/Codex-代码功能分析.md
> 原则: 只列引擎原生代码直接实现的能力，排除 MCP/Skill 实现的

---

## 1. 核心对话能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 流式对话 | ✅ | ResponseStream事件流 | `codex-rs/protocol/src/protocol.rs` | `turn/start` API | 多种事件类型 |
| 思考/推理 | ✅ | AgentReasoning事件 | `codex-rs/rollout/src/policy.rs:43` | ReasoningEffort配置 | 原生reasoning支持 |
| 多模型支持 | ✅ | 多provider适配 | `codex-rs/model-provider/` | 配置切换 | OpenAI/Bedrock/Ollama/LM Studio |
| 上下文压缩 | ✅ | 自动压缩 | `codex-rs/config/src/config_toml.rs` | 自动 | model_auto_compact_token_limit |
| Token统计 | ✅ | TokenCount事件 | `codex-rs/protocol/src/protocol.rs` | 自动 | 完整token计数 |

## 2. 原生工具能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 文件读写 | ✅ | fs/readFile, fs/writeFile | `codex-rs/app-server/README.md:200-209` | JSON-RPC调用 | 原生fs命名空间 |
| 脚本/终端执行 | ✅ | `add_shell_tools()` | `codex-rs/core/src/tools/spec_plan.rs:719-768` | exec_command工具 | bash/zsh执行 |
| 代码搜索 | ✅ | — | — | 内置工具 | 原生支持 |
| 任务规划 | ✅ | PlanHandler | `codex-rs/core/src/tools/handlers/plan.rs` | update_plan工具 | 结构化计划 |
| 多工具并行 | ✅ | parallel tool calls | `codex-rs/tools/src/tool_call.rs` | 自动 | supports_parallel_tool_calls |

## 3. 内置特殊工具

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 浏览器控制 | ✅ | browser_use特性 | `codex-rs/config/src/config_requirements.rs:60-61` | 配置启用 | Guardian审查流程 |
| 图像生成 | ❌ | — | — | — | — |
| 视觉分析 | ❌ | — | — | — | — |
| 语音/TTS | ❌ | — | — | — | — |
| 实时语音对话 | ✅ | Realtime协议 | `codex-rs/core/src/realtime_conversation.rs` | `thread/realtime/start` | V1/V2/V3协议 |
| 桌面控制 | ❌ | — | — | — | — |
| 网页搜索 | ✅ | WebSearchTool | `codex-rs/ext/web-search/src/tool.rs:45-55` | web.run工具 | Search/OpenPage/FindInPage |

## 4. 会话/记忆能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 会话持久化 | ✅ | JSONL rollout | `codex-rs/rollout/src/policy.rs` | 自动 | Legacy/Paginated两种模式 |
| 会话搜索 | ❌ | — | — | — | — |
| 会话改名 | ❌ | — | — | — | — |
| 会话删除 | ❌ | — | — | — | — |
| 记忆系统 | ✅ | MemoryStore | `codex-rs/state/src/runtime.rs` | generate_memories/use_memories | 线程级memory_mode |
| 会话分叉/恢复 | ✅ | thread/fork, thread/resume | `codex-rs/app-server/README.md:30-47` | JSON-RPC API | Thread三层抽象 |

## 5. 协作/网关能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 多Agent协作 | ✅ | spawn_agent/send_input/wait_agent | `codex-rs/core/src/tools/handlers/multi_agents/` | 工具调用 | V1/V2模式 |
| IM Bot网关 | ❌ | — | — | — | — |
| 定时任务 | ❌ | — | — | — | — |
| 看板协作 | ❌ | — | — | — | — |

## 6. 独有原生能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| App-Server JSON-RPC | ✅ | app-server协议 | `codex-rs/app-server/README.md` | `codex app-server` | stdio/WebSocket/Unix Socket |
| Thread/Turn/Item抽象 | ✅ | 三层会话模型 | `codex-rs/core/src/` | 自动 | 精细会话管理 |
| Code Mode | ✅ | ToolMode::CodeMode | `codex-rs/core/src/tools/spec_plan.rs:242-268` | 配置启用 | 工具转JSON协议 |
| Guardian审查 | ✅ | `codex-rs/core/src/guardian/` | `codex-rs/core/src/guardian/policy.md` | `review/start` API | 内联/分离审查 |
| Marketplace插件 | ✅ | marketplace/plugin系统 | `codex-rs/app-server/README.md:223-230` | CLI命令 | 远程插件管理 |
| 多Agent V2 | ✅ | V2协作协议 | `codex-rs/core/src/tools/handlers/multi_agents_v2/` | followup_task/interrupt_agent | V2增强模式 |
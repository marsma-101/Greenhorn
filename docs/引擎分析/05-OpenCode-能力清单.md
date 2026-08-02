# OpenCode 引擎原生能力清单

> 分析日期: 2026-08-02
> 依据: docs/引擎分析/OpenCode-代码功能分析.md
> 原则: 只列引擎原生代码直接实现的能力，排除 MCP/Skill 实现的

---

## 1. 核心对话能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 流式对话 | ✅ | LLMClient.stream() | `packages/llm/src/llm.ts:47` | SessionRunner启动 | 11种SSE事件 |
| 思考/推理 | ✅ | ReasoningStart/Delta/End | `packages/llm/src/schema/events.ts:106-126` | 模型原生 | reasoningTokens统计 |
| 多模型支持 | ✅ | 20+Provider SDK | `packages/core/package.json:64-83` | providers配置 | OpenAI/Anthropic/Google/Azure等 |
| 上下文压缩 | ✅ | compactIfNeeded() | `packages/core/src/session/runner/llm.ts:215` | 溢出自动触发 | SessionCompaction |
| Token统计 | ✅ | Usage字段 | `packages/llm/src/schema/events.ts:57` | 自动 | input/output/cache/reasoning |

## 2. 原生工具能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 文件读写 | ✅ | read.ts, write.ts | `packages/core/src/tool/read.ts`, `write.ts` | 工具调用 | 含分页、图片读取 |
| 脚本/终端执行 | ✅ | bash.ts | `packages/core/src/tool/bash.ts:18-201` | 工具调用 | 默认2分钟超时 |
| 代码搜索 | ✅ | glob.ts, grep.ts | `packages/core/src/tool/glob.ts`, `grep.ts` | 工具调用 | ripgrep封装 |
| 任务规划 | ✅ | TodoTable | `packages/core/src/session/sql.ts:100-117` | 工具调用 | 结构化Todo |
| 多工具并行 | ❌ | — | — | — | — |

## 3. 内置特殊工具

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 浏览器控制 | ❌ | — | — | — | — |
| 图像生成 | ❌ | — | — | — | — |
| 视觉分析 | ✅ | 图像读取缩放 | `packages/core/src/tool/read.ts:17` | read工具 | jpeg/png/gif/webp支持 |
| 语音/TTS | ❌ | — | — | — | — |
| 实时语音对话 | ❌ | — | — | — | — |
| 桌面控制 | ❌ | — | — | — | — |
| 网页搜索 | ❌ | — | — | — | — |

## 4. 会话/记忆能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 会话持久化 | ✅ | SQLite+Drizzle | `packages/core/src/session/sql.ts` | 自动 | session,message,input多表 |
| 会话搜索 | ❌ | — | — | — | — |
| 会话改名 | ❌ | — | — | — | — |
| 会话删除 | ❌ | — | — | — | — |
| 记忆系统 | ❌ | — | — | — | — |
| 会话分叉/恢复 | ✅ | SessionV2.prompt() | `packages/core/src/session/runner/llm.ts` | API调用 | 接纳与执行分离 |

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
| 三级权限系统 | ✅ | PermissionV2 | `packages/core/src/permission.ts` | 工具调用时 | allow/deny/ask+"always"记忆 |
| V2会话架构 | ✅ | SessionV2/SessionExecution | `packages/core/src/session/runner/llm.ts` | 自动 | 进程全局ID路由 |
| 事件溯源 | ✅ | EventV2 | `packages/core/src/session.ts:346-351` | 自动 | 发布/订阅机制 |
| 系统上下文代数 | ✅ | Source<A>系统 | `packages/core/src/system-context/index.ts` | 启动时 | 可组合上下文源 |
| 快照撤销 | ✅ | revert.stage/clear/commit | `packages/core/src/session.ts:433-453` | 工具调用 | 多步骤撤销 |
| HTTP API服务器 | ✅ | 17组Handler | `packages/server/src/handlers.ts` | `opencode serve` | 完整RESTful API |
| Pty终端 | ✅ | 终端模拟 | `packages/core/src/tool/bash.ts` | 工具调用 | node-pty原生依赖 |

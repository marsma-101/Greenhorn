# Reasonix 引擎原生能力清单

> 分析日期: 2026-08-02
> 依据: docs/引擎分析/Reasonix-代码功能分析.md
> 原则: 只列引擎原生代码直接实现的能力，排除 MCP/Skill 实现的

---

## 1. 核心对话能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 流式对话 | ✅ | Agent.Run() | `internal/agent/agent.go` | CLI/serve API | Provider流式API |
| 思考/推理 | ✅ | Thinking/Effort字段 | `internal/config/config.go:1254-1255` | Provider原生 | reasoningLanguage/responseLanguage |
| 多模型支持 | ✅ | Provider数组 | `internal/config/config.go` | [[providers]]配置 | 多Provider列表 |
| 上下文压缩 | ✅ | compact.go | `internal/agent/compact.go` | 自动触发 | 保留近期tail+归档 |
| Token统计 | ✅ | usage tracking | `internal/agent/agent.go` | 自动 | input/output tokens |

## 2. 原生工具能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 文件读写 | ✅ | write_file, edit_file, multi_edit | `internal/tool/builtin/writefile.go`, `editfile.go`, `multiedit.go` | 工具调用 | 精确字符串替换 |
| 脚本/终端执行 | ✅ | bash.go | `internal/tool/builtin/bash.go` | 工具调用 | mvdan.cc/sh解析 |
| 代码搜索 | ✅ | grep.go, glob.go | `internal/tool/builtin/grep.go`, `glob.go` | 工具调用 | 正则/模式搜索 |
| 任务规划 | ✅ | todo_write, complete_step | `internal/tool/builtin/todo.go`, `completestep.go` | 工具调用 | 带证据完成 |
| 多工具并行 | ✅ | Fleet并行 | `internal/agent/fleet.go` | 工具调用 | 2-64子任务并行 |

## 3. 内置特殊工具

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 浏览器控制 | ❌ | — | — | — | — |
| 图像生成 | ❌ | — | — | — | — |
| 视觉分析 | ❌ | — | — | — | — |
| 语音/TTS | ❌ | — | — | — | — |
| 实时语音对话 | ❌ | — | — | — | — |
| 桌面控制 | ❌ | — | — | — | — |
| 网页抓取 | ✅ | webfetch.go | `internal/tool/builtin/webfetch.go` | 工具调用 | HTML→纯文本转换 |

## 4. 会话/记忆能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 会话持久化 | ✅ | JSONL文件 | `internal/agent/session.go` | 自动 | 每行一条JSON消息 |
| 会话搜索 | ❌ | — | — | — | — |
| 会话改名 | ❌ | — | — | — | — |
| 会话删除 | ❌ | — | — | — | — |
| 记忆系统 | ✅ | remember/forget | `internal/control/memory.go` | 工具调用 | 项目级+用户级 |
| 会话分叉/恢复 | ✅ | LoadSession/SessionLease | `internal/agent/session.go`, `session_lease.go` | API调用 | 租约锁防冲突 |

## 5. 协作/网关能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| 多Agent协作 | ✅ | task/read_only_task | `internal/agent/task.go` | 工具调用 | 隔离上下文子Agent |
| IM Bot网关 | ✅ | QQ/飞书/微信 | `internal/bot/gateway.go` | `reasonix bot start` | 3平台Bot |
| 定时任务 | ❌ | — | — | — | — |
| 看板协作 | ❌ | — | — | — | — |

## 6. 独有原生能力

| 功能 | 支持 | 接口/实现 | 文件路径 | 触发方式 | 备注 |
|------|------|----------|---------|---------|------|
| Fleet并行调度 | ✅ | FleetTool | `internal/agent/fleet.go` | fleet工具 | 2-64子任务并行派发 |
| 双模型协作 | ✅ | Coordinator | `internal/agent/coordinator.go` | planner_model配置 | Planner-Executor模式 |
| Delivery Profile | ✅ | DeliveryRuntimeMarker | `internal/agent/agent.go:56-62` | delivery模式 | 强制验收标准 |
| Auto Guard | ✅ | RecoveryGate | `internal/agent/agent.go:324-338` | 自动 | 独立安全审查层 |
| ACP协议 | ✅ | ACP v1 | `internal/acp/protocol.go` | `reasonix acp` | stdio JSON-RPC |
| Plan Mode | ✅ | Ctrl+Y切换 | `internal/cli/cli.go` | 用户快捷键 | 规划需确认模式 |
| 代码索引 | ✅ | code_index工具 | `internal/tool/builtin/codeindex.go` | 工具调用 | go/parser+tree-sitter |

# Hermes Agent 对接方案

> 分析对象: Hermes Agent（Python v0.17.0）
> 生成日期: 2026-08-02
> 代码分析参考: docs/引擎分析/Hermes-代码功能分析.md

## 一、启动与生命周期管理

### 1.1 启动方式
- **CLI oneshot 模式**: `hermes -z "prompt"` — 一次性调用，返回结果后退出
- **交互式 CLI**: `hermes chat` — TUI 交互模式
- **网关守护进程**: `hermes gateway` — 多平台网关（Telegram/Discord/Slack/微信等）
- **ACP 协议模式**: `hermes-acp` — Agent Client Protocol 适配器
- **当前对接方式**: 使用 `hermes -z` oneshot CLI 模式（已实现）

### 1.2 状态检测
- **CLI 可执行检测**: 检查 `ai-agent/hermes/program/.venv/Scripts/hermes.exe` 是否存在
- **配置完整性检测**: 检查 `~/.hermes/config.yaml` 和 `~/.hermes/.env`
- **进程检测**: 检查 Hermes gateway 进程是否运行（非必要）
- **已实现**: `HermesAdapter.getStatus()` 实现了安装检测（检查 CLI 路径）

### 1.3 停止方式
- oneshot 模式：命令执行完毕自动退出
- 网关模式：`hermes gateway stop` 或 kill 进程

### 1.4 进程管理
- oneshot 模式无需进程管理（每次 spawn 一个子进程）
- 网关模式可选（不在第一阶段对接）

---

## 二、对话接入方式

### 2.1 接口类型
- **主要**: CLI 子进程调用（`hermes -z "prompt"`）
- **备选**: HTTP API（通过 gateway WebSocket，需认证 token）
- **ACP**: Agent Client Protocol（stdio JSON-RPC 2.0）

### 2.2 请求格式（CLI）
```bash
hermes -z "你的对话prompt（含 system prompt + 历史消息拼接）"
```
- system prompt 和对话历史需在调用前拼接为完整 prompt 字符串
- 支持 `--cwd` 指定工作目录
- 支持 `--model` 指定模型

### 2.3 响应格式（CLI stdout）
```
模型回复文本...
```
- 纯文本输出，无结构化 SSE 事件
- 退出码 0 = 成功，非 0 = 失败
- 错误信息在 stderr

### 2.4 流式支持
- ⚠️ oneshot 模式不支持真正的流式
- 完整输出后一次性返回
- 如果需要流式，需改用 gateway 或 ACP 模式（复杂度高）

### 2.5 现有 Adapter 复用分析
- **已实现**: `HermesAdapter` 继承 `EngineAdapter`，使用 `spawn()` 调用 `hermes -z`
- **可复用**: prompt 构建逻辑（system prompt + 历史消息拼接）
- **可复用**: 错误处理（stderr 解析、超时检测）
- **需增强**: 流式输出（需改用 gateway/ACP 模式）
- **Adapter 类名**: `HermesAdapter extends EngineAdapter`

---

## 三、会话存储接入

### 3.1 引擎原生存储格式
- **格式**: SQLite（WAL 模式），数据库文件 `~/.hermes/sessions/hermes_state.db`
- **FTS5 全文搜索**: 跨会话消息全文检索
- **会话链**: `parent_session_id` 支持压缩分叉和子代理会话
- **JSONL 导出**: 同时支持 JSONL 格式导出

### 3.2 对接策略
- **第一阶段**: 使用 Hermes 原生 SQLite 存储（保持 Hermes 自身的会话管理）
- **会话列表**: 通过 SQLite 查询 `sessions` 表获取会话列表
- **会话加载**: 从 SQLite 读取 `messages` 表恢复会话
- **会话写入**: Hermes oneshot 模式自动写入 SQLite

### 3.3 与会话 API 兼容
- 需要实现 `/api/sessions` 接口的 Hermes 适配器
- 从 SQLite 读取会话列表 → 转换为统一的 Session 格式
- 改名/删除操作直接操作 SQLite

---

## 四、配置接入

### 4.1 配置文件位置
- **主配置**: `~/.hermes/config.yaml`（YAML 格式）
- **敏感信息**: `~/.hermes/.env`（dotenv 格式，API Key）
- **可选技能**: `~/.hermes/optional-skills/`
- **可选 MCP**: `~/.hermes/optional-mcps/`
- **记忆**: `~/.hermes/memories/`（MEMORY.md + USER.md）

### 4.2 需暴露给用户的配置项
- ✅ 模型选择（model.default, model.base_url, model.provider）
- ✅ 终端配置（terminal.env_type, terminal.cwd）
- ✅ Agent 配置（agent.max_turns, agent.reasoning_effort）
- ✅ 工具集配置（toolsets 启用列表）
- ✅ MCP 服务器配置（mcp_servers）
- ✅ 技能管理（skills.disabled）

### 4.3 读写方式
- **读取**: 直接解析 `config.yaml` 文件
- **写入**: 修改 YAML 文件（需保留 YAML 格式）
- **敏感信息**: `.env` 文件操作（key=value 格式）
- **CLI 命令**: `hermes config show` 查看当前配置

---

## 五、工具调用接入

### 5.1 工具接口
- **原生工具系统**: `tools/registry.py` 中的 `ToolRegistry`，77+ 已注册工具
- **MCP 协议**: `tools/mcp_tool.py` 完整支持 stdio/HTTP/SSE 三种传输
- **工具集**: 通过 `toolsets` 配置启用/禁用工具集合
- **工具审批**: `tools/approval.py` 支持自动/手动审批

### 5.2 工具暴露方案
- **Hermes 自动管理工具**: 工具在 Hermes 运行时自动加载，LLM 自主调用
- **GreenHorn 侧**: 只需在配置中注入 MCP server 列表，Hermes 会自动发现
- **配置注入**: 将 GreenHorn 管理的 MCP servers 写入 `~/.hermes/config.yaml` 的 `mcp_servers` 字段

### 5.3 工具调用结果流式返回
- **oneshot 模式限制**: oneshot 模式下 Hermes 自主调用工具，最终结果合并为文本输出
- **gateway/ACP 模式**: 可通过事件流获取中间工具调用结果
- **第一阶段**: 接受 oneshot 模式的限制，后续升级到 gateway 模式

### 5.4 MCP 跨引擎共享
- ✅ Hermes 原生支持 MCP，可直接复用
- **统一 MCP 管理**: GreenHorn 后端实现 MCP 管理服务
- **注入方式**: 将 MCP server 配置写入 `~/.hermes/config.yaml`
- **优势**: Hermes 的 MCP 实现完整（stdio/HTTP/SSE + 采样 + 指数退避重连）

---

## 六、特有功能对接

### 6.1 独有功能
- **MoA（Mixture of Agents）**: 多模型协作（参考模型池 + 聚合模型）
- **Skills（技能系统）**: 渐进式披露架构（元数据→内容→关联文件）
- **Gateway（多平台网关）**: 9+ 平台适配器（Telegram/Discord/Slack/微信等）
- **Kanban（看板协作）**: 多智能体任务管理
- **Computer Use（桌面控制）**: 通过 cua-driver 实现桌面自动化
- **Context Compression**: 自动上下文压缩（独立压缩模型）
- **记忆系统**: MEMORY.md + USER.md 持久记忆
- **视觉分析/图像生成/语音 TTS**: 多模态能力

### 6.2 接入优先级
| 功能 | 优先级 | 接入方式 | 备注 |
|------|--------|---------|------|
| MoA 多模型协作 | 低 | 通过 Hermes prompt 中的 `/moa` 命令触发 | 需要 MoA 专用配置，复杂度高 |
| Skills 技能系统 | 中 | Hermes 原生支持，配置 `skills.disabled` 即可 | 与 GreenHorn 技能系统可互补 |
| MCP 工具接入 | 高 | 配置注入 `mcp_servers`，Hermes 自动发现 | 核心工具通道 |
| Gateway 多平台 | 暂不 | 不在 Web 对接范围 | 面向 IM 场景 |
| Kanban 看板 | 低 | 需额外 UI 开发 | 高级功能 |
| Computer Use | 暂不 | Windows 桌面控制需专项测试 | 实验性功能 |
| 上下文压缩 | 中 | Hermes 自动处理，可配置阈值 | 透明功能 |
| 记忆系统 | 中 | `~/.hermes/memories/` 直接读写 | 可通过文件管理 |

---

## 七、风险与注意

### 7.1 已知坑
- **Windows UTF-8**: Hermes 有专门的 `hermes_bootstrap.py` 处理 Windows UTF-8 stdio
- **日志轮转**: `concurrent-log-handler` 解决 Windows PermissionError
- **进程管理**: 使用 psutil 替代 POSIX-only 的 os.killpg
- **推理模型超时**: 为 o1/o3/R1 等推理模型设置超时地板
- **令牌污染**: `message_sanitization.py` 自动清理 surrogate 字符
- **并发实例冲突**: `dead_targets.py` 检测多实例冲突

### 7.2 数据目录/权限
- **默认路径（Windows）**: `%LOCALAPPDATA%\hermes`
- **可覆盖**: `HERMES_HOME` 环境变量
- **锁文件**: `logs/.__agent.lock` 可能导致权限冲突
- **SQLite WAL 模式**: 并发读写可能导致锁冲突

### 7.3 兼容性问题
- **Python 版本**: 需 Python ≥3.11, <3.14
- **Node.js**: Hermes 管理的 Node.js 用于部分工具
- **模型兼容性**: 不同模型 provider 的 API 格式差异

---

## 八、接入建议

| 维度 | 建议 |
|------|------|
| **接入程度** | 基础接入（对话 + 会话 + 配置 + MCP） |
| **理由** | Hermes 功能强大，但 oneshot 模式限制了流式和工具调用可见性。基础接入可快速验证对话通路，后续升级到 gateway 模式解锁全部能力 |
| **预估工作量** | 中 |
| **优先级** | 高 |

**接入路线图**:
1. ✅ **已完成**: HermesAdapter（oneshot CLI 模式）
2. 📋 **待完成**: 会话存储对接（SQLite 读写）
3. 📋 **待完成**: 配置读写接口（YAML 解析/写入）
4. 📋 **待完成**: MCP 配置注入
5. 🔮 **后续**: 升级到 gateway 模式（流式 + 工具可见性）
6. 🔮 **后续**: MoA/Skills 高级功能接入

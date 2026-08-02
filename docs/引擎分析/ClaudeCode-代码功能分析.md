# Claude Code 引擎代码功能分析

> 分析对象: `d:\program\GreenHorn\ai-agent\claude-code\program\`
> 分析日期: 2026-08-02
> 引擎版本: 1.0.0 (engine.json 中记录)

---

## 1. 引擎基本信息

| 属性 | 详情 |
|------|------|
| **语言/框架** | TypeScript/Node.js (主程序), Python (Hook 脚本), Shell/Bash (Hook 脚本) |
| **版本** | 1.0.0 (引擎配置), 插件版本各不同 (security-guidance 为 2.0.0) |
| **安装位置** | `D:\program\GreenHorn\ai-agent\claude-code\program` |
| **数据目录** | `D:\program\GreenHorn\ai-agent\claude-code\data` |
| **安装时间** | 2026-08-01T08:28:00.612Z |
| **启动机制** | 通过 `curl -fsSL https://claude.ai/install.sh \| bash` 安装, 或 `npm install -g @anthropic-ai/claude-code` (已废弃), 运行 `claude` 命令启动 |
| **npm 包** | `@anthropic-ai/claude-code` (Node.js 18+), 安装方式已转为官方安装脚本 |

### 代码结构概览

```
program/
├── Script/                    # PowerShell 启动脚本 (devcontainer)
├── examples/
│   ├── gateway/               # API 网关配置示例 (AWS/GCP Terraform)
│   ├── hooks/                 # Hook 脚本示例 (bash_command_validator)
│   ├── mdm/                   # 企业 MDM 部署模板 (macOS .mobileconfig, Windows ADML/ADMX + PowerShell)
│   └── settings/              # 设置文件示例 (lax/strict/bash-sandbox)
├── plugins/                   # 插件集合 (核心扩展机制)
│   ├── agent-sdk-dev/         # Agent SDK 开发助手
│   ├── claude-opus-4-5-migration/
│   ├── code-review/           # 代码审查插件
│   ├── commit-commands/       # Git 提交命令
│   ├── explanatory-output-style/  # 解释性输出模式
│   ├── feature-dev/           # 特性开发工作流
│   ├── frontend-design/        # 前端设计技能
│   ├── hookify/                # Hook 规则引擎
│   ├── learning-output-style/    # 学习模式
│   ├── plugin-dev/            # 插件开发工具集 (含大量文档)
│   ├── pr-review-toolkit/     # PR 审查工具包
│   ├── ralph-wiggum/          # Ralph Wiggum 循环技术
│   └── security-guidance/      # 安全指导 (最核心的插件)
├── scripts/                   # GitHub 自动化脚本 (TypeScript + Shell)
├── README.md
└── LICENSE.md
```

---

## 2. 配置体系

### 2.1 配置文件位置与格式

| 配置类型 | 路径 | 格式 | 说明 |
|---------|------|------|------|
| **引擎注册配置** | `data/config/engine.json` | JSON | 记录 engineId、installPath、dataPath、version |
| **用户设置** | `~/.claude/settings.json` | JSON | 用户级全局设置 |
| **项目设置** | `<project>/.claude/settings.json` | JSON | 项目级设置 |
| **本地项目设置** | `<project>/.claude/settings.local.json` | JSON | 本地 gitignored 设置 |
| **托管设置 (企业)** | `C:\Program Files\ClaudeCode\managed-settings.json` | JSON | 通过 MDM/GPO 部署 |
| **插件清单** | `<plugin>/.claude-plugin/plugin.json` | JSON | 插件元数据与组件路径 |
| **Hook 配置** | `<plugin>/hooks/hooks.json` | JSON | Hook 事件与命令映射 |
| **MCP 服务器** | `<plugin>/.mcp.json` | JSON | MCP 服务器配置 |
| **自定义安全规则** | `~/.claude/security-patterns.yaml` 或 `security-patterns.json` | YAML/JSON | 用户自定义正则安全检查 |
| **项目安全指南** | `~/.claude/claude-security-guidance.md` | Markdown | 项目特定安全策略 |

### 2.2 关键配置字段

根据 `examples/settings/settings-strict.json` 和 `examples/settings/settings-lax.json`:

```jsonc
{
  "permissions": {
    "disableBypassPermissionsMode": "disable",  // 禁止绕过权限模式
    "ask": ["Bash"],                             // Bash 工具需审批
    "deny": ["WebSearch", "WebFetch"]            // 禁用搜索/抓取
  },
  "allowManagedPermissionRulesOnly": true,       // 仅允许托管的权限规则
  "allowManagedHooksOnly": true,                 // 仅允许托管的 Hooks
  "strictKnownMarketplaces": [],                // 严格市场列表
  "sandbox": {                                   // Bash 沙箱配置
    "enabled": true,
    "autoAllowBashIfSandboxed": false,
    "network": { ... }
  }
}
```

### 2.3 存储位置

| 数据类型 | 存储路径 | 说明 |
|---------|---------|------|
| 引擎配置 | `data/config/engine.json` | 引擎注册信息 |
| 会话状态 | `~/.claude/security/security_warnings_state_*.json` | 每会话 JSON 状态文件 |
| 调试日志 | `~/.claude/security/log.txt` | 1MB 自动轮转 |
| SDK 虚拟环境 | `~/.claude/security/agent-sdk-venv/` | Agent SDK 隔离环境 |
| 已审查提交 | `.git/sg-reviewed-shas` | 仓库级已审查 SHA 记录 |
| 插件数据 | 各插件目录内 | 插件私有数据 |

---

## 3. 能力清单

### 3.1 核心能力矩阵

| 能力 | 支持 | 代码证据 | 触发方式 |
|------|------|---------|---------|
| **流式对话 (Streaming Chat)** | ✅ | `security-guidance/hooks/llm.py:_call_claude()` 第 386-507 行, 通过 Anthropic API `/v1/messages` 端点发送请求, 使用 `output_format: json_schema` 获取结构化输出 | 用户输入 → Claude Code 主循环 |
| **思考 (Thinking)** | ✅ | `llm.py:_model_supports_adaptive_thinking()` 第 226-240 行, 支持 `thinking: {type: "adaptive"}` (4.6+ 模型) 和 `thinking: {type: "enabled", budget_tokens}` (旧模型) | 模型自动启用, 根据模型版本选择方式 |
| **工具调用 (Tool Calling)** | ✅ | `security-guidance/hooks/security_reminder_hook.py:check_patterns()` 第 386-427 行检查 Write/Edit 工具输出; `hooks.json` 定义了 `PostToolUse` matcher `Edit\|Write\|MultiEdit\|NotebookEdit` | Agent 自动调用, 由 Hook 系统拦截和审查 |
| **文件操作 (File Operations)** | ✅ | `patterns.py` 中 `pickle_deserialization`、`unsafe_yaml_load`、`torch_unsafe_load` 等规则检查文件读写操作的安全性 | Agent 通过 Read/Write/Edit 工具, Hook 在 PostToolUse 审查 |
| **脚本执行 (Script Execution)** | ✅ | `hooks.json` 中 `PostToolUse` matcher `Bash` 拦截 git commit/push 操作; `bash_command_validator_example.py` 拦截 Bash 命令并改用 ripgrep | Agent 通过 Bash 工具, PreToolUse Hook 审批, PostToolUse Hook 审查 |
| **浏览器控制 (Browser Control)** | ❌ | 代码中无任何浏览器自动化相关 (Selenium/Puppeteer/Playwright) | 不适用 |
| **任务规划 (Task Planning)** | ✅ | `plugins/ralph-wiggum/ralph-wiggum.md`: 实现 "Ralph Wiggum 技术" — 持续 self-referential AI 循环; `plugins/feature-dev/agents/` 含 `code-architect.md`、`code-explorer.md`、`code-reviewer.md` 专用 Agent | Agent 自动分解任务, 或通过插件命令 `/ralph-loop` 启动循环 |
| **搜索 (Search)** | ✅ | `llm.py:_call_claude()` 通过 Anthropic API 对话; `analyze_code_security()` 第 710-763 行在安全审查时分析代码内容; Hook 中 `Grep`/`Glob` 用于代码分析 | Agent 使用内置搜索工具; WebSearch/WebFetch 可通过 settings 禁用 |
| **其他: 插件系统** | ✅ | `plugin.json` manifest-reference.md: 插件可含 commands (斜杠命令)、agents (专用 Agent)、hooks (拦截机制)、mcpServers (MCP 服务器) | 插件自动加载, 命令通过 `/command-name` 调用 |
| **其他: MCP 集成** | ✅ | `plugin-dev/skills/mcp-integration/` 提供 Stdio/SSE/HTTP 三种 MCP 服务器集成示例 | 插件 manifest 的 `mcpServers` 字段声明 MCP 服务器 |
| **其他: 安全审查** | ✅ | `security-guidance` 插件约 3000+ 行 Python, 包含 25+ 安全模式 (`patterns.py:SECURITY_PATTERNS`), 支持 LLM 驱动的深度审查 | 自动触发: SessionStart 引导、UserPromptSubmit 基线捕获、PostToolUse 编辑审查、Stop 全面审查 |
| **其他: Agent SDK** | ✅ | `ensure_agent_sdk.py` 在 SessionStart 时自动创建 Python venv 并安装 `claude-agent-sdk`; `llm.py:_call_claude_via_sdk()` 支持通过 SDK 调用 Claude | SessionStart 时自引导, 支持 Bedrock/Vertex/Foundry/Mantle 第三方提供商 |

### 3.2 详细能力说明

#### 3.2.1 流式对话 + 思考
- **证据**: `llm.py:_call_claude()` 第 424-445 行
  ```python
  payload["thinking"] = {"type": "adaptive"}       # 4.6+ 模型
  payload["output_config"] = {"effort": "high"}
  # 或旧模型:
  payload["thinking"] = {"type": "enabled", "budget_tokens": thinking_budget}
  ```
- 支持自适应思考 (adaptive thinking) 和旧版 budget_tokens 两种模式
- 流式 JSON Schema 结构化输出: `"output_format": {"type": "json_schema", "schema": output_schema}`

#### 3.2.2 工具调用 + Hook 拦截
- **证据**: `hooks.json` (security-guidance) 第 25-55 行
  ```json
  "PostToolUse": [{
    "matcher": "Edit|Write|MultiEdit|NotebookEdit",
    "hooks": [{ "type": "command", "command": "...security_reminder_hook.py" }]
  }]
  ```
- 工具类型覆盖: Bash, Edit, Write, MultiEdit, NotebookEdit 等
- Matcher 支持正则和前缀匹配: `Bash(git commit:*)` 匹配 git commit 命令

#### 3.2.3 文件操作安全审查
- **证据**: `patterns.py:SECURITY_PATTERNS` 第 30-261 行, 25 条规则覆盖:
  - `pickle_deserialization` — pickle 反序列化
  - `unsafe_yaml_load` — 不安全 YAML 加载
  - `torch_unsafe_load` — PyTorch 不安全加载
  - `os_system_injection` / `python_subprocess_shell` — 命令注入
  - `go_exec_shell_injection` — Go shell 注入
  - `tls_verification_disabled` — TLS 验证禁用
  - `eval_injection` / `new_function_injection` — 代码注入
  - XSS 系列: `react_dangerously_set_html`, `innerHTML_xss`, `outerHTML_xss`, `insertAdjacentHTML_xss`, `document_write_xss`
  - `github_actions_workflow` — GitHub Actions 注入
  - `xml_unsafe_parse` — XML XXE
  - `marshal_loads` / `shelve_open` — 反序列化

#### 3.2.4 脚本执行审批
- **证据**: `bash_command_validator_example.py` 第 48-79 行
  ```python
  def main():
      # 从 stdin 读取 JSON, 校验 Bash 命令
      # exit(2) 阻断工具调用并显示警告
      sys.exit(2)
  ```
- PreToolUse Hook 在工具执行前拦截, exit code 含义:
  - `0`: 放行
  - `1`: 展示错误但不阻断
  - `2`: 阻断工具调用

#### 3.2.5 任务规划 (Ralph Wiggum 循环)
- **证据**: `plugins/ralph-wiggum/ralph-wiggum.md` 和 `ralph-loop.md`
  - Ralph Wiggum 技术: `while true` 循环 + 相同 prompt, 持续迭代直到任务完成
  - 通过 `/ralph-loop` 命令启动, `/cancel-ralph` 取消

#### 3.2.6 搜索与代码分析
- **证据**: `security_reminder_hook.py:check_patterns()` 第 386-427 行, 使用正则和子字符串匹配
- **证据**: `gitutil.py:_prioritize_diff_files()` 第 512-547 行, 根据安全风险令牌 (auth, exec, sql, secret 等) 排序文件审查优先级
- **证据**: `llm.py:analyze_code_security()` 第 710-835 行, 深度安全审查 prompt 覆盖 25+ 漏洞类别

---

## 4. 特有功能

### 4.1 插件系统 (Plugin System)

代码证据: `plugin-dev/skills/plugin-structure/references/manifest-reference.md`

插件是 Claude Code 的核心扩展机制。每个插件包含:

| 组件 | 路径 (默认) | 说明 |
|------|-----------|------|
| `commands/` | `.claude-plugin/plugin.json` 中 `commands` 字段 | 斜杠命令 (`.md` 文件, 含 frontmatter) |
| `agents/` | `agents/` 目录 | 专用 Agent 定义 (`.md` 文件) |
| `hooks/` | `hooks/hooks.json` | Hook 事件处理器 |
| `skills/` | `skills/` 目录 | 技能定义, 含参考资料和示例 |
| `mcpServers/` | `.mcp.json` | MCP 服务器声明 |

**插件加载机制**: 按目录扫描 → manifest 中 `commands`/`agents`/`hooks`/`mcpServers` 字段追加 → 合并注册 (无覆盖, 冲突报错)

### 4.2 Hook 系统

代码证据: `hooks.json` 各插件 + `plugin-dev/skills/hook-development/references/advanced.md`

**Hook 事件类型**:
| 事件 | 触发时机 | 典型用途 |
|------|---------|---------|
| `SessionStart` | 会话开始 | 初始化、SDK 引导、注入 system prompt |
| `UserPromptSubmit` | 用户提交 prompt | 捕获 git 基线、记录状态 |
| `PreToolUse` | 工具执行前 | 审批、安全检查、命令替换 |
| `PostToolUse` | 工具执行后 | 结果审查、安全扫描、commit 审查 |
| `Stop` | Agent 完成回合 | 最终审查、汇总反馈 |

**Hook 执行机制**:
- **同步 (sync)**: 阻塞工具调用/回合, 适合快速检查
- **异步重唤醒 (asyncRewake)**: 后台执行, 完成后重新唤醒 Agent, 适合 LLM 审查
- **Matcher**: 支持工具名正则匹配, 如 `Edit\|Write\|MultiEdit`、`Bash(git commit:*)`
- **条件匹配**: `if` 字段支持更细粒度的条件

### 4.3 双重审查 (Dual Review)

代码证据: `llm.py:_call_claude_dual_or()` 第 521-597 行

- 并行两次 LLM 调用, OR 合并结果
- 独立采样捕捉边界情况
- 可通过 `SG_DUAL_OR=on` 启用 (默认关闭以节省 API 成本)
- 每次调用失败自动 fallback 到 Sonnet 模型

### 4.4 竞态 Agent 审查

代码证据: `security_reminder_hook.py:_agentic_review_with_race()` 第 832-899 行

- Agent 式审查 (investigate → self-refute) 与单次审查竞速
- 延迟 180s 后 fallback 启动
- 哪个先完成用哪个结果

### 4.5 Git 基线驱动审查

代码证据: `diffstate.py:capture_git_baseline()` 第 163-204 行, `diffstate.py:compute_v2_review_set()` 第 353-438 行

- 使用 `git stash create` 捕获工作树基线 SHA
- v2 审查集: `(当前脏文件 ∪ 本轮提交文件) ∩ (相对于基线的变更)`
- 排除基线时已存在的未追踪文件 (通过 mtime 快照)
- 支持 worktree 场景

### 4.6 第三方提供商路由

代码证据: `llm.py:_is_3p_provider()` 第 261-271 行

- 支持: Bedrock (`CLAUDE_CODE_USE_BEDROCK`)、Vertex (`CLAUDE_CODE_USE_VERTEX`)、Foundry (`CLAUDE_CODE_USE_FOUNDRY`)、Mantle (`CLAUDE_CODE_USE_MANTLE`)
- 3P 环境下通过 Agent SDK 子进程调用, 继承父进程凭证
- 1P 环境下直接 HTTP 调用 `api.anthropic.com`

### 4.7 MDM 企业部署

代码证据: `examples/mdm/windows/Set-ClaudeCodePolicy.ps1` 和 `managed-settings.json`

- Windows: 通过 Intune/GPO 部署 `managed-settings.json` 到 `C:\Program Files\ClaudeCode\`
- macOS: `.mobileconfig` + `.plist` 配置文件
- 设置层级: 企业托管 > 用户 > 项目

### 4.8 沙箱模式

代码证据: `examples/settings/settings-bash-sandbox.json`

- Bash 工具可选沙箱模式: 网络限制、文件系统隔离
- 支持 Unix socket 白名单、域名白名单
- `autoAllowBashIfSandboxed`: 沙箱内自动放行

### 4.9 可扩展安全规则

代码证据: `extensibility.py`

- `claude-security-guidance.md`: Markdown 格式, 追加到每次 LLM 审查 prompt
- `security-patterns.{yaml,json}`: 用户自定义正则/子字符串规则
- 三级发现优先级: 用户级 (`~/.claude/`) < 项目级 (`.claude/`) < 本地项目级 (`.claude/*.local.*`)
- ReDoS (正则拒绝服务) 结构检测

### 4.10 Agent SDK 自引导

代码证据: `ensure_agent_sdk.py`

- SessionStart 时检测 `claude_agent_sdk` 是否可用
- 自动创建 venv (`~/.claude/security/agent-sdk-venv`) 并 pip 安装
- 并发保护: 通过 sentinel 文件防止重复构建
- Windows 平台自动跳过 (不兼容)

---

## 5. 数据目录与状态

### 5.1 会话 (Sessions)

| 项目 | 路径/格式 | 说明 |
|------|----------|------|
| 会话 ID | UUID (或 `CLAUDE_CODE_REMOTE_SESSION_ID`) | 远程模式下跨进程稳定 |
| 会话状态文件 | `~/.claude/security/security_warnings_state_{key}.json` | JSON 格式, 含 `shown_warnings`、`touched_paths`、`baseline_sha`、`previous_findings`、`counters`、`rate_limits`、`pending_warnings` |
| 状态锁 | `~/.claude/security/security_warnings_state_{key}.lock` | fcntl 文件锁 (Windows 下降级为无锁) |
| 状态清理 | 30 天未修改的状态文件和锁文件自动清理 | `cleanup_old_state_files()` |

### 5.2 Prompts

| 项目 | 位置 | 说明 |
|------|------|------|
| System Prompt | `llm.py:CLAUDE_CODE_SYSTEM_PROMPT` | `"You are a Claude agent, built on Anthropic's Claude Agent SDK."` |
| 安全审查 Prompt | `llm.py:analyze_code_security()` 第 786-835 行 | 含详细的漏洞类别检查指令 |
| Agentic 审查 Prompt | `review_api.py:AGENTIC_INVESTIGATE_SYSTEM` | 两阶段 (investigate → self-refute) 深度审查 |
| 自定义安全指南 | `extensibility.py:_load_guidance()` | 从 `claude-security-guidance.md` 加载, 包装在 `<project-security-guidance>` 块中 |

### 5.3 Skills

| 项目 | 路径 | 说明 |
|------|------|------|
| Skill 格式 | `plugins/{name}/skills/{skill-name}/SKILL.md` | Markdown 定义, 含参考资料和示例 |
| 内置 Skills | `plugin-dev` 下含 7 个 Skill (agent-development, command-development, hook-development, mcp-integration, plugin-settings, plugin-structure, skill-development) | 插件开发完整指南 |
| 其他 Skills | `claude-opus-4-5-migration`, `frontend-design` | 特定场景技能 |

### 5.4 状态检测

| 检测项 | 实现方式 | 代码证据 |
|--------|---------|---------|
| 远程环境检测 | `CLAUDE_CODE_REMOTE` 环境变量 | `llm.py:ensure_anthropic_reachable()` 第 130 行 |
| 3P 提供商检测 | `CLAUDE_CODE_USE_BEDROCK` 等环境变量 | `llm.py:_is_3p_provider()` 第 261-271 行 |
| API 凭证检测 | `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / 3P 提供商标志 | `llm.py:HAS_API_CREDENTIALS` 第 56-58 行 |
| API 可达性探测 | `ensure_anthropic_reachable()`: HEAD 请求 + NO_PROXY 清理 | `llm.py` 第 102-141 行 |
| 凭证类型自适应 | 401 自动从 API Key 切换到 OAuth Token | `llm.py:_call_claude()` 第 463-467 行 |
| SDK 可用性 | `importlib.util.find_spec("claude_agent_sdk")` | `ensure_agent_sdk.py:_sdk_on_syspath()` 第 35-42 行 |
| Git 仓库检测 | `git rev-parse HEAD` / `git rev-parse --show-toplevel` | `gitutil.py:_git_rev_parse_head()` 第 32-43 行 |

### 5.5 状态文件结构

```json
{
  "shown_warnings": ["ruleName1", "ruleName2"],
  "touched_paths": ["/path/to/file1.py", "/path/to/file2.js"],
  "baseline_sha": "abc123...",
  "head_at_capture": "def456...",
  "untracked_at_baseline": {"new_file.py": 1700000000000000000},
  "stop_hook_fire_count": 0,
  "stop_hook_fire_count_ts": 1700000000,
  "previous_findings": [{"filePath": "...", "category": "...", "vulnerableCode": "..."}],
  "previous_findings_ts": 1700000000,
  "counters": {"commit_review": 1},
  "rate_limits": {"push_sweep": [1700000000, 1700000030]},
  "pending_warnings": {"file.py:eval_injection": true}
}
```

---

## 6. 已踩的坑 (适配注意事项)

### 6.1 跨平台兼容性

| 问题 | 说明 | 代码证据 |
|------|------|---------|
| **Windows 不支持 fcntl** | 文件锁在 Windows 下降级为无锁, 存在并发竞态风险 | `session_state.py` 第 133-138 行: `if fcntl is None: state = load_state(...)` |
| **Windows 跳过 Agent SDK** | venv 的 `Lib/` 布局不被 consumer glob 处理 | `ensure_agent_sdk.py` 第 66-67 行: `if sys.platform == "win32": return SKIP_WIN32` |
| **Windows PowerShell** | 提供了 `.ps1` 安装脚本和 MDM 部署脚本 | `examples/mdm/windows/Set-ClaudeCodePolicy.ps1` |
| **路径分隔符** | 代码中统一转换路径分隔符: `norm = "/" + file_path.replace("\\", "/")` | `gitutil.py:_is_reviewable_source()` 第 555 行 |

### 6.2 模型兼容性

| 问题 | 说明 | 代码证据 |
|------|------|---------|
| **自适应思考 vs 旧模型** | 4.6+ 模型不接受 `budget_tokens` 形式, 旧模型不接受 `adaptive` | `llm.py:_model_supports_adaptive_thinking()` 第 226-240 行 |
| **提供商路由差异** | 3P 提供商 (Bedrock/Vertex) 不支持 `api.anthropic.com` 端点 | `llm.py:_is_3p_provider()` + `_call_claude_via_sdk()` |
| **OAuth vs API Key** | OAuth token 需正确的 system prompt, 401 时自动回退 | `llm.py:_call_claude()` 第 463-467 行 |

### 6.3 Hook 系统限制

| 问题 | 说明 | 代码证据 |
|------|------|---------|
| **超时限制** | SessionStart 异步超时 180s, 同步 Hook 默认超时更短 | `ensure_agent_sdk.py` 第 195 行: `"asyncTimeout": 180000` |
| **并发竞态** | 多 Hook 并行执行, 假设执行顺序会导致状态丢失 | `advanced.md` 第 442-447 行: "BAD: Assumes hooks run in specific order" |
| **Matcher 语义** | `Bash(git commit:*)` 前缀匹配, 但不支持 `git -C` 全局选项 | `security_reminder_hook.py` 第 594-598 行注释说明 |
| **异步重唤醒 (asyncRewake)** | 后台审查可能在用户下一个 prompt 提交后才完成, 导致竞态 | `security_reminder_hook.py:handle_user_prompt_submit()` 第 486-513 行: baseline 保留机制 |
| **exit code 语义** | `exit(2)` 阻断, `exit(1)` 仅警告, `exit(0)` 放行 | `bash_command_validator_example.py` 第 78 行 |
| **metrics 字段限制** | Hook metrics 仅接受 bool/number, key 名 `^[a-z][a-z0-9_]{0,39}$`, 上限 20 keys | `security_reminder_hook.py:emit_metrics()` 第 201-203 行注释 |

### 6.4 安全规则限制

| 问题 | 说明 | 代码证据 |
|------|------|---------|
| **内置规则不可禁用** | `ENABLE_PATTERN_RULES=0` 只能全部禁用, 无单规则开关 | `security_reminder_hook.py` 第 142-143 行注释 |
| **自定义规则 ReDoS 检测** | 自定义正则可能被拒绝 (灾难性回溯结构) | `extensibility.py:_has_redos_structure()` 第 272-289 行 |
| **审查集大小限制** | 单文件 80KB, 总计 400KB, 超过则截断 | `review_api.py:DIFF_PER_FILE_BYTES` / `DIFF_TOTAL_BYTES` |
| **文件数量限制** | 最多审查 30 个文件, 超过则按风险优先级排序 | `security_reminder_hook.py:MAX_DIFF_FILES` |

### 6.5 网关与 API 配置

| 问题 | 说明 | 代码证据 |
|------|------|---------|
| **自定义 API 端点** | 支持通过 `ANTHROPIC_BASE_URL` 路由到 LLM 网关 (LiteLLM 等) | `llm.py:_anthropic_base_url()` 第 90-99 行 |
| **代理环境** | NO_PROXY 中包含 `anthropic.com` 会导致连接黑洞, 代码自动清理 | `llm.py:_strip_anthropic_from_no_proxy()` 第 113-119 行 |
| **SDK 路径覆盖** | `SG_AGENTIC_CLI_PATH` 可指定自定义 Claude CLI 路径 | `llm.py:_call_claude_via_sdk()` 第 320 行 |

### 6.6 可观测性

| 问题 | 说明 | 代码证据 |
|------|------|---------|
| **调试日志轮转** | 1MB 自动轮转, 最多保留 2 份 | `_base.py:DEBUG_LOG_MAX_BYTES = 1 * 1024 * 1024` |
| **Token 使用统计** | 每次 API 调用累计 input/output/cache/cost | `_base.py:_record_usage()` 第 109-139 行 |
| **审查结果去重** | `previous_findings` 列表防止重复标记同一漏洞 | `llm.py:_dedup_against_state()` 第 685-707 行 |
| **提交审查去重** | `.git/sg-reviewed-shas` 记录已审查 SHA, 每仓最多 500 条 | `diffstate.py:_REVIEWED_SHAS_CAP = 500` |

### 6.7 开发环境适配

| 问题 | 说明 | 代码证据 |
|------|------|---------|
| **Node.js 版本** | 要求 Node.js 18+ | `README.md` 徽章: `Node.js-18%2B` |
| **npm 安装已废弃** | 推荐使用官方安装脚本 | `README.md` 第 15-44 行: npm 标记为 "Deprecated" |
| **插件版本管理** | 各插件独立版本号 (plugin.json), 通过 `_read_plugin_version_int()` 编码为整数 | `_base.py:_read_plugin_version_int()` 第 70-79 行 |
| **环境变量覆盖** | 大量功能可通过环境变量开关 (ENABLE_*, SECURITY_GUIDANCE_*) | `security_reminder_hook.py` 第 137-177 行 |

### 6.8 关键环境变量汇总

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ANTHROPIC_API_KEY` | String | "" | API 密钥 |
| `ANTHROPIC_AUTH_TOKEN` | String | "" | OAuth Token |
| `ANTHROPIC_BASE_URL` | String | `https://api.anthropic.com` | API 基础 URL |
| `SECURITY_REVIEW_MODEL` | String | `claude-opus-4-7` | 审查模型 |
| `ENABLE_CODE_SECURITY_REVIEW` | String | `"1"` | LLM 审查开关 |
| `ENABLE_PATTERN_RULES` | String | `"1"` | 模式匹配开关 |
| `ENABLE_COMMIT_REVIEW` | String | `"1"` | 提交审查开关 |
| `ENABLE_STOP_REVIEW` | String | `"1"` | Stop Hook 审查开关 |
| `SECURITY_GUIDANCE_DISABLE` | String | "" | 主开关 (`"1"` 禁用) |
| `CLAUDE_CODE_REMOTE` | String | "" | 远程模式 |
| `CLAUDE_CODE_USE_BEDROCK` 等 | String | "" | 3P 提供商开关 |
| `MAX_STOP_HOOK_FIRINGS` | Int | `3` | Stop Hook 最大触发次数 |
| `MAX_DIFF_FILES` | Int | `30` | 最大审查文件数 |
| `SG_DUAL_OR` | String | "" | 双轨审查开关 |
| `SG_AGENTIC_RACE_DELAY_S` | Int | `180` | Agent 竞态延迟 |
| `DIFF_PER_FILE_BYTES` | Int | `80000` | 单文件字节上限 |
| `DIFF_TOTAL_BYTES` | Int | `400000` | 总字节上限 |
| `SECURITY_WARNINGS_STATE_DIR` | String | `~/.claude/security` | 状态目录 |
| `SECURITY_GUIDANCE_DEBUG_LOG` | String | `~/.claude/security/log.txt` | 调试日志路径 |

---

## 附录 A: 文件索引

| 文件路径 | 行数 | 核心功能 |
|---------|------|---------|
| `plugins/security-guidance/hooks/security_reminder_hook.py` | ~3500+ | 主审查逻辑 (UserPromptSubmit/PostToolUse/Stop) |
| `plugins/security-guidance/hooks/patterns.py` | 345 | 25 条安全模式定义 |
| `plugins/security-guidance/hooks/llm.py` | 835 | LLM API 调用 + Agent SDK 集成 |
| `plugins/security-guidance/hooks/gitutil.py` | 722 | Git 工具封装 + diff 解析 |
| `plugins/security-guidance/hooks/diffstate.py` | 438 | Diff 状态管理 + v2 审查集计算 |
| `plugins/security-guidance/hooks/session_state.py` | 160 | 会话状态 JSON + 文件锁 |
| `plugins/security-guidance/hooks/review_api.py` | ~500+ | Agentic 审查公共 API |
| `plugins/security-guidance/hooks/extensibility.py` | 289 | 可扩展规则加载 |
| `plugins/security-guidance/hooks/_base.py` | 156 | 共享底层工具 |
| `plugins/security-guidance/hooks/ensure_agent_sdk.py` | 225 | Agent SDK 自引导 |
| `plugins/security-guidance/hooks/hooks.json` | 71 | Hook 事件配置 |

## 附录 B: 代码统计

- **插件总数**: 12 个
- **Hook 事件类型**: 5 种 (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop)
- **安全模式规则**: 25 条 (内置)
- **漏洞类别覆盖**: 30+ (代码注入、命令注入、XSS、SSRF、SQL 注入、反序列化、TLS、OAuth 等)
- **支持的编程语言识别**: 20+ (Python, JavaScript, TypeScript, Go, Java, Ruby, PHP, Rust, C, C++, Swift, Kotlin 等)
- **3P 提供商**: 4 种 (Bedrock, Vertex, Foundry, Mantle)
- **模型支持**: claude-3 系列、opus-4-0/4-1/4-5/4-6/4-7、sonnet-4-0/4-5/4-6、haiku-4-5
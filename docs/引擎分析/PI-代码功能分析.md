# PI 引擎代码功能分析

> 分析对象: PI 引擎（GreenHorn 内置轻量对话引擎）
> 分析日期: 2026-08-02
> 引擎版本: 0.1.0 (PIAdapter 中硬编码)

---

## 1. 引擎基本信息

| 属性 | 详情 |
|------|------|
| **语言/框架** | TypeScript / Node.js (Express.js HTTP 框架) |
| **版本** | 0.1.0 (PIAdapter.getStatus() 中硬编码 version: '0.1.0') |
| **安装位置** | PI 无独立 program 目录，代码嵌入在 GreenHorn 后端 `packages/backend/src/` 中 |
| **数据目录** | `D:\program\GreenHorn\ai-agent\pi\data` |
| **启动机制** | 作为 GreenHorn Express 路由启动（随后端服务一起启动），同时可选连接独立 PI Agent 进程（`http://127.0.0.1:1001`） |
| **npm 包** | 无独立 npm 包，依赖 Express.js、Node.js 原生 fetch |

### 代码结构概览

PI 引擎并非独立的程序包，而是 GreenHorn 后端内置的一组服务和路由，分布在以下文件中：

```
packages/backend/src/
├── adapters/
│   ├── base.ts                  # 引擎适配器抽象基类 (EngineAdapter, registry)
│   └── pi-adapter.ts            # PI 适配器实现（连接独立 PI Agent 进程）
├── routes/
│   ├── chat.ts                  # 对话路由（方案 B：直接调用 OpenAI 兼容 API）
│   ├── config.ts                # 配置路由（auth.json / models.json 读写）
│   ├── sessions.ts              # 会话路由（JSONL 格式会话管理）
│   ├── settings.ts              # 设置路由（settings.json 读写）
│   ├── skills.ts                # 技能路由（CRUD + 扫描 + 导入）
│   ├── templates.ts             # 提示词模板路由
│   ├── pi-check.ts              # PI 安装检测路由
│   └── engines.ts               # 引擎管理路由
├── services/
│   ├── chat-engine.ts           # 核心对话引擎（streamChat / verifyApiKey）
│   ├── pi-config.ts             # PI 配置服务（数据目录 / 环境变量）
│   ├── ai-agent-manager.ts      # AI Agent 管理器（目录结构 + 引擎检测）
│   ├── engine-installer/        # 引擎安装器（克隆/安装/配置）
│   ├── skill-manager.ts         # 技能管理服务
│   ├── skill-scanner.ts         # 技能扫描器
│   └── template-manager.ts      # 提示词模板管理服务
```

---

## 2. 配置体系

### 2.1 配置文件位置与格式

| 配置类型 | 路径 | 格式 | 说明 |
|---------|------|------|------|
| **引擎注册配置** | `ai-agent/pi/data/config/engine.json` | JSON | 记录 engineId、installPath、dataPath、version（由 engine-installer 生成） |
| **API 认证配置** | `~/.pi/agent/auth.json`（或 `PI_CODING_AGENT_DIR/auth.json`） | JSON | 按供应商存储 API Key 和 BaseURL |
| **模型配置** | `~/.pi/agent/models.json`（或 `PI_CODING_AGENT_DIR/models.json`） | JSON | 存储默认供应商、默认模型 |
| **用户设置** | `~/.pi/agent/settings.json`（或 `PI_CODING_AGENT_DIR/settings.json`） | JSON | persona、thinking level、session dir、compaction 等 |
| **GreenHorn 持久配置** | `<project>/.data/pi-config.json` | JSON | 存储 sourcePath 和 configPath，用于启动时注入环境变量 |

### 2.2 关键配置字段

**auth.json** — 多供应商 API 配置：
```json
{
  "deepseek": { "apiKey": "xxx", "baseUrl": "https://api.deepseek.com/v1" },
  "ollama": { "apiKey": "", "baseUrl": "http://localhost:11434/v1" },
  "tongyi": { "apiKey": "xxx", "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1" }
}
```

**models.json** — 模型选择：
```json
{
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-chat"
}
```

**settings.json** — 用户偏好：
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hideThinkingBlock` | boolean | `false` | 是否隐藏思考过程 |
| `defaultThinkingLevel` | string | `'off'` | 默认思考级别（off/low/medium/high） |
| `quietStartup` | boolean | `false` | 安静启动模式 |
| `sessionDir` | string | `'~/.pi/agent/sessions'` | 会话存储路径 |
| `compaction.enabled` | boolean | `false` | 上下文压缩开关 |
| `compaction.reserveTokens` | number | `4096` | 压缩时保留 token 数 |
| `persona` | string | `''` | AI 人设文本 |
| `enginePersonas` | object | `{}` | 按引擎 ID 存储的人设 |

**PI 适配器特有参数**（chat 请求体）：
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `messages` | array | - | 格式化后的消息列表 |
| `temperature` | number | `0.7` | 温度参数 |
| `max_tokens` | number | `4096` | 最大 token 数 |
| `stream` | boolean | `true` | 是否流式输出 |
| `session_id` | string | - | 会话 ID |

### 2.3 配置存放位置

配置存放位置受环境变量 `PI_CODING_AGENT_DIR` 控制：
- **有环境变量**：所有配置存放在 `PI_CODING_AGENT_DIR` 指定目录
- **无环境变量**：默认存放在 `~/.pi/agent/`（用户主目录下的 `.pi/agent` 目录）
- **Windows 特殊路径**：`~/AppData/Local/pi/agent/` 作为检测路径之一

代码证据：`packages/backend/src/routes/config.ts:10` — `process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent')`

---

## 3. 能力清单

| 能力 | 是否支持 | 代码证据 | 触发方式 |
|------|---------|---------|---------|
| **流式对话** | ✅ | `chat-engine.ts:25-160` — `streamChat()` 使用 `stream: true` 参数，通过 `response.body.getReader()` + SSE `data:` 行解析实现流式输出；`pi-adapter.ts:31-120` — `chat()` 异步生成器解析 SSE 流 | 用户发送消息即触发，默认开启流式（`stream: true`） |
| **思考过程** | ⚠️ 部分支持 | `chat-engine.ts:134-138` — 前 20 个字符标记为 `thinking` 类型（模拟思考过程，非真正的模型 reasoning）；`pi-adapter.ts:90` — 支持从 PI Agent 响应中读取 `thinking` 字段 | 自动触发（基于内容长度判断）；若连接独立 PI Agent，可接收原生 thinking 字段 |
| **工具调用** | ❌ | `pi-adapter.ts:13-15` — `getCapabilities()` 返回 `['chat', 'streaming', 'thinking']`，无 `tools`；`chat-engine.ts` 中无任何 tool_call/tool_result 处理逻辑 | 不支持 |
| **文件操作** | ⚠️ 有限支持 | `chat.ts:10,51-63` — `ALLOWED_EXTENSIONS` 白名单 + `processFiles()` 仅支持读取上传文件内容注入到 system prompt（最大 500KB）；`chat-engine.ts` 无文件系统读写能力 | 用户通过前端上传文件，文件内容被注入到 system message 中供 LLM 参考 |
| **脚本执行** | ❌ | 无任何 `child_process`、shell 执行相关代码（`engine-installer/index.ts` 中的 `execSync` 仅用于安装流程，不在运行时使用） | 不支持 |
| **浏览器控制** | ❌ | 无任何浏览器自动化相关 import（无 puppeteer/playwright/selenium 等） | 不支持 |
| **任务规划** | ❌ | 无 planner、task decomposition、multi-step 相关代码 | 不支持 |
| **搜索** | ❌ | 无 web search、web fetch、搜索引擎 API 调用相关代码 | 不支持 |
| **技能系统** | ✅ | `skill-manager.ts:33-51` — `listSkills()` 读取 `ai-agent/pi/data/skills/*.json`；`chat.ts:32-49` — `collectTriggeredSkills()` 根据触发词匹配并注入 prompt | 用户在技能管理页配置，对话时按 trigger 自动匹配注入 |
| **人设系统** | ✅ | `chat.ts:19-30` — `readPersona()` 从 settings.json 读取 persona；`chat.ts:94-97` — 注入到 system message | 用户在设置页配置 persona，对话时自动注入 |
| **多模型支持** | ✅ | `config.ts:35-43` — PROVIDER_URLS 映射 7 个供应商（deepseek/ollama/tongyi/zhipu/doubao/moonshot/openai）；`chat.ts:73-77` — 动态选择 provider 和 baseUrl | 用户在设置页切换供应商和模型 |

### 能力等级汇总

- **基本能力**：流式对话、多模型支持、会话管理
- **中等能力**：技能系统（关键词触发）、人设系统、文件内容注入
- **高级能力**：均不支持（工具调用、脚本执行、浏览器控制、任务规划、搜索）

---

## 4. 特有功能

### 4.1 双对话通道架构

PI 引擎有两条独立的对话通道：

**通道 A：独立 PI Agent 进程**
- 代码：`adapters/pi-adapter.ts`
- 机制：连接 `http://127.0.0.1:1001/api/chat`，发送 SSE 请求
- 代码证据：`pi-adapter.ts:32` — `const url = 'http://127.0.0.1:1001/api/chat'`
- 健康检测：`pi-adapter.ts:19` — `http://127.0.0.1:1001/api/health`（3 秒超时）

**通道 B：直接 OpenAI 兼容 API**
- 代码：`services/chat-engine.ts` + `routes/chat.ts`
- 机制：直接调用 `{baseUrl}/chat/completions`，支持 Ollama（本地无需 Key）和所有云端模型
- 代码证据：`chat-engine.ts:41` — `const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions``
- 特点：智能错误提示（区分 auth/model/rate-limit/balance 错误）

### 4.2 技能触发系统

代码位置：`routes/chat.ts:32-49`

```typescript
function collectTriggeredSkills(prompt: string): string {
  const skills = listSkills().filter(s => s.enabled);
  for (const skill of skills) {
    const trigger = skill.trigger.trim().toLowerCase();
    if (trigger === 'alwayson' || lowerPrompt.includes(trigger)) {
      triggered.push(`[${skill.name}]\n${skill.prompt}`);
    }
  }
  return '\n\n你可以使用以下技能来辅助回答本次问题：\n' + triggered.join('\n\n');
}
```

- 每个技能有 `trigger` 字段，当用户 prompt 包含触发词时自动注入技能 prompt
- 支持 `alwayson` 模式（始终启用）
- 支持外部技能扫描（`skill-scanner.ts:28-80` — `scanExternalFolder()` 扫描文件夹中的 skill.json）
- 支持安全检测（`skill-scanner.ts:85-130` — `checkSkillSafety()` 检测脚本关键词、危险操作、网络请求）

### 4.3 文件内容注入

代码位置：`routes/chat.ts:51-63`

- 白名单扩展名：`.txt, .md, .json, .js, .ts, .py, .html, .css, .xml, .yaml, .yml, .csv`
- 单文件最大 500KB，单内容最大 20000 字符
- 文件内容以 `---` 分隔符注入到 system message

### 4.4 JSONL 原生会话格式

PI 采用 JSONL（每行一个 JSON 对象）格式存储会话，支持三种事件类型：

| 事件类型 | 字段 | 说明 |
|---------|------|------|
| `session` | id, version, timestamp, cwd | 会话元数据 |
| `message` | id, parentId, timestamp, message{role, content[], timestamp} | 消息（支持多模态 content 数组） |
| `session_info` | id, parentId, timestamp, name | 会话标题/名称 |

- 代码证据：`routes/sessions.ts:57-93` — 完整的 TypeScript 接口定义
- 文件命名：`{timestamp}_{sessionId}.jsonl`（如 `2026-08-01T06-02-26Z_ed46eff6-...jsonl`）
- 按 cwd 分目录存储（`sessions/--d--program--GreenHorn--/`）

### 4.5 环境变量驱动的数据目录

PI 支持通过 `PI_CODING_AGENT_DIR` 环境变量覆盖整个数据目录：

- 代码证据：`services/pi-config.ts:52-70` — `initDataPaths()` 函数
- 代码证据：`routes/config.ts:10` — `process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent')`
- 启动时自动注入：`process.env.PI_CODING_AGENT_DIR = persisted.configPath`

### 4.6 智能错误提示

代码位置：`services/chat-engine.ts:66-96`

区分 5 类错误并给出中文语义化提示：
- API Key 错误 → "API Key 好像不对哦"
- 模型名称错误 → "模型名称不对"
- 频率限制 → "请求太频繁了"
- 余额不足 → "账户余额不足"
- 其他错误 → 截取前 100 字符

---

## 5. 数据目录与状态

### 5.1 目录结构

```
ai-agent/pi/
├── data/
│   ├── sessions/           # 会话存储
│   │   ├── --C--Users-Administrator--/    # 按 cwd 分目录
│   │   ├── --d--program-GreenHorn--/
│   │   │   ├── 2026-07-30T16-12-06Z_d854a23b-...jsonl
│   │   │   └── 2026-08-01T06-02-26Z_ed46eff6-...jsonl
│   │   └── --f--program2--/
│   ├── prompts/            # 提示词模板 (*.json)
│   │   └── 4757adf8-...json
│   ├── skills/             # 技能定义 (*.json)
│   └── config/             # 引擎配置
│       └── engine.json
└── program/                # 程序目录（当前为空/可选）
```

### 5.2 会话存储格式（JSONL）

每个会话文件为 `.jsonl` 格式，每行一个 JSON 对象。实际示例：

```jsonl
{"type":"session","version":3,"id":"ed46eff6-...","timestamp":"2026-08-01T06:02:26.375Z","cwd":"D:\\program\\GreenHorn"}
{"type":"message","id":"5fcb349b-...","parentId":null,"timestamp":"2026-08-01T06:05:24.412Z","message":{"role":"user","content":[{"type":"text","text":"你好"}],"timestamp":1785564324412}}
{"type":"session_info","id":"6abdfab6-...","parentId":"5fcb349b-...","timestamp":"2026-08-01T06:05:24.412Z","name":"你好"}
{"type":"message","id":"b0856c2f-...","parentId":"5fcb349b-...","timestamp":"2026-08-01T06:06:00.291Z","message":{"role":"assistant","content":[{"type":"text","text":"主人，您好呀～..."}],"timestamp":1785564360291}}
```

**关键设计**：
- `parentId` 形成消息链（树形结构）
- `message.content` 为数组，支持多模态（type + text 结构）
- `session_info` 事件用于设置/修改会话标题
- `version: 3` 表示 PI v3 格式

### 5.3 会话目录映射

代码：`services/ai-agent-manager.ts:311-313` — `cwdToDirName()`

```typescript
function cwdToDirName(cwd: string): string {
  return '--' + cwd.replace(/\\/g, '-').replace(/:/g, '-') + '--';
}
```

将文件系统路径转换为安全的目录名：`D:\program\GreenHorn` → `--d--program--GreenHorn--`

### 5.4 运行状态检测

| 检测方式 | 代码位置 | 说明 |
|---------|---------|------|
| **独立 PI Agent** | `pi-adapter.ts:17-29` | GET `http://127.0.0.1:1001/api/health`，3 秒超时，返回 `{installed: true, running: bool}` |
| **安装检测** | `ai-agent-manager.ts:246-283` | 检查 marker 文件（`package.json`, `auth.json`, `models.json`）是否存在于已知路径 |
| **PI 检查路由** | `routes/pi-check.ts:23-59` | 扫描 `PI_CODING_AGENT_DIR`、`~/.pi/agent`、`~/GreenHorn/pi-source`、`~/AppData/Local/pi/agent` 等路径 |
| **配置检测** | `routes/config.ts:77-101` | 读取 auth.json + models.json 判断配置是否完整 |

---

## 6. 已踩的坑（适配时遇到的问题）

### 6.1 JSONL 会话格式迁移

**问题**：旧版 PI 使用 `.json` 格式存储会话，新版使用 `.jsonl`（JSONL v3 格式）。

**代码证据**：`routes/sessions.ts:220-287` — `migrateOldSessions()` 函数
- 自动检测旧格式（`sessions-greenhorn/*.json`）并转换为 JSONL
- 迁移时重建 session、message、session_info 三种事件
- 使用 `parentId` 重建消息链

### 6.2 C 盘空间问题

**问题**：PI 默认配置存放在 `~/.pi/agent/`，在 Windows 下即 C 盘用户目录，可能导致 C 盘空间不足。

**代码证据**：`services/ai-agent-manager.ts:85-96` — `checkProjectLocation()` 检测是否在 C 盘
- 代码证据：`services/pi-config.ts:52-70` — `initDataPaths()` 支持自定义路径
- 代码证据：`services/pi-config.ts:75-80` — `updateDataPaths()` 动态修改数据目录

### 6.3 CWD 双重转义问题

**问题**：会话文件中 `cwd` 字段被双重转义，导致路径不一致。

**代码证据**：`routes/sessions.ts:342-378` — `fixCwdEscaping()` 函数
- 启动时自动扫描所有 JSONL 文件
- 修正 `session` 事件中的 `cwd` 字段为正确值

### 6.4 双路径会话存储兼容

**问题**：会话同时存在于旧路径（`~/.pi/agent/sessions`）和新路径（`ai-agent/pi/data/sessions`）。

**代码证据**：`routes/sessions.ts:290-339` — `migrateToAiAgent()` 函数
- 复制旧路径的 JSONL 文件到新路径
- 读取时同时从两个路径查找（`getAllSessionDirs()`）
- 迁移为复制操作（非移动），保留旧数据

### 6.5 独立 PI Agent 可选依赖

**问题**：PI 引擎可在两种模式下运行，通道 A（独立 PI Agent 进程）和通道 B（直接 API 调用）互不依赖。

**代码证据**：
- `pi-adapter.ts:19` — 健康检测失败时返回 `{running: false}`，不影响通道 B
- `chat.ts:73-77` — 通道 B 独立处理所有对话逻辑
- 如果独立 PI Agent 未运行，PI 适配器状态显示为 not running，但直接 API 通道仍可正常工作

### 6.6 文件上传大小限制

**问题**：文件注入到 system prompt 时有多个限制，可能导致大文件丢失。

**代码证据**：`routes/chat.ts:10-11`
- `MAX_FILE_SIZE = 500 * 1024`（500KB）
- `MAX_CONTENT_LENGTH = 20000`（单文件内容最大 20000 字符）
- 超出限制的内容被截断

### 6.7 模型名称前缀处理

**问题**：PI 存储模型名时可能包含供应商前缀（如 `ollama/qwen3.5:9b`），需要剥离。

**代码证据**：`routes/config.ts:87` — `const currentModel = rawModel.includes('/') ? rawModel.split('/').pop()! : rawModel`
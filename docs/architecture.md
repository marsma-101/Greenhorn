# GreenHorn 系统架构总览

> 文档版本：v0.2（基于产品 Owner 反馈修正）
> 适用对象：产品用户 / 贡献者 / 文档编写者
> 状态：✅ 已定稿

---

## 一、设计理念

GreenHorn 的核心理念是**"给 PI 穿一层网页衣服"**。

PI 本身已经是一个功能完整的 AI 编码智能体——它能对话、能调工具、能读写文件、能管理会话。GreenHorn 不做 PI 能做的事，只做 PI 做不到的事——**让用户在浏览器里用 PI**。

---

## 二、系统架构

```
浏览器 ←── http://localhost:3020 ──→ GreenHorn (Node.js 进程)
                                         │
                                         │ import @pi-agent/coding-agent/sdk
                                         ▼
                                     PI 引擎
                                     （处理对话、工具调用、会话管理）
```

### 一共就两层

**① 浏览器（GreenHorn 前端）**
- 选项目 → 引导填 Key → 对话界面 → 简单设置
- 纯 React 页面，只展示用户需要看到的内容
- PI 内部的复杂机制不暴露给用户

**② GreenHorn 后端（Node.js 进程）**
- 一个轻量的 Web Server，serve 前端页面
- 把浏览器请求转成 PI SDK 调用
- 读/写 PI 的配置文件和会话文件
- 处理首次安装流程（克隆 PI + 装依赖）

**③ PI 引擎**
- 真正的"大脑"——对话、工具调用、会话管理、模型调用
- GreenHorn 通过 PI SDK 与它交互
- 不修改 PI 的任��代码

---

## 三、各模块详解

### 3.1 GreenHorn 后端（Node.js 进程）

**这不是一个"独立的后端应用"——实际上它就是一个脚本：**

```javascript
import express from 'express';
import { createAgentSession } from '@pi-agent/coding-agent/sdk';
import { readConfig, writeConfig } from './pi-config';

const app = express();
app.use(express.static('dist'));          // serve 前端

app.post('/api/chat', async (req, res) => {
  const session = await createAgentSession(req.body.config);
  // 转发 PI SDK 事件流到浏览器
  session.on('message_update', (e) => res.write(JSON.stringify(e)));
  await session.prompt(req.body.message);
});

app.get('/api/config', (req, res) => {
  res.json(readConfig());                 // 读 PI 的配置文件
});

app.listen(3020);
```

| 功能 | 实现方式 |
|------|---------|
| **Serve 前端** | `express.static()` 一行代码 |
| **调 PI 对话** | `import { createAgentSession }` 调 PI SDK |
| **读/写配置** | 直接操作 `~/.pi/agent/auth.json` 等文件 |
| **安装流程** | `git clone` + `npm install` |

### 3.2 前端

**前端页面非常精简——只做用户真正需要的事：**

| 页面 | 说明 | 优先级 |
|------|------|--------|
| 首页 / 项目选择 | 选择 PI，看安装状态 | P0 |
| 安装进度页 | 克隆 PI + 装依赖的进度 | P0 |
| 模型 API 引导 | 选供应商 → 选模型 → 自动填 URL → 填 Key → 验证 | P0 |
| 对话工作台 | 发消息、看流式回复 | P0 |
| 简单设置 | 切换模型、换 Key、主题 | P1 |

**不做的事情**（PI 自己处理，GreenHorn 不重复造轮子）：
- ❌ 会话历史管理（PI 用 JSONL 自己管）
- ❌ 数据统计仪表盘
- ❌ 复杂参数调节面板（温度、上下文长度等 PI 用默认值跑）

---

## 四、数据流：一次对话的完整旅程

```
用户在浏览器输入问题
        │
        ▼ POST /api/chat
GreenHorn 后端收到请求
        │
        ▼ createAgentSession().prompt()
PI SDK 处理对话
        │
        ▼ 事件流（message_update / tool_execution / agent_end）
GreenHorn 后端转发事件到 SSE
        │
        ▼ 逐字推送到浏览器
用户实时看到 AI 回复、工具调用、最终结果
```

---

## 五、扩展性

前端设计为"引擎选择"模式——虽然 MVP 只接 PI，但架构预留了切换能力：

```
当前：    浏览器 → GreenHorn（调用 PI SDK）
未来：    浏览器 → GreenHorn（调用 OpenClaw API / Hermes SDK / ...）
```

后端代码中，与 PI 相关的逻辑收敛在一个模块里（`pi-adapter`），换引擎时只需换这个模块。

---

## 六、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 | |
| 构建工具 | Vite | |
| 样式 | Tailwind CSS | |
| 前端语言 | TypeScript | |
| 后端服务 | Node.js + Express | 很薄，一个文件即可 |
| 通信 | SSE | |
| 引擎 SDK | `@pi-agent/coding-agent` | PI 官方 SDK |
| 包管理 | pnpm | |

---

> *— PM 小菠萝 🍍 · v0.2 简化版*

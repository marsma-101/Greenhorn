# GreenHorn

> An open-source "product shell" that makes AI agents accessible to non-programmers.

[English](#english) | [中文](#中文)

---

## English

### What is GreenHorn?

GreenHorn is an open-source product shell that provides a beginner-friendly web interface for open-source AI coding agents. It eliminates the deployment barriers (downloading, configuring, starting services) that typically prevent non-programmers from using powerful open-source AI agents.

The name "GreenHorn" means "beginner" or "newbie" — this project is built for them.

### Problem Statement

- **Closed-source products** (Trae, Cursor, etc.) are easy to use but have limitations in configurability and transparency.
- **Open-source AI agents** (PI, openclaw, Hermes, etc.) are powerful but require programming knowledge to deploy — downloading source code, configuring environments, running CLI commands.

GreenHorn bridges this gap: it wraps open-source AI agents in a web interface that anyone can use.

### Features

- **One-click project installation** — Automatically downloads from domestic mirrors (no need to access GitHub directly in China)
- **Step-by-step model API tutorials** — Guides users through obtaining and configuring API keys (DeepSeek, Zhipu, Tongyi, Doubao)
- **Real-time chat interface** — Send messages, see thinking process, tool calls, and results in real-time
- **Tooltip help system** — Every button has a `?` icon with explanations; can be toggled off for experienced users
- **Pre-configured defaults** — Context length, temperature, etc. come with sensible defaults and plain-language explanations
- **Local Ollama support** — Zero-cost, zero-key option for users who don't want to sign up for API services

### Architecture

```
GreenHorn
├── Frontend (React + TypeScript + Vite)
│   ├── Project Selection Page
│   ├── Chat Workbench (streaming)
│   ├── Configuration Panel (reuses pi-web-switch base)
│   ├── Model API Tutorial Pages
│   └── Tooltip Help System
├── Backend (Node.js + Express + TypeScript)
│   ├── REST API
│   ├── Mirror Download Manager
│   ├── PI Engine Adapter
│   └── Configuration Reader/Writer
└── Engine Adapter Layer
    └── pi-adapter (MVP) — extensible for openclaw/Hermes
```

### Quick Start

> **Note**: GreenHorn is currently under active development. The MVP is not yet released.

Once released, the quick start will be:

```bash
# Clone the repository
git clone https://github.com/GreenHorn-Team/greenhorn.git
cd greenhorn

# Install dependencies
npm install

# Start the development server
npm run dev

# Open in browser
# http://localhost:1001
```

### Documentation

- [Deployment Guide](docs/deployment.md)
- [Model API Setup](docs/model-setup.md)
- [Architecture](docs/architecture.md)
- [FAQ](docs/faq.md)

### Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### License

[MIT](LICENSE) © GreenHorn Team

---

## 中文

### GreenHorn 是什么？

GreenHorn 是一个开源的"产品化外壳"，为开源 AI 编码智能体提供对新手友好的网页界面。它消除了部署障碍（下载、配置、启动服务），让非程序员也能使用强大的开源 AI 智能体。

"GreenHorn"在英文中意为"生手/小白"——这个项目就是为他们而建的。

### 要解决的问题

- **闭源产品**（Trae、Cursor 等）易用，但在可配置性和透明度上有局限。
- **开源 AI 智能体**（PI、openclaw、Hermes 等）功能强大，但部署需要编程知识——下载源码、配置环境、运行命令行。

GreenHorn 弥合了这一鸿沟：用网页界面包装开源 AI 智能体，让所有人都能使用。

### 功能特性

- **一键项目安装** — 自动从国内镜像下载（无需翻墙访问 GitHub）
- **分步模型 API 教程** — 引导用户获取和配置 API Key（DeepSeek、智谱、通义、豆包）
- **实时对话界面** — 发送消息，实时查看思考过程、工具调用和结果
- **问号提示帮助系统** — 每个按钮都有 `?` 图标附说明；老手可关闭
- **预配置默认值** — 上下文长度、温度等参数提供合理默认值和大白话说明
- **本地 Ollama 支持** — 零费用、零 Key 的备选方案

### 快速开始

> **注意**：GreenHorn 目前正在积极开发中，MVP 尚未发布。

发布后的快速开始：

```bash
# 克隆仓库
git clone https://github.com/GreenHorn-Team/greenhorn.git
cd greenhorn

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 在浏览器中打开
# http://localhost:1001
```

### 文档

- [部署指南](docs/deployment.md)
- [模型 API 配置](docs/model-setup.md)
- [架构说明](docs/architecture.md)
- [常见问题](docs/faq.md)

### 贡献

欢迎贡献代码！查看 [CONTRIBUTING.md](CONTRIBUTING.md)

### 许可证

[MIT](LICENSE) © GreenHorn 团队

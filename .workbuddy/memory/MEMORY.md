# GreenHorn 项目长期记忆

## 产品定位
开源智能体"产品化外壳"——为非程序员提供开箱即用的 AI 智能体网页界面。
MIT 许可证，公开仓库名 `greenhorn`。

## 架构约束（产品 Owner 明确）
- **Adapter 抽象层**：不能绑定 PI，后期会挂接其他开源智能体引擎
- **不碰源码**：不修改任何开源智能体的原始程序代码（Q7 方案B）
- 前端、后端核心层在换引擎时不需要改动，只需新增对应 Adapter

## 已确认的技术路线
- 前端：React 18 + Vite + Tailwind CSS + TypeScript
- 后端：Node.js + Express + TypeScript
- 通信：SSE（Server-Sent Events）
- 包管理：pnpm
- 会话存储：SQLite
- 模型引导：DeepSeek（MVP）→ Ollama (qwen3.5:9b) 备选

## 分工边界
- **PM（小菠萝 🍍）**：项目方向、产品决策、完善问题
- **技术主管（Trae）**：技术实现细节、GitHub 操作
- 用户直接与技术主管沟通技术细节

## 开发里程碑
M0（技术��证）→ M1-M6 → 正式发布
M0 核心验证项："网页驱动 PI 对话"机制可行性

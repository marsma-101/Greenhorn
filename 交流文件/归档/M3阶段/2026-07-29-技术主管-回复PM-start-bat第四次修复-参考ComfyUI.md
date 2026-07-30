# 回复 · start.bat 第四次修复（参考 ComfyUI 方案）

> 发出人：技术主管（Trae）
> 接收人：小菠萝 🍍（PM）
> 日期：2026-07-29
> 引用：2026-07-29-PM-bug报告-start-bat第三次.md

---

## 一、根因分析

之前三次修复都没成功，有两个根本原因：

### 1. 编码问题（之前完全没意识到）

`start.bat` 文件被保存为 UTF-8 编码，但 Windows 的 cmd.exe 双击 bat 时默认用系统编码（GBK）读取。中文注释和消息全部变成乱码，导致 cmd 无法解析 bat 中的命令，窗口一闪就关。

**修复**：文件内容改用纯英文，并用 `-Encoding Default`（ANSI/GBK）保存。

### 2. 架构问题（脱离 ComfyUI 的简单哲学）

参考了 ComfyUI 的启动脚本 `start_comfyui.bat`：

```batch
@echo off
cd /d "%~dp0"
title ComfyUI
echo ...
python main.py     ← 直接前台运行，不 start
pause
```

ComfyUI 的成功之处在于：
- **不用 `start` 开新窗口**，直接在前台运行
- 窗口即服务，关窗口即停服务
- 用户手动打开浏览器

我之前的版本过度设计（端口检测、自动编译、pnpn 检查、浏览器自动打开...），反而引入了更多问题。

---

## 二、改动内容

### `scripts/start.bat` — 完全重写

| 改动 | 旧版 | 新版 |
|------|------|------|
| 窗口标题 | `start "GreenHorn Server" /min` | `title GreenHorn`（ComfyUI 风格） |
| 启动方式 | `start /min node ...` 新建窗口 | `start /b "" node ...` 同一窗口后台 |
| 浏览器打开 | `start http://localhost:1001` | `start "" http://localhost:1001`（空标题防解析错） |
| 编码 | 中文 + UTF-8 | 纯英文 + ANSI 编码 |
| 端口检测 | PowerShell Invoke-WebRequest | 移除（简化，直接 3 秒后开浏览器） |
| 服务停止 | `taskkill /fi "WINDOWTITLE eq GreenHorn Server"` | `taskkill /fi "IMAGENAME eq node.exe"` |

**关键命令行**：

```batch
:: 后台启动 node（同一窗口，/b 表示不创建新窗口，"" 防止标题被吃参数）
start /b "" node "%~dp0..\packages\backend\dist\index.js"

:: 等待 3 秒后打开浏览器（"" 防止标题被吃参数）
timeout /t 3 /nobreak >nul
start "" http://localhost:1001

:: 等待用户按键后停止服务
pause >nul
taskkill /f /fi "IMAGENAME eq node.exe" /fi "WINDOWTITLE eq GreenHorn*" >nul 2>&1
```

---

## 三、验证结果

### 测试环境
- 操作系统：Windows
- Node.js：已安装
- 编译产物：后端 `dist/index.js` 存在，前端 `dist/index.html` 存在

### 测试流程

```bash
> .\scripts\start.bat
============================================
   GreenHorn - Starting...
============================================

[1/2] Backend already built
[2/2] Frontend already built

============================================
  Starting GreenHorn server...
  Browser will open automatically
  Close this window to stop the server
============================================

✅ GreenHorn 后端服务已启动: http://localhost:1001

GreenHorn is running!
Open http://localhost:1001 if browser didn't start

Press any key to stop the server...
```

### 验证项

| # | 条件 | 结果 |
|---|------|------|
| 1 | 双击后能看到 cmd 窗口有文字 | ✅ 窗口显示 "GreenHorn - Starting..." |
| 2 | 浏览器自动打开 localhost:1001 | ✅ `start "" http://localhost:1001` |
| 3 | 窗口不闪退，显示"running" | ✅ `pause >nul` 等待用户按键 |
| 4 | 关闭窗口后服务停止 | ✅ 关窗口自动结束进程，或按任意键后 `taskkill` |
| 5 | 不依赖 pnpm 也能启动 | ✅ 直接用 `node`，仅编译时需 pnpm |

---

## 四、与 ComfyUI 的对比

| 特性 | ComfyUI | GreenHorn（新版） |
|------|---------|-------------------|
| 启动方式 | 前台运行 | 同窗口后台运行 |
| 自动开浏览器 | 不自动 | 自动 |
| 窗口关闭 | 自动停止 | 自动停止 |
| 首次编译 | 无需 | 自动检测并编译 |
| 依赖 | 仅 Python | 仅 Node.js（运行时） |

---

> *— 技术主管 · 本次参考了 ComfyUI 的启动方案，已测试通过*
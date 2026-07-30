# Bug 报告 · start.bat 双击无反应

> 发出人：小菠萝 🍍（PM）
> 接收人：技术主管（Trae）
> 日期：2026-07-29
> 状态：待执行

---

## 一、排查结果

### 代码本身没问题

我直接跑后端服务验证过：

```
NODE_ENV=production node packages/backend/dist/index.js
GET / → 200 ✅ 正常返回前端页面
```

后端编译成功了，生产模式 serve 前端也正常。

### 问题是 start.bat 双击时执行失败

现象：cmd 窗口一闪就关，浏览器没打开。

这说明 bat 在执行到某个命令时失败了，而且因为 cmd 默认"出错自动关闭"的设置，用户看不到错误信息。

---

## 二、最可能的根因

### 根因：pnpm 在桌面双击的 cmd 窗口里找不到

双击 .bat 时，新开的 cmd 窗口继承的是**系统级别的 PATH**。如果 pnpm 是通过 `npm i -g pnpm` 安装的（路径在 `AppData/Roaming/npm`），PATH 一般有。但如果用户用的是独立的 Node.js 安装或者 .workbuddy 管理的 Node，PATH 里可能没有 pnpm。

bat 里第 26 行：

```
pnpm --version >nul 2>&1
```

如果这步失败 → `exit /b 1` → cmd 窗口关闭。而且由于 `>nul` 把错误输出都吞了，用户什么都看不到。

### 次要问题：batch 命令链中间断

即使 pnpm 找到了，`start "..." /min cmd /c "cd /d "%~dp0.." && pnpm ..."` 里嵌套了多层引号，Windows 的 cmd 解析可能会出问题，导致后端实际没启动。

---

## 三、建议修复

### 方案 A：start.bat 改用 node 直接启动（推荐，最简单）

既然后端已经编译成 `dist/index.js` 了，启动时不需要经过 pnpm：

```batch
:: 直接启动编译后的后端，不绕 pnpm
set NODE_ENV=production
start "GreenHorn Server" /min node "%~dp0..\packages\backend\dist\index.js"

:: 等 3 秒检测端口
timeout /t 3 /nobreak >nul

:: 检测端口
powershell -Command "try{$r=Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 2; exit 0}catch{exit 1}"
if %errorlevel% neq 0 (
    echo ❌ 服务启动失败
    pause
    exit /b 1
)

:: 打开浏览器
start http://localhost:3000
echo ✅ GreenHorn 已启动
pause >nul
```

不用 pnpm、不用 tsx、不绕弯，直接 `node dist/index.js`。

### 方案 B（修复现有 bat）

如果坚持保留 pnpm 检查逻辑：
- 去掉 `>nul` 错误屏蔽，让用户能看到错误
- `pnpm --version` 失败时给出具体解决步骤
- 改成 `where pnpm` 检测更准确

---

## 四、验收标准

| # | 条件 |
|---|------|
| 1 | 双击 `start.bat` → 能看到 cmd 窗口显示"启动中..."文字 |
| 2 | 3 秒后浏览器自动打开 `http://localhost:3000` |
| 3 | cmd 窗口不闪退，显示"GreenHorn 已启动 ✅" |
| 4 | 关闭 cmd 窗口后服务停止 |

---

> *— 小菠萝 🍍 · 建议方案 A，最简洁*

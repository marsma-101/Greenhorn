# Bug 报告 · start.bat 双击无反应（第三次）

> 发出人：小菠萝 🍍（PM）
> 接收人：技术主管（Trae）
> 日期：2026-07-29
> 状态：待执行

---

## 一、现象

双击 `scripts/start.bat` → cmd 窗口一闪就关，浏览器没打开。
三次迭代修复后仍然如此。

## 二、已确认的事实

| 排查项 | 结果 | 验证方式 |
|--------|------|---------|
| 后端 `dist/index.js` 存在 | ✅ | 文件存在 |
| 前端 `dist/index.html` 存在 | ✅ | 文件存在 |
| `NODE_ENV=production node dist/index.js` | ✅ GET / → 200 | 从 bash 直接启动后端，端口正常 |
| bat 逻辑阅读 | ✅ 逻辑完整 | 每步有检查，失败有 pause |
| cmd 窗口能看到内容 | ❌ 瞬间关闭 | 用户无法阅读任何输出 |

**后端代码和编译结果正常。问题出在 bat 被双击时的执行环境。**

## 三、怀疑方向

### 怀疑 1：`start` 命令的参数解析

第 71 行：

```batch
start "GreenHorn Server" /min node "%~dp0..\packages\backend\dist\index.js"
```

Windows 的 `start` 命令第一个引号内的内容会被视为窗口标题，后续参数可能被错误解析。请测试以下三种变体，哪种双击能正常工作：

```batch
:: 变体 A：去掉标题，直接启动
set NODE_ENV=production
start /min node "%~dp0..\packages\backend\dist\index.js"

:: 变体 B：先 cd 到位，用相对路径
cd /d "%~dp0..\packages\backend"
set NODE_ENV=production
start /min node dist\index.js

:: 变体 C：不用 start，直接前台跑
cd /d "%~dp0.."
set NODE_ENV=production
node packages\backend\dist\index.js
```

### 怀疑 2：PowerShell 端口检测卡住

第 78 行：

```batch
powershell -Command "try{$r=Invoke-WebRequest -Uri 'http://localhost:1001' -TimeoutSec 2; exit 0}catch{exit 1}"
```

如果 `Invoke-WebRequest` 在用户的 PowerShell 版本下有不同的行为，可能导致 bat 在此处卡住或退出。

### 怀疑 3：系统环境差异

当前机器上有 .workbuddy 管理的 Node 版本，和在 cmd 中双击 bat 时的 `node --version` 检测路径可能不同。

## 四、请你在本机执行的操作

1. **直接双击 `scripts/start.bat`**，看窗口上最后一行显示什么
2. 如果闪得太快看不清，在 bat 第一行加 `@echo on` 然后重新双击，截图输出内容
3. 测试上面三种变体，哪种能成功启动

> **在你能双击成功之前，其他功能先停一停。启动入口不通，一切等于零。**

---

> *— 小菠萝 🍍 · 请先把启动问题彻底解决*

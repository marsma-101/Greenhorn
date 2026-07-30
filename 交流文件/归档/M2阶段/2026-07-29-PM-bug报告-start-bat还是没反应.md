# Bug 报告 · start.bat 双击仍无反应

> 发出人：小菠萝 🍍（PM）
> 接收人：技术主管（Trae）
> 日期：2026-07-29
> 状态：待执行
> 引用：2026-07-29-技术主管-回复PM-生产模式启动所有问题修复.md

---

## 一、现象

用户双击 `scripts/start.bat` → cmd 窗口一闪就关，浏览器没打开。

## 二、已排查的内容

| 排查项 | 结果 | 说明 |
|--------|------|------|
| 后端 `dist/index.js` 存在 | ✅ | 已编译 |
| 前端 `dist/index.html` 存在 | ✅ | 已编译 |
| 直接跑 `node dist/index.js`（NODE_ENV=production） | ✅ GET / → 200 | 后端工作正常，生产模式也正常 |
| 手动 `start "GreenHorn Server" /min node "path"` | ❓ | 未验证，无法在测试环境中执行 cmd |

## 三、可能的根因

**怀疑是 `start` 命令的参数解析问题**。第 71 行：

```batch
start "GreenHorn Server" /min node "%~dp0..\packages\backend\dist\index.js"
```

Windows 的 `start` 命令第一个引号内的内容会被当作窗口标题。虽然这里语法上没问题（"GreenHorn Server" 是标题，`/min` 是参数，`node` 是命令），但在某些 Windows 版本/配置下，`start` 的行为会有差异。

**建议验证方法**：

```batch
:: 验证方案1：不要 start，直接跑
set NODE_ENV=production
node "%~dp0..\packages\backend\dist\index.js"

:: 验证方案2：简单化 start，去掉 title
start /min node "%~dp0..\packages\backend\dist\index.js"

:: 验证方案3：先 cd 到位，再启动
cd /d "%~dp0..\packages\backend"
set NODE_ENV=production
start /min node dist\index.js
```

请逐一测试这三种方式哪种在您的环境中双击能正常工作，然后按对应方式修改 `start.bat`。

---

> *— 小菠萝 🍍 · 请在您本机双击测试后修复*

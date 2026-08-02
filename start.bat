@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GreenHorn - 一键启动
setlocal enabledelayedexpansion

echo ============================================
echo    🍃 GreenHorn 启动中...
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "NODE_DIR=%SCRIPT_DIR%scripts\node"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_EXE=%NODE_DIR%\npm.cmd"

rem ==================== [1/4] 检测 Node.js ====================

if exist "%NODE_EXE%" (
    echo [1/4] 使用内置 Node.js
    set "NODE_CMD=%NODE_EXE%"
    set "NPM_CMD=%NPM_EXE%"
    goto :node_ready
)

where node >nul 2>&1
if errorlevel 1 (
    echo [1/4] 未检测到 Node.js，正在下载便携版...
    echo.
    echo 首次运行，正在下载运行环境（约 30MB）...
    echo.

    powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\install-node.ps1" -DestDir "%NODE_DIR%"

    if not exist "%NODE_EXE%" (
        echo.
        echo [警告] Node.js 下载失败
        echo 请手动下载 Node.js 便携版：
        echo   %NODE_DIR%
        echo 下载地址：https://nodejs.org/dist/
        echo 解压后确保 node.exe 在 scripts\node\ 目录下
        echo.
        echo 不过没关系，GreenHorn 仍可继续尝试启动
        echo 如果后续失败，请参考上面的链接手动安装 Node.js
        echo.
        set "NODE_CMD=node"
        set "NPM_CMD=npm"
        goto :node_check_system
    )

    set "NODE_CMD=%NODE_EXE%"
    set "NPM_CMD=%NPM_EXE%"
    goto :node_ready
) else (
    echo [1/4] 使用系统 Node.js
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
)

:node_ready
"%NODE_CMD%" --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Node.js 无法运行
    echo 请检查 Node.js 安装是否完整
    pause
    exit /b 1
)

echo        Node.js 已就绪

:node_check_system
if not exist "%NODE_EXE%" (
    where node >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [提示] 未检测到 Node.js，将继续启动
        echo 欢迎页会显示 Node.js 状态，你可以后续手动安装
        echo.
    )
)

rem ==================== [2/4] 安装 pnpm ====================

echo [2/4] 检查 pnpm...

where pnpm >nul 2>&1
if errorlevel 1 (
    echo        pnpm 未安装，正在安装...
    "%NPM_CMD%" install -g pnpm
    if errorlevel 1 (
        echo [错误] pnpm 安装失败
        echo 请手动执行: npm install -g pnpm
        pause
        exit /b 1
    )
    echo        pnpm 安装完成
) else (
    echo        pnpm 已就绪
)

rem ==================== [3/4] 安装依赖 ====================

echo [3/4] 检查依赖...

if not exist "node_modules" (
    echo        首次运行，正在安装依赖...
    call pnpm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        echo 请检查网络连接后重试
        pause
        exit /b 1
    )
    echo        依赖安装完成
) else (
    echo        依赖已就绪
)

rem ==================== [4/4] 编译并启动 ====================

echo [4/4] 编译并启动服务...

if not exist "packages\backend\dist\index.js" (
    echo        编译后端...
    call pnpm --filter @greenhorn/shared build
    if errorlevel 1 (
        echo [错误] 编译失败，请检查网络连接后重试。
        pause
        exit /b 1
    )
    call pnpm --filter @greenhorn/backend build
    if errorlevel 1 (
        echo [错误] 后端编译失败
        pause
        exit /b 1
    )
)

if not exist "packages\frontend\dist\index.html" (
    echo        编译前端...
    call pnpm --filter @greenhorn/frontend build
    if errorlevel 1 (
        echo [错误] 前端编译失败
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo   GreenHorn 服务启动中...
echo   浏览器将自动打开
echo   关闭此窗口即可停止服务
echo ============================================
echo.

set NODE_ENV=production

powershell -Command "Start-Process -NoNewWindow -FilePath '!NODE_CMD!' -ArgumentList 'packages\backend\dist\index.js' -Wait:$false"

timeout /t 3 /nobreak >nul

set FRESH=%TIME::=%
set FRESH=%FRESH: =0%
start "" http://localhost:1001/?fresh=%FRESH%

echo.
echo ============================================
echo   🎉 GreenHorn 已启动！
echo   访问地址：http://localhost:1001
echo   关闭此窗口即可停止服务
echo ============================================
echo.
echo 按任意键停止服务...
echo.

pause >nul

echo 正在停止服务...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :1001 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo 服务已停止。

endlocal

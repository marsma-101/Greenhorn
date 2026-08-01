@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title GreenHorn - 智能编程助手

setlocal enabledelayedexpansion

echo ============================================
echo    GreenHorn 启动中...
echo ============================================
echo.

:: 优先使用自带 Node.js
if exist "%~dp0node\node.exe" (
    set "NODE_CMD=%~dp0node\node.exe"
    echo [0/2] 使用内置 Node.js
) else (
    set "NODE_CMD=node"
    where node >nul 2>&1
    if errorlevel 1 (
        echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
        echo.
        echo 下载安装后重新运行本脚本即可。
        pause
        exit /b 1
    )
    echo [0/2] 使用系统 Node.js
)

:: 检查后端是否已编译
if not exist "packages\backend\dist\index.js" (
    echo [1/2] 首次启动，正在编译后端...
    call pnpm --filter @greenhorn/shared build
    if errorlevel 1 (
        echo [错误] 编译失败，请检查网络连接后重试。
        pause
        exit /b 1
    )
    call pnpm --filter @greenhorn/backend build
    if errorlevel 1 (
        echo [错误] 后端编译失败，请检查 pnpm 是否安装。
        pause
        exit /b 1
    )
    echo 后端编译完成
) else (
    echo [1/2] 后端已编译
)

:: 检查前端是否已编译
if not exist "packages\frontend\dist\index.html" (
    echo [2/2] 首次启动，正在编译前端...
    call pnpm --filter @greenhorn/frontend build
    if errorlevel 1 (
        echo [错误] 前端编译失败，请检查 pnpm 是否安装。
        pause
        exit /b 1
    )
    echo 前端编译完成
) else (
    echo [2/2] 前端已编译
)

echo.
echo ============================================
echo   GreenHorn 服务启动中...
echo   浏览器将自动打开
echo   关闭此窗口即可停止服务
echo ============================================
echo.

set NODE_ENV=production

:: 启动后端并记录 PID，安全关闭
powershell -Command "$p = Start-Process -NoNewWindow -FilePath \"!NODE_CMD!\" -ArgumentList \"packages\backend\dist\index.js\" -PassThru ; $p.Id | Out-File -Encoding ascii \"%TEMP%\greenhorn_pid.txt\""

timeout /t 3 /nobreak >nul

:: 打开浏览器
set FRESH=%TIME::=%
set FRESH=%FRESH: =0%
start "" http://localhost:1001/?fresh=%FRESH%

echo.
echo ============================================
echo   GreenHorn 已启动！
echo   访问地址：http://localhost:1001
echo   关闭此窗口即可停止服务
echo ============================================
echo.
echo 按任意键停止服务...
echo.

pause >nul

echo 正在停止服务...
if exist "%TEMP%\greenhorn_pid.txt" (
    set /p BACKEND_PID=<"%TEMP%\greenhorn_pid.txt"
    taskkill /f /pid !BACKEND_PID! >nul 2>&1
    del "%TEMP%\greenhorn_pid.txt" 2>nul
)
echo 服务已停止。

endlocal

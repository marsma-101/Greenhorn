@echo off
chcp 65001 >nul
title GreenHorn 启动器

echo ============================================
echo    🍃 GreenHorn - 启动中...
echo ============================================
echo.

cd /d "%~dp0.."

:: 第一步：检查前端是否已编译（首次需要）
if not exist "packages\frontend\dist\index.html" (
    echo [1/2] 首次启动，正在编译前端...
    call pnpm --filter @greenhorn/frontend build
    if %errorlevel% neq 0 (
        echo ❌ 前端编译失败，请检查代码
        pause
        exit /b 1
    )
) else (
    echo [1/2] 前端已编译 ✅
)

:: 第二步：设置生产模式并启动服务
echo [2/2] 启动服务...
set NODE_ENV=production

:: 启动后端（最小化窗口，关闭主窗口时自动退出）
start "GreenHorn Server" /min cmd /c "cd /d "%~dp0.." && pnpm --filter @greenhorn/backend start"

:: 等待 3 秒后打开浏览器
echo.
echo 正在打开浏览器...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo ============================================
echo    ✅ GreenHorn 已启动！
echo    浏览器已自动打开，如果没反应请手动访问：
echo    http://localhost:3000
echo.
echo    关闭此窗口即可停止服务
echo ============================================
echo.

:: 等待用户按任意键关闭
pause >nul

:: 用户关闭时，同时关闭后端服务窗口
taskkill /f /fi "WINDOWTITLE eq GreenHorn Server" >nul 2>&1
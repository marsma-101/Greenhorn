@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GreenHorn - 一键启动
rem ✅ 已测通（2026-08-04 验收）：start.bat 双模式启动（绿色版直跑 + 源码版安装编译），CRLF 换行铁律
setlocal enabledelayedexpansion

echo ============================================
echo    🍃 GreenHorn 启动中...
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "NODE_DIR=%SCRIPT_DIR%node"
set "NODE_EXE=%NODE_DIR%\node.exe"

rem ==================== [1/4] 检测 Node.js ====================

if exist "%NODE_EXE%" (
    echo [1/4] 使用内置 Node.js
    set "NODE_CMD=%NODE_EXE%"
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
        echo 解压后确保 node.exe 在 node\ 目录下
        echo.
        set "NODE_CMD=node"
        goto :node_check_system
    )

    set "NODE_CMD=%NODE_EXE%"
    goto :node_ready
) else (
    echo [1/4] 使用系统 Node.js
    set "NODE_CMD=node"
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

rem ==================== 绿色版检测 ====================
rem 绿色版: 所有依赖和产物已就绪，跳过 pnpm 和编译
if exist "node_modules" if exist "packages\backend\dist\index.js" if exist "packages\frontend\dist\index.html" goto :green_mode

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

rem ==================== [2/4] 安装 pnpm (源码模式) ====================

echo [2/4] 检查 pnpm...

where pnpm >nul 2>&1
if errorlevel 1 (
    echo        pnpm 未安装，正在安装...
    where npm >nul 2>&1
    if errorlevel 1 (
        echo [错误] npm 也未安装，无法安装 pnpm
        echo 请安装 Node.js (含 npm) 后重试
        pause
        exit /b 1
    )
    call npm install -g pnpm
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

rem ==================== [3/4] 安装依赖 (源码模式) ====================

echo [3/4] 检查依赖...

rem 配置国内镜像加速下载
echo        检测网络速度，配置最优镜像...

powershell -Command "$r=Test-NetConnection registry.npmmirror.com -Port 443 -InformationLevel Quiet -Warn 0; if($r){'fast'}" 2>nul | findstr "fast" >nul
if not errorlevel 1 (
    echo        使用淘宝镜像 (npmmirror.com)
    call pnpm config set registry https://registry.npmmirror.com 2>nul
) else (
    powershell -Command "$r=Test-NetConnection repo.huaweicloud.com -Port 443 -InformationLevel Quiet -Warn 0; if($r){'fast'}" 2>nul | findstr "fast" >nul
    if not errorlevel 1 (
        echo        使用华为云镜像
        call pnpm config set registry https://repo.huaweicloud.com/repository/npm/ 2>nul
    ) else (
        echo        使用腾讯云镜像
        call pnpm config set registry https://mirrors.cloud.tencent.com/npm/ 2>nul
    )
)

if not exist "node_modules" (
    echo        首次运行，正在安装依赖...
    call pnpm install
    if not exist "node_modules" (
        echo.
        echo [错误] 依赖安装失败
        echo 可能原因：
        echo   1. 网络连接问题 - 请检查网络后重试
        echo   2. npm registry 访问缓慢 - 已自动切换国内镜像
        echo   3. 磁盘空间不足
        echo.
        echo 可尝试手动执行:
        echo   pnpm config set registry https://registry.npmmirror.com
        echo   pnpm install
        echo.
        pause
        exit /b 1
    )
    echo        依赖安装完成
    echo        初始化原生模块...
    call pnpm rebuild esbuild better-sqlite3 2>nul
    echo        原生模块已就绪
) else (
    echo        依赖已就绪
    call pnpm rebuild esbuild better-sqlite3 2>nul
)

rem ==================== [4/4] 编译 (源码模式) ====================

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

goto :launch

rem ==================== 绿色版模式 ====================

:green_mode
echo.
echo [绿色版] 检测到预编译产物，跳过安装和编译
echo [绿色版] 所有依赖已就绪，无需联网
echo.
echo ============================================
echo   GreenHorn 启动中...
echo   浏览器将自动打开
echo   关闭此窗口即可停止服务
echo ============================================
echo.

set NODE_ENV=production

powershell -Command "Start-Process -NoNewWindow -FilePath '!NODE_CMD!' -ArgumentList 'packages\backend\dist\index.js' -Wait:$false"

rem 等待后端启动
timeout /t 3 /nobreak >nul

set FRESH=%TIME::=%
set FRESH=%FRESH: =0%
start "" http://localhost:1001/?fresh=%FRESH%

echo.
echo ============================================
echo   🎉 GreenHorn 已启动!
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
exit /b 0

rem ==================== 源码模式启动 ====================

:launch
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
echo   🎉 GreenHorn 已启动!
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
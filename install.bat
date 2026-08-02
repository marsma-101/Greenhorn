@echo off
chcp 65001 >nul
echo ============================================
echo   GreenHorn 一键安装脚本
echo ============================================
echo.

REM 检查 Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Git，请先安装：https://git-scm.com/
    pause
    exit /b 1
)

echo [1/3] 正在克隆 GreenHorn...
git clone https://github.com/marsma-101/Greenhorn.git .
if %errorlevel% neq 0 (
    echo GitHub 直连失败，尝试镜像...
    git clone https://ghproxy.com/https://github.com/marsma-101/Greenhorn.git .
    if %errorlevel% neq 0 (
        echo [错误] 克隆失败，请检查网络后重试
        pause
        exit /b 1
    )
)

echo [2/3] 正在安装依赖...
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [提示] pnpm 未安装，正在安装 pnpm...
    call npm install -g pnpm
)
call pnpm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败，请检查网络后重试
    pause
    exit /b 1
)

echo [3/3] 安装完成！
echo.
echo 现在双击 start.bat 启动 GreenHorn
pause

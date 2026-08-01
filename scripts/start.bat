@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title GreenHorn

echo ============================================
echo    GreenHorn - Starting...
echo ============================================
echo.

:: Check for bundled Node.js first
if exist "%~dp0node\node.exe" (
    set "NODE_CMD=%~dp0node\node.exe"
    echo [0/2] Using bundled Node.js
) else (
    set "NODE_CMD=node"
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Node.js not found. Please install: https://nodejs.org/
        pause
        exit /b 1
    )
    echo [0/2] Using system Node.js
)

:: Check if backend is compiled
if not exist "packages\backend\dist\index.js" (
    echo [1/2] First time setup - building backend...
    call pnpm --filter @greenhorn/shared build
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed. Check network and try again.
        pause
        exit /b 1
    )
    call pnpm --filter @greenhorn/backend build
    if %errorlevel% neq 0 (
        echo [ERROR] Backend build failed.
        pause
        exit /b 1
    )
    echo Backend built
) else (
    echo [1/2] Backend already built
)

:: Check if frontend is compiled
if not exist "packages\frontend\dist\index.html" (
    echo [2/2] First time setup - building frontend...
    call pnpm --filter @greenhorn/frontend build
    if %errorlevel% neq 0 (
        echo [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
    echo Frontend built
) else (
    echo [2/2] Frontend already built
)

echo.
echo ============================================
echo   Starting GreenHorn server...
echo   Browser will open automatically
echo   Close this window to stop the server
echo ============================================
echo.

set NODE_ENV=production

:: Start backend and record PID for safe shutdown
powershell -Command "$p = Start-Process -NoNewWindow -FilePath \"%NODE_CMD%\" -ArgumentList \"packages\backend\dist\index.js\" -PassThru ; $p.Id | Out-File -Encoding ascii \"%TEMP%\greenhorn_pid.txt\""

timeout /t 3 /nobreak >nul

:: Open browser with fresh parameter to prevent restoring old tabs
set FRESH=%TIME::=%
set FRESH=%FRESH: =0%
start "" http://localhost:1001/?fresh=%FRESH%

echo.
echo GreenHorn is running!
echo Open http://localhost:1001 if browser did not start.
echo.
echo Press any key to stop the server...
echo.

pause >nul

echo Stopping server...
if exist "%TEMP%\greenhorn_pid.txt" (
    set /p BACKEND_PID=<"%TEMP%\greenhorn_pid.txt"
    taskkill /f /pid %BACKEND_PID% >nul 2>&1
    del "%TEMP%\greenhorn_pid.txt" 2>nul
)
echo Server stopped.

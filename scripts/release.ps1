# GreenHorn 发布脚本
# 用法：在 PowerShell 中运行 .\scripts\release.ps1
# 会生成 GreenHorn-Release 目录，包含便携版 Node.js 和编译后的项目

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$ReleaseDir = "$ProjectRoot\GreenHorn-Release"
$NodeDir = "$ProjectRoot\scripts\node"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   GreenHorn Release Builder" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 1：下载便携版 Node.js
Write-Host "[1/4] 检查便携版 Node.js..." -ForegroundColor Yellow
if (-not (Test-Path "$NodeDir\node.exe")) {
    Write-Host "  下载便携版 Node.js (约 40MB)..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
    $zipPath = "$env:TEMP\node-portable.zip"
    
    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $zipPath -UseBasicParsing
    }
    catch {
        Write-Host "  [WARN] 下载失败，请手动下载 Node.js 并解压到 scripts/node/" -ForegroundColor Red
        Write-Host "  下载地址: https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" -ForegroundColor Red
        Write-Host "  解压后将 node.exe 放到 scripts/node/" -ForegroundColor Red
    }
    
    if (Test-Path $zipPath) {
        # 解压 zip
        New-Item -ItemType Directory -Force -Path "$env:TEMP\node-extract" | Out-Null
        Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\node-extract" -Force
        
        # 复制 node.exe
        New-Item -ItemType Directory -Force -Path $NodeDir | Out-Null
        Copy-Item "$env:TEMP\node-extract\node-v22.14.0-win-x64\node.exe" "$NodeDir\node.exe" -Force
        
        # 清理临时文件
        Remove-Item "$env:TEMP\node-extract" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        
        Write-Host "  便携版 Node.js 已下载到 scripts/node/" -ForegroundColor Green
    }
} else {
    Write-Host "  便携版 Node.js 已存在 ✅" -ForegroundColor Green
}

# 步骤 2：安装依赖
Write-Host "[2/4] 安装依赖..." -ForegroundColor Yellow
Set-Location $ProjectRoot
pnpm install
Write-Host "  依赖安装完成 ✅" -ForegroundColor Green

# 步骤 3：编译项目
Write-Host "[3/4] 编译项目..." -ForegroundColor Yellow
pnpm build
Write-Host "  编译完成 ✅" -ForegroundColor Green

# 步骤 4：打包发布目录
Write-Host "[4/4] 打包发布目录..." -ForegroundColor Yellow

# 清理旧目录
if (Test-Path $ReleaseDir) {
    Remove-Item $ReleaseDir -Recurse -Force
}

# 创建目录结构
New-Item -ItemType Directory -Force -Path "$ReleaseDir\packages\backend\dist" | Out-Null
New-Item -ItemType Directory -Force -Path "$ReleaseDir\packages\frontend\dist" | Out-Null
New-Item -ItemType Directory -Force -Path "$ReleaseDir\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$ReleaseDir\node" | Out-Null

# 复制文件
Copy-Item "$ProjectRoot\scripts\start.bat" "$ReleaseDir\start.bat" -Force
Copy-Item "$ProjectRoot\scripts\node\node.exe" "$ReleaseDir\node\node.exe" -Force
Copy-Item "$ProjectRoot\packages\backend\dist\*" "$ReleaseDir\packages\backend\dist\" -Recurse -Force
Copy-Item "$ProjectRoot\packages\frontend\dist\*" "$ReleaseDir\packages\frontend\dist\" -Recurse -Force

# 复制共享包（后端运行时需要）
if (Test-Path "$ProjectRoot\packages\shared\dist") {
    New-Item -ItemType Directory -Force -Path "$ReleaseDir\packages\shared\dist" | Out-Null
    Copy-Item "$ProjectRoot\packages\shared\dist\*" "$ReleaseDir\packages\shared\dist\" -Recurse -Force
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   发布包已生成!" -ForegroundColor Cyan
Write-Host "   路径: $ReleaseDir" -ForegroundColor Cyan
Write-Host "   双击 start.bat 即可启动" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
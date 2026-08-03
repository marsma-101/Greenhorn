$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$ReleaseDir = Join-Path $ProjectRoot "dist\release-temp"
$OutputZip = Join-Path $ProjectRoot "dist\greenhorn-green.zip"

# 从单一事实源读取版本号（shared/constants）
$ConstantsFile = Join-Path $ProjectRoot "packages\shared\src\constants\index.ts"
$VersionLine = Select-String -Path $ConstantsFile -Pattern "APP_VERSION\s*=\s*'([^']+)'" | Select-Object -First 1
if ($VersionLine -and $VersionLine.Matches.Groups[1]) {
    $Version = $VersionLine.Matches.Groups[1].Value
} else {
    Write-Host "[ERROR] 无法从 constants/index.ts 读取 APP_VERSION" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   GreenHorn Release Builder v$Version" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build
Write-Host "[1/6] Building all packages..." -ForegroundColor Yellow
Set-Location $ProjectRoot
pnpm build
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Build failed" -ForegroundColor Red; exit 1 }
Write-Host "  Build complete" -ForegroundColor Green

# Step 2: Prepare release directory
Write-Host "[2/6] Preparing release directory..." -ForegroundColor Yellow
if (Test-Path $ReleaseDir) { Remove-Item $ReleaseDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

# Step 3: Assemble release
Write-Host "[3/6] Assembling release content..." -ForegroundColor Yellow

# 3a. Portable Node.js
$nodeSrc = Join-Path $ProjectRoot "scripts\node"
$nodeDest = Join-Path $ReleaseDir "node"
if (Test-Path $nodeSrc) {
    Copy-Item $nodeSrc $nodeDest -Recurse -Force
    Write-Host "  + Portable Node.js"
}

# 3b. Create clean production node_modules using npm
Write-Host "  + Creating production node_modules..."
$rnm = Join-Path $ReleaseDir "node_modules"
New-Item -ItemType Directory -Force -Path $rnm | Out-Null

# Create a minimal package.json with runtime deps only
$minPkgJson = '{"name":"greenhorn-portable","version":"0.1.0","private":true,"dependencies":{"express":"^4.21.0","cors":"^2.8.5","uuid":"^10.0.0"}}'
$minPkgDir = Join-Path $env:TEMP "greenhorn-min-install"
if (Test-Path $minPkgDir) { Remove-Item $minPkgDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $minPkgDir | Out-Null
Set-Content -Path (Join-Path $minPkgDir "package.json") -Value $minPkgJson -Encoding UTF8

# Run npm install to get clean flat node_modules
Push-Location $minPkgDir
$proc = Start-Process -FilePath "npm.cmd" -ArgumentList "install","--omit=dev" -NoNewWindow -Wait -PassThru -RedirectStandardOutput (Join-Path $env:TEMP "npm-install-out.txt") -RedirectStandardError (Join-Path $env:TEMP "npm-install-err.txt")
$npmExit = $proc.ExitCode
Pop-Location
Write-Host "    npm exit code: $npmExit"

# Copy the clean node_modules (flatten)
$srcNm = Join-Path $minPkgDir "node_modules"
if (Test-Path $srcNm) {
    # Flatten: copy all items inside node_modules to $rnm
    Get-ChildItem -Path $srcNm -Force | ForEach-Object {
        $dest = Join-Path $rnm $_.Name
        if ($_.PSIsContainer) {
            Copy-Item $_.FullName $dest -Recurse -Force
        } else {
            Copy-Item $_.FullName $dest -Force
        }
    }
    Write-Host "    Clean node_modules created (flattened)"
} else {
    Write-Host "    npm install failed (exit=$npmExit), using pnpm node_modules as fallback"
    Copy-Item (Join-Path $ProjectRoot "node_modules") $rnm -Recurse -Force
    $pnpmStore = Join-Path $rnm ".pnpm"
    if (Test-Path $pnpmStore) { Remove-Item $pnpmStore -Recurse -Force -ErrorAction SilentlyContinue }
}
Remove-Item $minPkgDir -Recurse -Force -ErrorAction SilentlyContinue

# Add @greenhorn/shared to the root node_modules
$sharedSrc = Join-Path $ProjectRoot "packages\shared"
$sharedDest = Join-Path $ReleaseDir "packages\shared"
New-Item -ItemType Directory -Force -Path $sharedDest | Out-Null
Copy-Item (Join-Path $sharedSrc "dist") (Join-Path $sharedDest "dist") -Recurse -Force

# Create @greenhorn/shared as a real package in node_modules
$ghDir = Join-Path $rnm "@greenhorn"
New-Item -ItemType Directory -Force -Path $ghDir | Out-Null
$sharedPkgDir = Join-Path $ghDir "shared"
New-Item -ItemType Directory -Force -Path $sharedPkgDir | Out-Null
# Copy the original package.json (has exports field for subpath resolution)
$sharedPkgJsonSrc = Join-Path $sharedSrc "package.json"
if (Test-Path $sharedPkgJsonSrc) {
    Copy-Item $sharedPkgJsonSrc (Join-Path $sharedPkgDir "package.json") -Force
} else {
    $sharedPkgJson = '{"name":"@greenhorn/shared","version":"0.1.0","main":"./dist/index.js","types":"./dist/index.d.ts","exports":{".":{"types":"./dist/index.d.ts","require":"./dist/index.js"},"./constants":{"types":"./dist/constants/index.d.ts","require":"./dist/constants/index.js"},"./types/*":{"types":"./dist/types/*.d.ts","require":"./dist/types/*.js"}}}'
    Set-Content -Path (Join-Path $sharedPkgDir "package.json") -Value $sharedPkgJson -Encoding UTF8
}
Copy-Item (Join-Path $sharedSrc "dist") (Join-Path $sharedPkgDir "dist") -Recurse -Force
Write-Host "    + @greenhorn/shared added"

# 3c. Backend dist
$backendSrc = Join-Path $ProjectRoot "packages\backend"
$backendDest = Join-Path $ReleaseDir "packages\backend"
New-Item -ItemType Directory -Force -Path $backendDest | Out-Null
Copy-Item (Join-Path $backendSrc "dist") (Join-Path $backendDest "dist") -Recurse -Force
Write-Host "  + Backend dist"

# Create backend's node_modules pointing to root (flat structure)
$backendNmDest = Join-Path $backendDest "node_modules"
New-Item -ItemType Directory -Force -Path $backendNmDest | Out-Null

# Link express, cors, uuid from root node_modules
foreach ($pkg in @("express", "cors", "uuid")) {
    $src = Join-Path $rnm $pkg
    $dst = Join-Path $backendNmDest $pkg
    if (Test-Path $src) {
        if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
        Copy-Item $src $dst -Recurse -Force
    }
}

# Copy @types for runtime
$typesSrc = Join-Path $rnm "@types"
$typesDst = Join-Path $backendNmDest "@types"
if (Test-Path $typesSrc) {
    if (Test-Path $typesDst) { Remove-Item $typesDst -Recurse -Force }
    Copy-Item $typesSrc $typesDst -Recurse -Force
}

# Link @greenhorn/shared
$sharedLink = Join-Path $backendNmDest "@greenhorn"
New-Item -ItemType Directory -Force -Path $sharedLink | Out-Null
Copy-Item $sharedPkgDir (Join-Path $sharedLink "shared") -Recurse -Force

Write-Host "  + Backend node_modules (flat, runtime only)"

# 3d. Frontend dist
$frontendDest = Join-Path $ReleaseDir "packages\frontend\dist"
New-Item -ItemType Directory -Force -Path $frontendDest | Out-Null
Copy-Item (Join-Path $ProjectRoot "packages\frontend\dist\*") $frontendDest -Recurse -Force
Write-Host "  + Frontend dist"

# 3e. Launch scripts and config files
Copy-Item (Join-Path $ProjectRoot "start.bat") (Join-Path $ReleaseDir "start.bat") -Force

# 强制 CRLF 保护（防御 LF 进 zip）
$batFiles = @((Join-Path $ReleaseDir "start.bat"))
foreach ($bat in $batFiles) {
    if (Test-Path $bat) {
        $content = [System.IO.File]::ReadAllText($bat)
        $content = $content -replace "`r`n", "`n" -replace "`n", "`r`n"
        [System.IO.File]::WriteAllText($bat, $content, [System.Text.UTF8Encoding]::new($true))
        Write-Host "  + CRLF protection applied: $bat"
    }
}

# Copy install HTML
if (Test-Path (Join-Path $ProjectRoot "安装 GreenHorn.html")) {
    Copy-Item (Join-Path $ProjectRoot "安装 GreenHorn.html") (Join-Path $ReleaseDir "安装 GreenHorn.html") -Force
}

$rootFiles = @("package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", ".npmrc", "README.md", "LICENSE")
foreach ($file in $rootFiles) {
    $src = Join-Path $ProjectRoot $file
    if (Test-Path $src) { Copy-Item $src (Join-Path $ReleaseDir $file) -Force }
}

$scriptsDest = Join-Path $ReleaseDir "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDest | Out-Null
foreach ($file in @("install-node.ps1", "push-to-github.ps1", "launcher.js")) {
    $src = Join-Path $ProjectRoot "scripts\$file"
    if (Test-Path $src) { Copy-Item $src (Join-Path $scriptsDest $file) -Force }
}
Write-Host "  + Launch scripts and config files"

# Step 4: Size calculation
Write-Host "[4/6] Calculating sizes..." -ForegroundColor Yellow
$totalSize = (Get-ChildItem -Recurse $ReleaseDir | Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round($totalSize / 1MB, 1)
$nodeSize = [math]::Round((Get-ChildItem -Recurse (Join-Path $ReleaseDir "node") -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
$nmSize = [math]::Round((Get-ChildItem -Recurse (Join-Path $ReleaseDir "node_modules") -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
$distSize = [math]::Round(((Get-ChildItem -Recurse (Join-Path $ReleaseDir "packages") -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum) / 1MB, 1)

Write-Host ""
Write-Host "  Size breakdown:"
Write-Host "    Node.js:       $nodeSize MB"
Write-Host "    node_modules:  $nmSize MB"
Write-Host "    Build output:  $distSize MB"
Write-Host "    Total:         $sizeMB MB"

# Step 5: Create zip
Write-Host ""
Write-Host "[5/6] Creating zip..." -ForegroundColor Yellow
$distDir = Join-Path $ProjectRoot "dist"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Force -Path $distDir | Out-Null }
if (Test-Path $OutputZip) { Remove-Item $OutputZip -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($OutputZip, [System.IO.Compression.ZipArchiveMode]::Create)
$releaseName = "GreenHorn-Portable-$Version"
$files = Get-ChildItem -Recurse $ReleaseDir -File
$total = $files.Count
$count = 0

foreach ($file in $files) {
    $count++
    $relativePath = $file.FullName.Substring($ReleaseDir.Length + 1)
    $zipPath = "$releaseName\$relativePath"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    if ($count % 500 -eq 0) {
        $percent = [math]::Round($count / $total * 100)
        Write-Host "  Compressing: $count / $total ($percent%)"
    }
}
$zip.Dispose()

$zipSize = [math]::Round((Get-Item $OutputZip).Length / 1MB, 1)
Write-Host "  Zip size: $zipSize MB"

# Cleanup
Remove-Item $ReleaseDir -Recurse -Force -ErrorAction SilentlyContinue

# Step 6: Done
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Green Release Build Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Output: $OutputZip" -ForegroundColor White
Write-Host "  Size: $zipSize MB" -ForegroundColor White
Write-Host ""
Write-Host "  Usage:"
Write-Host "  1. Extract zip to any directory"
Write-Host "  2. Double-click start.bat"
Write-Host "  3. No internet needed, ready to use"
Write-Host ""
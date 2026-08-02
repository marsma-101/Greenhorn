param(
    [string]$DestDir,
    [string]$NodeVersion = "v22.14.0"
)

$ErrorActionPreference = 'SilentlyContinue'

$zipName = "node-$NodeVersion-win-x64.zip"
$urlBase = "https://npmmirror.com/mirrors/node/$NodeVersion"
$urls = @(
    "https://npmmirror.com/mirrors/node/$NodeVersion/$zipName",
    "https://mirrors.huaweicloud.com/nodejs/$NodeVersion/$zipName",
    "https://mirrors.cloud.tencent.com/nodejs-release/$NodeVersion/$zipName",
    "https://nodejs.org/dist/$NodeVersion/$zipName"
)

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
$zipFile = Join-Path $DestDir $zipName
$success = $false

foreach ($url in $urls) {
    Write-Host "  尝试下载: $url"
    try {
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($url, $zipFile)
        Write-Host '  下载完成，正在解压...'
        Expand-Archive -Path $zipFile -DestinationPath $DestDir -Force
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
        $success = $true
        break
    } catch {
        Write-Host "  下载失败: $_"
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    }
}

if ($success) {
    Write-Host '  Node.js 安装完成'
} else {
    Write-Host '  [警告] 所有下载源均失败'
    Write-Host '  请手动下载 Node.js 便携版：'
    Write-Host "    $DestDir"
    Write-Host '  下载地址：https://nodejs.org/dist/'
}

# GreenHorn 推送到 GitHub 脚本
# 使用方法：在 PowerShell 中运行 .\scripts\push-to-github.ps1

Write-Host "=== GreenHorn 推送到 GitHub ===" -ForegroundColor Green

# 检查 Git 配置
Write-Host "`n检查 Git 配置..." -ForegroundColor Yellow
git config user.name
git config user.email

# 检查远程仓库
Write-Host "`n检查远程仓库..." -ForegroundColor Yellow
git remote -v

# 推送代码
Write-Host "`n推送代码到 GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 推送成功！" -ForegroundColor Green
    Write-Host "访问: https://github.com/MARSMA-101/greenhorn" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ 推送失败，请检查网络连接" -ForegroundColor Red
    Write-Host "可能需要配置代理或 VPN" -ForegroundColor Yellow
}

# ===== MarketFlow Frontend Daily Backup =====

$projectRoot = Get-Location
$frontendPath = "$projectRoot\marketflow\frontend"
$backupRoot = "$projectRoot\backup"

$date = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupPath = "$backupRoot\frontend_$date"

Write-Host "Creating backup..."

Copy-Item $frontendPath $backupPath -Recurse

Write-Host "Backup complete:"
Write-Host $backupPath
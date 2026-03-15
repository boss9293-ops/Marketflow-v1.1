param(
    [string]$Reason = "manual_backup",
    [switch]$DoGitCommit = $false
)

$ErrorActionPreference = "Stop"

# ===== Paths =====
$projectRoot  = Get-Location
$frontendPath = Join-Path $projectRoot "marketflow\frontend"
$backupRoot   = Join-Path $projectRoot "_backup"
$logRoot      = Join-Path $projectRoot "logs"

# ===== Validate =====
if (-not (Test-Path $frontendPath)) {
    Write-Host "ERROR: frontend path not found: $frontendPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
}

if (-not (Test-Path $logRoot)) {
    New-Item -ItemType Directory -Path $logRoot | Out-Null
}

# ===== Timestamp =====
$timestamp   = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupName  = "frontend_$timestamp" + "_" + $Reason
$backupPath  = Join-Path $backupRoot $backupName
$logFile     = Join-Path $logRoot "backup_history.log"

Write-Host ""
Write-Host "=== MarketFlow Dev Safety Backup ===" -ForegroundColor Cyan
Write-Host "Project Root : $projectRoot"
Write-Host "Frontend Path: $frontendPath"
Write-Host "Backup Path  : $backupPath"
Write-Host "Reason       : $Reason"
Write-Host ""

# ===== Copy frontend =====
Copy-Item $frontendPath $backupPath -Recurse -Force

# ===== Log =====
$logLine = "[{0}] BACKUP_CREATED | reason={1} | path={2}" -f $timestamp, $Reason, $backupPath
Add-Content -Path $logFile -Value $logLine

Write-Host "Backup completed." -ForegroundColor Green
Write-Host $backupPath -ForegroundColor Yellow

# ===== Optional Git Commit =====
if ($DoGitCommit) {
    Write-Host ""
    Write-Host "Running Git commit..." -ForegroundColor Cyan

    git add . | Out-Null

    $commitMessage = "backup: frontend $timestamp [$Reason]"
    $gitCommitOutput = git commit -m $commitMessage 2>&1

    Add-Content -Path $logFile -Value ("[{0}] GIT_COMMIT | message={1}" -f $timestamp, $commitMessage)

    Write-Host "Git commit completed." -ForegroundColor Green
    Write-Host $commitMessage -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
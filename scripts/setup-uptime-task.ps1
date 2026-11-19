param(
  [string]$TaskName = "PlanittCRM-Render-Uptime-Bot",
  [string]$ProjectRoot = "D:\PLANITT-CRM",
  [int]$IntervalMinutes = 14
)

$ErrorActionPreference = "Stop"

$BotScript = Join-Path $ProjectRoot "scripts\render-uptime-bot.mjs"
if (!(Test-Path -LiteralPath $BotScript)) {
  throw "Uptime bot script not found at: $BotScript"
}

# Resolve node.exe path
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (!$nodeExe) {
  $nodeExe = "node.exe"
}

Write-Host "Configuring Windows Scheduled Task: $TaskName..." -ForegroundColor Cyan

# Action: runs the keep-alive bot in single-run mode (--once)
$action = New-ScheduledTaskAction `
  -Execute $nodeExe `
  -Argument "`"$BotScript`" --once" `
  -WorkingDirectory $ProjectRoot

# Trigger: runs every $IntervalMinutes minutes, indefinitely
$timeSpan = New-TimeSpan -Minutes $IntervalMinutes
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval $timeSpan

# Settings: runs on battery or AC, wakes system if needed
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 3)

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "✔ Scheduled Task '$TaskName' registered successfully!" -ForegroundColor Green
Write-Host "  -> It will execute every $IntervalMinutes minutes to keep the Render backend warm." -ForegroundColor Yellow
Write-Host "  -> To remove later: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray

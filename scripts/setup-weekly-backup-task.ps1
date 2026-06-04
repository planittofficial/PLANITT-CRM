param(
  [string]$TaskName = "PlanittCRM-Weekly-DB-Backup",
  [string]$ProjectRoot = "D:\PLANITT-CRM",
  [string]$BackupScript = "D:\PLANITT-CRM\scripts\backup-db.ps1",
  [string]$DayOfWeek = "Sunday",
  [string]$Time = "02:00"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $BackupScript)) {
  throw "Backup script not found: $BackupScript"
}

$timeParts = $Time.Split(":")
if ($timeParts.Length -ne 2) {
  throw "Time must be in HH:mm format (example: 02:00)"
}

$hour = [int]$timeParts[0]
$minute = [int]$timeParts[1]
$startBoundary = (Get-Date -Hour $hour -Minute $minute -Second 0).AddDays(1)

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BackupScript`" -ProjectRoot `"$ProjectRoot`""

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DayOfWeek -At "$Time"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Output "Scheduled task created/updated: $TaskName ($DayOfWeek at $Time)"

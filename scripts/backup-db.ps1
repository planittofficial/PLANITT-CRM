param(
  [string]$ProjectRoot = "D:\PLANITT-CRM",
  [string]$BackupDir = "D:\PLANITT-CRM\backups\db",
  [int]$KeepWeeks = 12
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param(
    [string]$EnvFilePath,
    [string]$Key
  )

  if (!(Test-Path -LiteralPath $EnvFilePath)) {
    throw "Env file not found: $EnvFilePath"
  }

  $lines = Get-Content -LiteralPath $EnvFilePath
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
    if ($trimmed -match "^$Key\s*=\s*(.*)$") {
      $value = $Matches[1].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }

  return $null
}

function Ensure-Directory {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

Ensure-Directory -Path $BackupDir

$envFile = Join-Path $ProjectRoot "server\.env"
$databaseUrl = Get-EnvValue -EnvFilePath $envFile -Key "DATABASE_URL"
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw "DATABASE_URL not found in $envFile"
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupFile = Join-Path $BackupDir "crm_$timestamp.dump"

$env:DATABASE_URL = $databaseUrl
pg_dump --format=custom --file="$backupFile" "$env:DATABASE_URL"

if (!(Test-Path -LiteralPath $backupFile)) {
  throw "Backup failed, file not created: $backupFile"
}

# Retention cleanup based on week count.
$cutoff = (Get-Date).AddDays(-7 * $KeepWeeks)
Get-ChildItem -LiteralPath $BackupDir -Filter "*.dump" -File |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

Write-Output "Backup completed: $backupFile"

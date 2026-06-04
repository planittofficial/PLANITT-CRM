param(
  [Parameter(Mandatory = $true)]
  [string]$DumpFile,
  [string]$ProjectRoot = "D:\PLANITT-CRM",
  [switch]$Force
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

if (!(Test-Path -LiteralPath $DumpFile)) {
  throw "Dump file not found: $DumpFile"
}

$envFile = Join-Path $ProjectRoot "server\.env"
$databaseUrl = Get-EnvValue -EnvFilePath $envFile -Key "DATABASE_URL"
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw "DATABASE_URL not found in $envFile"
}

if (-not $Force) {
  Write-Host "WARNING: This will overwrite data in the target database." -ForegroundColor Yellow
  Write-Host "Target DB: $databaseUrl"
  Write-Host "Dump file: $DumpFile"
  $answer = Read-Host "Type YES to continue"
  if ($answer -ne "YES") {
    Write-Output "Restore cancelled."
    exit 0
  }
}

$env:DATABASE_URL = $databaseUrl
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$env:DATABASE_URL" "$DumpFile"

Write-Output "Restore completed from: $DumpFile"

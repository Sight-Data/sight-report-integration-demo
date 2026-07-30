param(
  [switch]$SkipInstall,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$sampleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $sampleRoot 'backend-node'
$envExampleFile = Join-Path $backendDir '.env.example'
$envFile = Join-Path $backendDir '.env'
$demoUrl = 'http://localhost:3010/demo/'

function Write-Step {
  param([string]$Message)
  Write-Host "[third-party-demo] $Message" -ForegroundColor Cyan
}

function Ensure-Command {
  param([string]$CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $CommandName"
  }
}

Write-Step 'Checking required commands'
Ensure-Command 'node'
Ensure-Command 'npm'

if (-not (Test-Path $backendDir)) {
  throw "Backend directory not found: $backendDir"
}

if (-not (Test-Path $envFile)) {
  Write-Step 'No .env found, creating one from .env.example'
  Copy-Item $envExampleFile $envFile
  Write-Warning 'A new .env file has been created. Update SIGHT_REPORT_BASE_URL, SIGHT_REPORT_APP_ID and SIGHT_REPORT_APP_SECRET before running again.'
  Start-Process notepad.exe $envFile | Out-Null
  exit 1
}

$envContent = Get-Content $envFile -Raw
if ($envContent -match 'SIGHT_REPORT_APP_SECRET\s*=\s*replace-with-real-secret') {
  Write-Warning '.env still contains the placeholder SIGHT_REPORT_APP_SECRET. Update it before starting the demo.'
  Start-Process notepad.exe $envFile | Out-Null
  exit 1
}

if ((-not $SkipInstall) -or (-not (Test-Path (Join-Path $backendDir 'node_modules')))) {
  Write-Step 'Installing npm dependencies'
  Push-Location $backendDir
  try {
    npm install
  }
  finally {
    Pop-Location
  }
}

Write-Step 'Starting backend service in a new PowerShell window'
$command = "Set-Location '$backendDir'; npm start"
Start-Process powershell.exe -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $command -WorkingDirectory $backendDir | Out-Null

if (-not $NoBrowser) {
  Write-Step 'Waiting briefly, then opening demo page'
  Start-Sleep -Seconds 3
  Start-Process $demoUrl | Out-Null
}

Write-Host ''
Write-Host 'Demo startup command has been launched.' -ForegroundColor Green
Write-Host "Demo page: $demoUrl" -ForegroundColor Green
Write-Host 'If the page does not load, confirm .env values and that Sight Report is reachable.' -ForegroundColor Yellow

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.env')) { & npm.cmd run setup }
if (-not (Test-Path -LiteralPath 'node_modules')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Installation fehlgeschlagen.' } }
if (-not (Test-Path -LiteralPath 'dist/index.html')) { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build fehlgeschlagen.' } }
New-Item -ItemType Directory -Path 'data' -Force | Out-Null
$node = (Get-Command node.exe).Source
& $node --import tsx server/init.ts
if ($LASTEXITCODE -ne 0) { throw 'Datenbankeinrichtung fehlgeschlagen.' }
$running = @()
foreach ($name in @('web','worker')) {
  $pidFile = Join-Path $PSScriptRoot "data/$name.pid"
  if (Test-Path -LiteralPath $pidFile) {
    $savedId = [int](Get-Content -LiteralPath $pidFile)
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$savedId" -ErrorAction SilentlyContinue
    if ($existing -and $existing.CommandLine.Contains($PSScriptRoot) -and $existing.CommandLine.Contains('server')) { $running += $name; continue }
  }
  $entry = if ($name -eq 'web') { 'index.ts' } else { 'worker.ts' }
  $entryPath = Join-Path $PSScriptRoot "server/$entry"
  $p = Start-Process -FilePath $node -ArgumentList @('--import', 'tsx', "`"$entryPath`"") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput "data/$name.log" -RedirectStandardError "data/$name-error.log" -PassThru
  $p.Id | Set-Content -LiteralPath $pidFile
}
Write-Host 'NEWSDECK startet im Hintergrund: http://localhost:3000'
if (Test-Path -LiteralPath '.rsshub/node_modules/rsshub/dist-lib/pkg.mjs') {
  $rssPidFile = Join-Path $PSScriptRoot 'data/rsshub.pid'
  $rssExisting = $null
  if (Test-Path -LiteralPath $rssPidFile) {
    $rssSavedId = [int](Get-Content -LiteralPath $rssPidFile)
    $rssExisting = Get-CimInstance Win32_Process -Filter "ProcessId=$rssSavedId" -ErrorAction SilentlyContinue
  }
  if (-not ($rssExisting -and $rssExisting.CommandLine.Contains($PSScriptRoot) -and $rssExisting.CommandLine.Contains('rsshub-service.mjs'))) {
    $rssEntry = Join-Path $PSScriptRoot 'scripts/rsshub-service.mjs'
    $rssProcess = Start-Process -FilePath $node -ArgumentList @('--import','tsx',"`"$rssEntry`"") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput 'data/rsshub.log' -RedirectStandardError 'data/rsshub-error.log' -PassThru
    $rssProcess.Id | Set-Content -LiteralPath $rssPidFile
  }
}
Write-Host 'Stoppen: .\Stop-Newsdeck.ps1 | Protokolle: data/'

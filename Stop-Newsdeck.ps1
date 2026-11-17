$ErrorActionPreference = 'Stop'
foreach ($name in @('web','worker','rsshub')) {
  $pidFile = Join-Path $PSScriptRoot "data/$name.pid"
  if (Test-Path -LiteralPath $pidFile) {
    $savedId = [int](Get-Content -LiteralPath $pidFile)
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$savedId" -ErrorAction SilentlyContinue
    if ($p -and $p.CommandLine.Contains($PSScriptRoot) -and ($p.CommandLine.Contains('server') -or ($name -eq 'rsshub' -and $p.CommandLine.Contains('rsshub-service.mjs')))) { Stop-Process -Id $savedId }
    Remove-Item -LiteralPath $pidFile
  }
}
Write-Host 'NEWSDECK beendet. Daten bleiben erhalten.'

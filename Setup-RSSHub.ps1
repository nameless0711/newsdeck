$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
New-Item -ItemType Directory -Path '.rsshub' -Force | Out-Null
Copy-Item -LiteralPath 'scripts/rsshub-package.json' -Destination '.rsshub/package.json'
& npm.cmd install --prefix .rsshub --omit=optional --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'RSSHub-Installation fehlgeschlagen.' }
Write-Host 'RSSHub installiert. Start-Newsdeck.ps1 startet den lokalen Dienst mit.'

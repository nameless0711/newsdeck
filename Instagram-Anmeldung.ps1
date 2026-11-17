param([ValidateSet('login','test','disconnect','smoke')][string]$Modus = 'login')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$node = (Get-Command node.exe).Source
$entry = Join-Path $PSScriptRoot 'scripts/instagram-session.mjs'
if (-not (Test-Path 'node_modules/playwright')) { throw 'Bitte zuerst npm install ausführen.' }
# The visible Edge window is the intended interactive login surface.
& $node $entry $Modus
if ($LASTEXITCODE -ne 0) { throw 'Instagram-Anmeldetest fehlgeschlagen. Siehe data/instagram/status.json.' }

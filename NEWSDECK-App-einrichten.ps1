# NEWSDECK-App-einrichten.ps1 – einmalig ausführen (Rechtsklick > "Mit PowerShell ausführen").
# Baut das Frontend neu, falls das App-Icon noch fehlt, und legt die Verknüpfung
# "NEWSDECK" auf dem Desktop und im Startmenü an. Beliebig oft wiederholbar.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

try {
  if (-not (Test-Path -LiteralPath 'dist/manifest.webmanifest')) {
    Write-Host 'Frontend wird neu gebaut (enthält App-Icon und Manifest) ...'
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build fehlgeschlagen.' }
  }

  $launcher = Join-Path $PSScriptRoot 'NEWSDECK-App.ps1'
  $icon = Join-Path $PSScriptRoot 'public\favicon.ico'
  $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $targets = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('Programs')
  )

  $shell = New-Object -ComObject WScript.Shell
  foreach ($folder in $targets) {
    $linkPath = Join-Path $folder 'NEWSDECK.lnk'
    $link = $shell.CreateShortcut($linkPath)
    $link.TargetPath = $powershell
    $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
    $link.WorkingDirectory = $PSScriptRoot
    $link.IconLocation = "$icon,0"
    $link.WindowStyle = 7
    $link.Description = 'NEWSDECK öffnen'
    $link.Save()
    Write-Host "Verknüpfung angelegt: $linkPath"
  }

  Write-Host ''
  Write-Host 'Fertig. NEWSDECK lässt sich jetzt über das Icon auf dem Desktop oder im Startmenü öffnen.'
  Write-Host 'Tipp: Im Startmenü per Rechtsklick auf "NEWSDECK" > "An Taskleiste anheften".'
} catch {
  Write-Host ''
  Write-Host "Fehler: $($_.Exception.Message)" -ForegroundColor Red
}
Read-Host 'Zum Schließen Enter drücken'

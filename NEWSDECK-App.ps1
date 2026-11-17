# NEWSDECK-App.ps1 – öffnet NEWSDECK im eigenen App-Fenster.
# Läuft NEWSDECK noch nicht, wird es vorher über Start-Newsdeck.ps1 gestartet.
# Gedacht für die Desktop-Verknüpfung (siehe NEWSDECK-App-einrichten.ps1).
# Protokoll der Schritte: data\app-start.log
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$appUrl = 'http://localhost:3000'
$port = 3000
$startTimeoutSeconds = 120
$logFile = Join-Path $PSScriptRoot 'data\app-start.log'

function Write-AppLog([string]$text) {
  try {
    $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $text
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
  } catch { }
}

# Prüft direkt, ob der Webserver auf 127.0.0.1:3000 lauscht.
# Bewusst ohne HTTP-Anfrage, damit kein System-Proxy (z. B. Cisco) dazwischenfunkt.
function Test-Newsdeck {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $attempt = $client.BeginConnect('127.0.0.1', $port, $null, $null)
    if (-not $attempt.AsyncWaitHandle.WaitOne(1000)) { return $false }
    $client.EndConnect($attempt)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Show-Error([string]$text) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($text, 'NEWSDECK', 'OK', 'Error') | Out-Null
}

function Find-AppBrowser {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  )
  foreach ($path in $candidates) {
    if ($path -and (Test-Path -LiteralPath $path)) { return $path }
  }
  return $null
}

Write-AppLog "Starter aufgerufen (PowerShell $($PSVersionTable.PSVersion))"

# Verhindert, dass ein Doppelklick NEWSDECK zweimal parallel startet.
# Läuft schon ein Starter, wird auf ihn gewartet statt still abzubrechen.
$mutex = New-Object System.Threading.Mutex($false, 'Local\NEWSDECK-App-Starter')
$hasMutex = $false
try {
  try {
    $hasMutex = $mutex.WaitOne(($startTimeoutSeconds + 10) * 1000)
  } catch [System.Threading.AbandonedMutexException] {
    $hasMutex = $true
  }
  if (-not $hasMutex) { throw 'Ein anderer NEWSDECK-Start hängt. Bitte den Rechner neu starten oder Stop-Newsdeck.ps1 ausführen.' }

  if (Test-Newsdeck) {
    Write-AppLog 'NEWSDECK läuft bereits'
  } else {
    Write-AppLog 'NEWSDECK läuft nicht – starte Dienste'
    & (Join-Path $PSScriptRoot 'Start-Newsdeck.ps1') | Out-Null
    $deadline = (Get-Date).AddSeconds($startTimeoutSeconds)
    while (-not (Test-Newsdeck)) {
      if ((Get-Date) -gt $deadline) {
        throw "NEWSDECK hat nach $startTimeoutSeconds Sekunden nicht geantwortet.`nBitte die Protokolle im Ordner data\ prüfen (web-error.log)."
      }
      Start-Sleep -Milliseconds 500
    }
    Write-AppLog 'Dienste gestartet'
  }

  $browser = Find-AppBrowser
  if ($browser) {
    Write-AppLog "Öffne App-Fenster mit $browser"
    Start-Process -FilePath $browser -ArgumentList @("--app=$appUrl", '--window-size=1400,900')
  } else {
    Write-AppLog 'Kein Edge/Chrome gefunden – öffne Standardbrowser'
    Start-Process $appUrl
  }
  Write-AppLog 'Fertig'
} catch {
  Write-AppLog "FEHLER: $($_.Exception.Message)"
  Show-Error "NEWSDECK konnte nicht geöffnet werden.`n`n$($_.Exception.Message)"
  exit 1
} finally {
  if ($hasMutex) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}

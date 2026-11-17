# Lokaler Instagram-Anmeldetest

Stand 01.11.2026. Eigenständiger Machbarkeitsprototyp; noch keine Verbindung zum produktiven RSSHub und kein belegter angemeldeter Feedabruf.

## Bedienung

Im NEWSDECK-Verzeichnis `./Instagram-Anmeldung.ps1` ausführen. Ein separates Edge-Fenster öffnet die echte Instagram-Anmeldeseite. Dort selbst anmelden und gegebenenfalls 2FA/Sicherheitsprüfung abschließen. Keine Zugangsdaten an NEWSDECK oder den Chat übermitteln. Edge muss installiert sein; die Browserbibliothek wird durch `npm install` bereitgestellt.

Der Helfer wartet höchstens 20 Minuten. Nach Erkennung der notwendigen Cookies außerhalb der Login-/Sicherheitsprüfungsseite schützt er diese mit Windows DPAPI (CurrentUser), speichert `data/instagram/session.dpapi` und schließt das Fenster. Das ist ein Sitzungshinweis, keine verifizierte Kontoidentität und kein Nachweis eines funktionierenden Beitragsabrufs. Es wird kein bestehendes Browserprofil gelesen oder ein dauerhaftes Browserprofil erzeugt. Keine Screenshots, Browsertraces oder Passwortaufzeichnung.

`./Instagram-Anmeldung.ps1 test` lädt die geschützte Sitzung in einen frischen Browser und prüft erneut die Erkennung. `./Instagram-Anmeldung.ps1 disconnect` löscht die gespeicherte Sitzung; einen laufenden Versuch vorher durch Schließen seines Browserfensters beenden. Nicht mehrere Helfer gleichzeitig starten. Löschen der lokalen Datei widerruft keine Instagram-Sitzung auf anderen Geräten. Der Windows-Kontoschutz schützt nicht gegen Programme, die bereits unter demselben Windows-Konto laufen.

Status ohne Geheimnisse: `data/instagram/status.json`. `session_detected` enthält ausdrücklich `authenticatedFetchVerified: false`. `error` enthält höchstens einen sicheren Fehlercode. `data/` bleibt von Git, Docker-Build und Quellcode-Archiv ausgeschlossen.

## Bisherige Prüfungen

- Edge-Start im Hintergrundtest erfolgreich.
- Cookie-Auswahl verwirft fremde Domains, unsichere oder abgelaufene Cookies und unnötige Cookie-Namen.
- DPAPI-Rundlauf mit synthetischem Inhalt erfolgreich; beschädigter Inhalt wird zurückgewiesen.
- 30 automatisierte Tests bestanden; NEWSDECK-Build erfolgreich.
- Erster echter Start scheiterte beim Laden; erneut mit freigegebenem Internetzugriff gestartet.
- Persönliche Anmeldung abgeschlossen: am 01.11.2026 um 14:24:47 UTC wurden die benötigten Sitzungscookies erkannt und geschützt gespeichert.
- Wiederverwendung um 14:25:14 UTC erfolgreich: ein frischer Browser erhielt die entschlüsselte Sitzung und wurde außerhalb der Login-/Challenge-Seite mit den benötigten Cookies erkannt. Dies verifiziert noch keine Kontoidentität und keinen Feedabruf.
- Aktueller Preflight um 14:25:45 UTC für `nasa`: robots.txt HTTP 200, automatischer Profilabruf ausgeschlossen. Es wurden keine Sitzungscookies an RSSHub übergeben und keine Beiträge abgerufen. Beleg: `data/instagram/preflight.json`; reproduzierbar mit `node --import tsx scripts/instagram-preflight.ts nasa`.

## Nächster Schritt nach persönlicher Anmeldung

Die lokale Anmeldung ist im ersten Test machbar. Der automatische RSSHub-Abruf bleibt gemäß Masterprompt (robots.txt beachten, technische Zugriffsbeschränkungen nicht umgehen) pausiert. Nächster sinnvoller Schritt ist die offizielle Meta-Anbindung für geeignete Business-/Creator-Zielprofile. Die aktuelle RSSHub-Diensthülle leert weiterhin alle Anmeldewerte; sie verwendet diese neue Sitzungsdatei noch nicht. Eine vollständige Integration und Kontoidentitätsprüfung stehen aus.

# RSSHub lokal

RSSHub ist als separater Node-Prozess installiert, ohne Docker und ohne Instagram-Anmeldung. Installierte npm-Version: `1.0.0-master.986522c`. Die Version ist in `scripts/rsshub-package.json` festgelegt; die separate Installation liegt unter `.rsshub/`. NEWSDECK übernimmt dadurch nicht die große RSSHub-Abhängigkeitsmenge in seinen Webprozess.

## Start und Bedienung

- Bereits installiert: `Start-Newsdeck.ps1` startet RSSHub zusammen mit NEWSDECK, wenn es noch nicht läuft.
- Neue Installation: `Setup-RSSHub.ps1`, dann `Start-Newsdeck.ps1`.
- Stoppen: `Stop-Newsdeck.ps1` beendet alle drei Projektprozesse.
- Erreichbarkeit: `http://127.0.0.1:1200/healthz` meldet den Dienstzustand und `instagramLogin: false`.
- Quellenformular: **Instagram über lokalen RSSHub (kostenlos)** wählen, öffentliche Profiladresse eingeben und **Profil testen** anklicken. Es wird kein RSS.app-Konto benötigt.
- Erst bei erfolgreichem Test und geprüften Abrufbedingungen aktivieren. Der Worker liest anschließend regelmäßig über RSSHub ein. Ein fehlgeschlagener Test ist keine leere Erfolgsmeldung.

Die Quelle speichert die Instagram-Profiladresse, keine interne Netzwerkadresse. Der Connector erzeugt ausschließlich `/instagram/user/USERNAME` an der vom Betreiber festgelegten `RSSHUB_BASE_URL` (Standard `http://127.0.0.1:1200`). Allgemeine Quellen dürfen weiterhin keine internen Adressen ansprechen. Die lokale Dienstoberfläche bietet nur Health und Instagram-Profilfeeds an, mit höchstens einem gleichzeitigen Abruf. Erfolgreiche Ergebnisse werden eine Stunde, Fehler fünf Minuten zwischengespeichert.

`INSTAGRAM_COOKIE`, `IG_COOKIE`, `IG_USERNAME` und `IG_PASSWORD` werden ausdrücklich leer gesetzt. NEWSDECK hinterlegt keine Instagram-Anmeldedaten. Die feste Abrufkennung ist `NewsdeckBot/1.0`; zufällige Browserkennungen sind deaktiviert.

## Tatsächlicher Test am 01.11.2026

- Lokaler Dienst gestartet; Health HTTP 200 und `instagramLogin: false`.
- Instagram-Profil `nasa` ohne Anmeldung angefragt.
- Ergebnis: HTTP 502, RSSHub konnte die Profilantwort nicht auswerten: `Cannot read properties of undefined (reading 'is_private')`.
- Ein vorheriger Fehler der automatischen HTTP-Header-Erzeugung wurde durch die unterstützten RSSHub-Konfigurationsoptionen `UA` und `NO_RANDOM_UA` behoben.
- Es wurden keine echten Instagram-Beiträge importiert und keine Ergebnisse durch Demodaten ersetzt.
- Dasselbe Auswertungsproblem trat beim zweiten öffentlichen Profil `stefaniejoosten` auf.
- Die ausgelieferte Diensthülle prüft zusätzlich robots.txt vor dem RSSHub-Abruf und stoppt bei ausgeschlossenen Pfaden oder nicht zugänglicher robots.txt.
- Abschließender Test über NEWSDECK: `RSSHub HTTP 502 … Instagram robots.txt schließt den Abruf mit NewsdeckBot aus.` Der Dienst hat den weiteren Abruf entsprechend unterlassen. Damit ist auch der komplette Fehlerweg vom lokalen RSSHub bis zur Anwendung geprüft (`data/rsshub-newsdeck-test.json`).
- NEWSDECK-Build und 28 automatisierte Tests bestanden. Lokale Testserver prüfen zusätzlich erfolgreichen RSSHub-Feedimport, den Test-Endpunkt und die Weitergabe von Abruffehlern.

Ein funktionierender lokaler Dienst garantiert keinen funktionierenden Instagram-Zugriff. Der beobachtete Fehler kann eine geänderte Instagram-Antwort oder einen Fehler der installierten RSSHub-Version bedeuten; daraus wird keine eindeutige IP-Sperre abgeleitet. Keine Proxy-Rotation, keine Anmeldung und keine Umgehung von Zugriffsschranken eingerichtet.

Protokolle: `data/rsshub.log`, `data/rsshub-error.log`. Testbelege: `data/rsshub-live-test.json`, `data/rsshub-live-test-second.json`.

## Docker auf einem späteren Server

`docker compose -f compose.yaml -f compose.rsshub.yaml up -d --build` ergänzt den offiziellen RSSHub-Container ohne veröffentlichten Port. Web und Worker nutzen intern `http://rsshub:1200`. Diese Variante wurde hier mangels laufender Docker-Engine nicht ausgeführt. Der offizielle Container stellt mehr Routen als die lokale, eingeschränkte Node-Hülle bereit; NEWSDECK erzeugt auch dort nur Instagram-Profilrouten.

RSSHub ist AGPL-3.0-lizenziert: https://github.com/DIYgod/RSSHub . Die Lizenz und zugehörige Hinweise befinden sich zusätzlich in der lokalen npm-Installation. Der Zugriff auf Instagram unterliegt unabhängig von der Softwarelizenz den Bedingungen und technischen Einschränkungen von Instagram.

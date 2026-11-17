# Prüfprotokoll NEWSDECK

## RSSHub lokal – 01.11.2026

Separaten RSSHub-Node-Dienst installiert und in Windows-Start/Stop integriert; neuer Quellentyp `instagram_rsshub` mit Profil-Test-Endpunkt, Suchfilter und fest konfigurierter interner Verbindung. Build und 28 Tests bestanden. Health des lokalen Diensts meldet ohne Instagram-Anmeldung HTTP 200. Echte Profiltests mit NASA und stefaniejoosten scheiterten an der Auswertung der Instagram-Antwort. Die abschließende robots.txt-Prüfung schließt Abrufe mit NewsdeckBot aus; NEWSDECK zeigt diese Ursache korrekt an. Keine Instagram-Meldungen importiert. Details: [RSSHub-Prüfung](RSSHUB.md). Browserprüfung der neuen Option war wegen einer nicht verfügbaren Browserverbindung nicht möglich.

## Erweiterung Instagram über RSS – 01.11.2026

Eigener Quellentyp `instagram_rss` mit Einrichtungsanleitung, externem Generator-Link, Feedprüfung und verständlicher Zurückweisung direkter Instagram-Adressen ergänzt. Der bestehende RSS-Connector verarbeitet diese Quellen; Suchfilter und Quellenimport/-export unterstützen den Typ. Build und 27 automatisierte Tests bestanden. Web- und Worker-Prozess neu gestartet. Quellenformular im Browser visuell geprüft (siehe `screenshots/instagram-rss.png`). Die Feedverarbeitung ist mit synthetischen Instagram-RSS-Daten getestet; ein echter Anbieterfeed muss vom Betreiber bei RSS.app oder einem anderen geeigneten Dienst erzeugt werden und wurde nicht vorgetäuscht.

## Nachprüfung URL-Eingabe – 01.11.2026

URL-Normalisierung für Erkennung, Anlegen, Bearbeiten und Import ergänzt: fehlendes HTTPS wird ergänzt, äußere Leerzeichen werden entfernt. Das Eingabefeld akzeptiert auch Adressen ohne Protokoll. Build und 26 Tests bestanden. Webdienst neu gestartet; Live-Erkennung von `  www.tagesschau.de/index~rss2.xml  ` lieferte HTTP 200 und den korrekten RSS-Feed. Der zuvor wegen einer fehlgeschlagenen automatischen Freigabe ausstehende Neustart ist damit erledigt.

Stand: 30.10.2026. Dieses Dokument unterscheidet geprüfte Funktionen von vorbereiteten Integrationen. Es ist keine pauschale Produktionsfreigabe für einen unbekannten Server.

## Tatsächlich ausgeführt

| Prüfung | Ergebnis |
|---|---|
| TypeScript-Prüfung und optimierter Frontend-Build | Erfolgreich |
| Automatisierte Tests | 25 bestanden, 0 fehlgeschlagen |
| npm audit nach Aktualisierung | 0 gemeldete Schwachstellen |
| Lokaler Start mit getrennten Web-/Worker-Prozessen | Erfolgreich, Port 3000 |
| Anmeldung im echten Browser | Erfolgreich |
| Quelle über die Oberfläche hinzufügen und Feed erkennen | Erfolgreich, tagesschau.de |
| Echter automatischer RSS-Abruf | 70 Meldungen dauerhaft gespeichert |
| Suchfeld und Filteroberfläche | Geprüft, Suchergebnis sichtbar |
| Merkliste speichern/entfernen | Geprüft |
| Artikeldetails und Originalverweise | Geprüft |
| Manuelle Themenkorrektur | Geprüft, gespeichert |
| Desktop 1440 × 1000 und Smartphone 390 × 844 | Visuell geprüft |
| Light Mode und Dark Mode | Visuell geprüft; gefundenen Kontrastfehler behoben |
| Neustart beider Prozesse | Alle 70 Meldungen erhalten, Worker aktiv |
| Zweiter Abruf bei geschlossenem Dashboard | Erfolgreich durch separaten Worker; eine neue echte Meldung ergänzt, Bestand danach 71 |
| SQLite-Live-Backup | Erstellt; `integrity_check=ok`, 70 Meldungen enthalten |
| Docker Compose Konfiguration | `docker compose config --quiet` erfolgreich |

Der Testlauf umfasst Passwortprüfung, RSS/Atom, fehlende Daten, fehlerhaftes XML, HTML-Extraktion, Paywall-Marker, Schutz vor internen Netzwerkzielen, robots-Regeln, Authentifizierung, CSRF, Quellen-CRUD/Import/Export, Themen-CRUD/Zyklen, Themenregeln/Ausschlüsse, Speicherung und Deduplizierung, Revisionen, Titelähnlichkeit, Suche/Filter, Favoriten/Detailansicht, KI-Ausfall/Retry, validierte KI-Antwort eines lokalen Testservers, Erhalt redaktioneller Prüfung, exklusiven Quellenclaim, isolierte Connectorfehler, Leserrechte, Briefings und Session-Widerruf.

Beim abrupten Windows-Neustart der Prozesse wurde die erwartete zweiminütige Scheduler-Sperre beobachtet. Danach übernahm der neue Worker ohne manuellen Datenbankeingriff und schloss den erneuten Abruf erfolgreich ab.

## Bewusste Grenzen und ausstehende Live-Prüfungen

- **Docker/PostgreSQL:** Docker Desktop ist vorhanden, die Linux-Engine wurde trotz Startversuch nicht erreichbar. Container-Build, PostgreSQL-Laufzeit und PostgreSQL-Backup/Restore sind deshalb noch nicht als bestanden ausgewiesen. Lokal wurde SQLite verwendet.
- **KI:** Anschluss für kompatible APIs implementiert und mit lokalem Testserver sowie Ausfall geprüft. Kein externer Anbieterzugang eingerichtet, keine echten KI-Zusammenfassungen erzeugt. Aktuell sind Themen regelbasiert, Relevanz entspricht Quellenpriorität. Keyword-Zuordnung kann falsche Treffer liefern; manuelle Korrektur ist vorhanden.
- **Instagram:** offizieller Meta-Connector implementiert, aber ohne Betreiberzugang nicht live getestet. Keine zugesagte Überwachung beliebiger öffentlicher Profile.
- **E-Mail:** SMTP-Versand und Wiederholungen implementiert; ohne SMTP-Zugang kein realer Zustelltest. Es wurden keine E-Mails versendet.
- **Websites:** statische Artikel-/Newsroom-Extraktion mit Test-HTML geprüft; kein Versprechen universeller Seitenerkennung oder JavaScript-Crawling.
- **Cluster:** heuristische Titelähnlichkeit, keine semantisch verifizierte Zusammenführung. Revisionsverlauf bezieht sich auf denselben Artikellink. Keine unabhängige automatische Faktenbestätigung.
- **Skalierung:** ein aktiver Scheduler, sequentielle Quellenverarbeitung; kein Lasttest und keine Hochverfügbarkeitsprüfung. Automatischer Betrieb ist unabhängig vom Browser, aber vom eingeschalteten Rechner abhängig.
- **Rechte:** lokale Tagesschau-Quelle ausschließlich für private, nicht-kommerzielle Nutzung. Eine öffentliche Veröffentlichung des Nachrichtenbestands oder Weitergabe an externe KI-Anbieter ist damit nicht automatisch abgedeckt.

## Nächster Schritt

Server/Domain bestimmen, dort Compose mit PostgreSQL starten und Backup/Restore prüfen. Anschließend HTTPS und optionale KI-/SMTP-/Meta-Zugänge konfigurieren. Bis dahin ist die lokale Kernanwendung nutzbar. Installations- und Betriebsdetails stehen in `README.md`.

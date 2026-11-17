# NEWSDECK

Eigenständig betriebener Nachrichten-Newsroom mit React/TypeScript, Express, PostgreSQL (Server) oder SQLite (lokal) und separatem Hintergrunddienst. Keine Abhängigkeit von ChatGPT, diesem Chat oder einem Browserfenster.

## Hier auf diesem Rechner

Die Anwendung ist unter **http://localhost:3000** eingerichtet. Zugangsdaten stehen ausschließlich in `data/Zugang.txt` und `.env`. Diese Dateien gehören nicht ins Versionsarchiv.

- **Als App über ein Icon öffnen:** einmalig `NEWSDECK-App-einrichten.ps1` ausführen (Rechtsklick → „Mit PowerShell ausführen“). Danach liegt „NEWSDECK“ auf dem Desktop und im Startmenü (dort per Rechtsklick an die Taskleiste anheftbar). Ein Klick startet NEWSDECK bei Bedarf (auch nach einem Neustart) und öffnet es in einem eigenen Fenster ohne Browserleiste (Edge oder Chrome). Die Logik steckt in `NEWSDECK-App.ps1` (Protokoll: `data/app-start.log`); Icons und Manifest liegen in `public/`.
- Start: `Start-Newsdeck.ps1` im Projektordner ausführen.
- Stoppen: `Stop-Newsdeck.ps1`.
- Die beiden Node-Prozesse laufen versteckt weiter, wenn das Browserfenster oder ChatGPT geschlossen wird. Der Rechner muss eingeschaltet bleiben.
- Nach einem Windows-Neustart das Startskript erneut ausführen oder einfach das NEWSDECK-Icon anklicken. Für zuverlässigen 24/7-Betrieb ist die Docker-Installation auf einem Server vorgesehen.
- Nach einem abrupten Prozessende kann die Übernahme des Abrufdienstes bis zu zwei Minuten dauern, bis die persistente Sperre abgelaufen ist. Das schützt vor doppelten Abrufen.
- Echte Meldungen sind keine Demodaten. Synthetische Testdaten werden nur in einer isolierten temporären Testdatenbank verwendet.

## Neue lokale Installation

Voraussetzung: Node.js 24 LTS, npm, Netzwerkzugriff zu den gewünschten Quellen.

```sh
npm ci
npm run setup
npm run build
npm start
```

In einem zweiten Terminal:

```sh
npm run worker
```

Unter Windows übernimmt `Start-Newsdeck.ps1` beide Prozesse. `npm run setup` erzeugt ein zufälliges Startpasswort und zeigt es einmal an. Es überschreibt keine vorhandene `.env`. Bei der ersten Initialisierung wird der Administrator angelegt; spätere Änderungen von `ADMIN_PASSWORD` setzen bestehende Konten nicht zurück.

Für den direkten Zugriff auf dem eigenen Rechner in `.env` `NEWSDECK_LOCAL_NO_LOGIN=true` setzen und NEWSDECK neu starten. Der Modus erfordert `HOST=127.0.0.1` und nutzt das vorhandene Administratorkonto unter `ADMIN_EMAIL`. Jede Person mit Zugang zum laufenden Rechner kann NEWSDECK dann öffnen. `NEWSDECK_LOCAL_NO_LOGIN=false` aktiviert die Anmeldemaske wieder.

## Bedienung

1. Anmelden und **Quelle hinzufügen** wählen.
2. Name und URL eintragen. **Erkennen** findet RSS/Atom oder einen auf der Website verknüpften Feed.
3. Abrufbedingungen der konkreten Quelle prüfen. Nur aktivieren, wenn die vorgesehene Nutzung erlaubt ist.
4. Themen und Intervall einstellen. Der Worker übernimmt den Abruf, unabhängig von angemeldeten Benutzern.
5. In **Themen verwalten** Suchbegriffe, Ausschlüsse, Unterthemen und inhaltliche Beschreibungen pflegen. Ohne KI werden Regeln angewandt; mit KI erfolgt zusätzlich eine semantische Einordnung.
6. Nachrichten durchsuchen, nach Datum/Quelle/Typ/Relevanz filtern, merken und im Detail öffnen. Eine manuelle Themenzuordnung wird durch spätere KI-Analysen nicht überschrieben.
7. **System & Abrufe** zeigt Status, Fehler und die letzten 100 Abrufe. **Jetzt abrufen** plant einen Job ein; es führt kein Crawling im Webprozess aus.
8. Quellen und Ordner als JSON importieren und exportieren. Fehler werden pro Quelle gemeldet. Erfolgreiche Einträge bleiben gespeichert.
9. Die Einstellungen erlauben Benachrichtigungsregeln und zusätzliche Administrator-/Lesekonten. Alle Konten teilen denselben Newsroom; Merkliste und Benachrichtigungen sind benutzerspezifisch.

Die Anfangsthemen sind bearbeitbar und enthalten nur einfache Regeln. Unpassende Meldungen müssen nicht zwangsläufig einem Thema zugeordnet werden. Die Zahl auf einer Karte ist ohne KI ausdrücklich die **Quellenpriorität**, keine redaktionelle Relevanzmessung.

### Quellenordner

Administratoren verwalten gemeinsame, flache Ordner unter **Quellen**. Jede Quelle kann in einem Ordner liegen. Verschieben ist einzeln im Quellenformular oder für mehrere sichtbare Quellen möglich. Beim Löschen eines Ordners wechseln die Quellen nach **Ohne Ordner** und behalten ihre Beiträge und Abrufeinstellungen.

Der Quellenordner im Nachrichtenfeed gilt auch für ältere Beiträge der aktuell zugeordneten Quellen. Er lässt sich mit den anderen Filtern kombinieren und bleibt beim Neuladen sowie beim Vor- und Zurücknavigieren erhalten. Beiträge gelöschter Quellen sind weiterhin unter **Alle Quellen** sichtbar. Das Tagesbriefing bleibt global.

Der Quellenexport verwendet Version 2. `folders` enthält auch leere Ordner. Pro Quelle gibt `folder` den Namen oder `null` an. Ordnernamen werden beim Import nach Unicode-Normalisierung, Entfernen äußerer Leerzeichen und ohne Beachtung der Groß-/Kleinschreibung verglichen. `topic_names` verweist auf eindeutig benannte vorhandene Themen im Ziel. Das ältere Arrayformat mit lokalen Themen-IDs bleibt importierbar.

```json
{
  "version": 2,
  "folders": ["Region", "Noch leer"],
  "sources": [
    {
      "name": "Rathausmeldungen",
      "url": "https://example.org/rss",
      "type": "rss",
      "folder": "Region",
      "topic_names": [],
      "enabled": false,
      "rights_confirmed": false
    }
  ]
}
```

### Automatische Themenzuordnung

Beim Import wertet NEWSDECK Titel, Beschreibung und verfügbaren Text aus. Es kann mehrere vorhandene Themen zuordnen oder die Meldung ohne Thema lassen. Quellenthemen können einen vorhandenen Begriffstreffer stützen. Wörtliche Ausschlussbegriffe sperren ein Thema in beiden Verfahren. Inhaltliche Abgrenzungen helfen der optionalen KI bei mehrdeutigen Treffern.

Mit KI folgt für neue und inhaltlich geänderte Meldungen eine eigene Themenprüfung. Sie kann Regeltreffer bestätigen, ersetzen oder verwerfen. Bei Ausfall bleibt die Regelzuordnung nach bis zu drei Versuchen erhalten. Unter **Themenzuordnung** im Meldungsdetail stehen Status, Begründungen und unsichere Vorschläge. **Erneut automatisch zuordnen** hebt eine manuelle Festlegung auf und prüft diese Meldung erneut, unabhängig von ihrer Zusammenfassung.

Beim Start von Webdienst und Worker werden die Datenbankmigrationen angewandt. Der Worker bearbeitet Altbestände und Themenänderungen regelbasiert in Paketen von 25 Meldungen und setzt die Arbeit nach einem Neustart fort. Manuelle Zuordnungen bleiben geschützt. Nach einer Themenänderung werden bereits eingeplante KI-Prüfungen mit dem aktuellen Themenstand ausgeführt. Für bereits abgeschlossene Meldungen kann die KI-Prüfung einzeln im Meldungsdetail angefordert werden.

Vorläufige Treffer und unsichere Vorschläge lösen keine Themenbenachrichtigungen aus. Die Nachverarbeitung des Altbestands erzeugt keine nachträglichen Themenbenachrichtigungen. Während eine Themenprüfung aussteht, erscheint eine briefingfähige Meldung unter **Weitere Meldungen**.

`TOPIC_RULE_THRESHOLD` (Standard `2`) und `TOPIC_AI_THRESHOLD` (Standard `3`) gelten für künftige Prüfungen nach dem Neustart. Die Stufen `1`, `2` und `3` stehen für niedrige, mittlere und hohe Sicherheit. Der synthetische Vergleichsbestand in `tests/topics.test.ts` misst die Regeln getrennt nach Fehlzuordnungen und übersehenen Themen. Bei Standardschwellen enthielten die elf Beispiele eine Fehlzuordnung durch das mehrdeutige Wort „Bank“ und kein übersehenes Thema. Die KI-Tests verwenden simulierte Antworten.

Vorschaubilder älterer RSS- und Webmeldungen lassen sich mit `node --import tsx scripts/backfill-previews.ts` nachtragen. Der Lauf prüft fehlende Bilder an den Originaladressen bestätigter Quellen und ergänzt ausschließlich das Bildfeld. Instagram-Bilder kommen über den jeweiligen Quellenabruf.

## Docker auf einem Linux-Server

Voraussetzung: Docker Engine und Compose v2. Mindestens 2 GB RAM empfohlen. Der Container-Build führt TypeScript-Prüfung, Frontend-Build und Tests aus.

```sh
cp .env.example .env
# .env bearbeiten: ADMIN_EMAIL, zufälliges ADMIN_PASSWORD (mindestens 14 Zeichen),
# POSTGRES_PASSWORD (zufällige Hex-Zeichenfolge), APP_ORIGIN setzen.
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 worker
```

`POSTGRES_PASSWORD` wird in einer Verbindungs-URL verwendet: eine lange zufällige Hex-Zeichenfolge vermeidet problematische Sonderzeichen. Web und Worker verwenden in Compose automatisch PostgreSQL; `DATABASE_URL` in der lokalen `.env` wird dort überschrieben. Der PostgreSQL-Datenträger `newsdeck_postgres_data` überlebt Containerneustarts und Rebuilds. **`docker compose down -v` löscht diesen Datenträger.**

Standardmäßig ist nur `127.0.0.1:3000` veröffentlicht; die Datenbank hat keinen Host-Port. Für Internetzugriff einen HTTPS-Reverse-Proxy auf dem Host verwenden, etwa Caddy:

```caddy
newsdeck.ihre-domain.de {
  reverse_proxy 127.0.0.1:3000
}
```

Dann `APP_ORIGIN=https://newsdeck.ihre-domain.de` und `COOKIE_SECURE=true` setzen und `docker compose up -d` ausführen. `APP_ORIGIN` muss exakt der Browseradresse entsprechen, ohne abschließenden Slash. Unbekannte POST/PUT/DELETE-Ursprünge werden abgewiesen. Der eingebaute IP-Limiter sieht hinter einem Proxy dessen Adresse: bei dieser Konfiguration zusätzlich am Proxy pro Client begrenzen; keine ungeprüften Forwarded-Header vertrauen.

Die ausgelieferte Konfiguration wurde syntaktisch geprüft. Ein Docker-/PostgreSQL-Laufzeittest war in der Entwicklungsumgebung mangels laufender Docker-Engine nicht möglich. Vor einer öffentlichen Freigabe sind dieser Test, TLS-Konfiguration und ein Wiederherstellungstest mit PostgreSQL erforderlich. `docs/ABNAHME.md` nennt den tatsächlich geprüften Stand.

## KI anschließen

NEWSDECK verwendet eine **OpenAI-kompatible Chat-Completions-Schnittstelle**, keinen bestimmten verpflichtenden Anbieter. Eine lokale kompatible API kann ebenfalls verwendet werden. Ein Anbieter muss JSON-Ausgabe über `response_format: { type: 'json_object' }` unterstützen.

```dotenv
AI_BASE_URL=https://ihr-anbieter.example/v1
AI_API_KEY=Ihr-Zugang
AI_MODEL=Ihr-Modell
```

Anschließend Dienste neu starten. Ohne `AI_BASE_URL` und `AI_MODEL` werden keine KI-Anfragen versendet. Bei Einrichtung eines externen Anbieters werden Titel, verfügbarer Quelltext, Themenbeschreibungen und ggf. die vorherige Fassung dorthin übertragen. Der Betreiber muss die Nutzungsrechte und Datenschutzbedingungen dafür prüfen. Bis dahin bleibt alles lokal.

Der Worker verarbeitet pro Zyklus bis zu fünf Analysen. Validierte Ergebnisse werden gespeichert; Ausfälle führen zu exponentiellen Wiederholungen, höchstens einmal täglich pro wiederholt fehlgeschlagenem Artikel. Originale bleiben sichtbar. Quellenmaterial wird als nicht vertrauenswürdiger Inhalt getrennt von der Systemanweisung übergeben. Eine KI-Zusammenfassung ist keine Faktenprüfung.

## Instagram

### Lokaler RSSHub ohne Anmeldung

Die zusätzliche Option **Instagram über lokalen RSSHub (kostenlos)** nimmt eine öffentliche Profiladresse entgegen. Einrichtung und Testergebnisse stehen in [docs/RSSHUB.md](docs/RSSHUB.md). Der Dienst ist lokal installiert und wird von den Windows-Start-/Stoppskripten mitverwaltet. Die tatsächlichen anonymen Instagram-Tests schlugen fehl; ein erfolgreicher Beitragsimport wird nicht behauptet.

### Instagram über RSS (ohne Meta-Zugang)

Unter **Quelle hinzufügen → Quellentyp → Instagram über RSS** gibt es einen eigenen Einrichtungsweg. Öffnen Sie den verlinkten RSS.app-Generator, erstellen Sie dort einen Feed für ein öffentlich zugängliches Instagram-Profil und tragen Sie den erzeugten XML-/RSS-Link in NEWSDECK ein. **Feed prüfen** kontrolliert die RSS-/Atom-Erkennung. Danach Themen, Intervall und Nutzungsbedingungen einstellen und speichern.

Eine Profil- oder Beitragsadresse von instagram.com ist kein Feed und wird für diesen Quellentyp mit einem erklärenden Hinweis abgewiesen. Der Feed kann auch von einem anderen geeigneten Anbieter stammen; NEWSDECK bindet sich nicht an RSS.app. Ein externes Konto und gegebenenfalls ein kostenpflichtiger Tarif werden direkt beim Anbieter eingerichtet. Es werden keine Instagram-Zugangsdaten an NEWSDECK übergeben. Automatisierung, Archivierung und Themenverarbeitung verwenden den vorhandenen RSS-Abrufdienst. Verfügbarkeit und Vollständigkeit hängen vom Feed-Anbieter ab. Der Typ wird beim Export/Import als `instagram_rss` bewahrt und kann in der Nachrichtensuche gefiltert werden.

### Instagram über Meta Business Discovery

Für den ersten Test im [Meta App Dashboard](https://developers.facebook.com/apps/) eine App mit **Instagram API with Facebook Login** einrichten. Das eigene professionelle Instagram-Konto muss mit einer Facebook-Seite verknüpft sein, die der anmeldende Facebook-Nutzer verwalten kann. Im [Graph API Explorer](https://developers.facebook.com/tools/explorer/) die eigene App und eine unterstützte Graph-Version wählen und einen Benutzertoken für den Lesezugriff erzeugen. Für den erfolgreichen Business-Discovery-Test wurden `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` und für die Seitenliste `pages_show_list` verwendet. Je nach App-Modus und Kontorollen kann Meta weitere Freigaben verlangen. Schreibrechte sind für NEWSDECK nicht erforderlich.

Im Explorer mit diesem Token `GET /me/accounts?fields=name,instagram_business_account` ausführen. In der Antwort die Facebook-Seite mit dem verknüpften Instagram-Konto suchen und die `id` innerhalb von `instagram_business_account` kopieren. Die äußere `id` ist die Facebook-Seiten-ID. [Metas Beispiel für die Seitenabfrage](https://www.postman.com/meta/instagram/request/0vuw3vk/get-access-tokens-of-pages-you-manage)

Die drei Werte lokal in `.env` eintragen. Die Konto-ID gehört zum eigenen verknüpften Instagram-Konto. Den Token wie ein Passwort behandeln.

```dotenv
META_GRAPH_VERSION=vXX.X
META_ACCESS_TOKEN=Ihr-Token
META_IG_USER_ID=Ihre-professionelle-Instagram-ID
```

NEWSDECK neu starten. Unter **Quelle hinzufügen → Instagram (Meta API)** die Adresse des öffentlichen Zielprofils eingeben und **Profil testen** wählen. Der Test bestätigt das Profil und zeigt, wie viele Beiträge die erste Ergebnisseite enthält. Bei Erfolg Themen und Abrufintervall festlegen und die Quelle speichern.

`vXX.X` ist ein Platzhalter. Der Connector verarbeitet pro Abruf die erste Ergebnisseite mit bis zu 50 Beiträgen inklusive Text, Datum, Permalink und Medientyp. Weitere Seiten werden beim Test angezeigt und bleiben außerhalb dieses ersten Ausbauschritts. Beliebige öffentliche Privatkonten werden von Business Discovery nicht unterstützt. Bei abgelaufenem Token diesen lokal ersetzen und NEWSDECK neu starten.

Der lokale Profiltest hat über die offizielle Meta-API 50 Beiträge von `@nasa` erhalten. Für Drittanbieter kann das `Connector`-Interface in `server/connectors.ts` implementiert werden. Dabei gelten die Zugriffsvorgaben der jeweiligen Quelle.

## Benachrichtigungen und Briefings

Regeln legen für neue, passende Meldungen der letzten 24 Stunden benutzerspezifische Benachrichtigungen an. Ohne SMTP bleiben sie in der Anwendung verfügbar. Mit `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional `SMTP_USER`/`SMTP_PASSWORD` und `SMTP_FROM` wird an die Konto-E-Mail gesendet. Port 587 erfordert STARTTLS, 465 verwendet direkt TLS. Der SMTP-Dienst muss die Absenderadresse zulassen.

Pro Artikel und Empfänger gibt es einen Benachrichtigungseintrag; Fehler werden bis zu achtmal wiederholt. SMTP garantiert keine Exactly-once-Zustellung: ein Prozessabbruch nach Annahme durch den Mailserver kann zu einer doppelten Zustellung führen. Eine stabile Message-ID erleichtert die Erkennung.

Das Tagesbriefing berücksichtigt Veröffentlichungen ab dem lokalen Tagesbeginn bis zum Beginn des Folgetags. `BRIEFING_TIMEZONE` legt die Zeitzone fest (Standard `Europe/Berlin`). Die Tagesgrenzen folgen der Sommer- und Winterzeit. Ein Veröffentlichungszeitpunkt in der Zukunft wird frühestens beim ersten Worker-Durchlauf ab diesem Zeitpunkt berücksichtigt.

Der Import übernimmt explizite Veröffentlichungsangaben aus RSS, Atom, Artikelseiten und Instagram und speichert gültige Zeitpunkte in UTC. Fehlende, widersprüchliche oder ungültige Angaben und Zeitangaben ohne eindeutigen Offset bleiben fürs Briefing unberücksichtigt. Die Connectoren haben derzeit keine fest definierte Quellenzeitzone für lokale Zeitangaben. Abruf und Bearbeitung beeinflussen die Datumszuordnung nicht. Das Briefing gruppiert bis zu 200 Meldungen nach Themen und kennzeichnet eine gekürzte Auswahl.

Der Worker aktualisiert betroffene Tage bei neuen Meldungen sowie bei Änderungen an Datum, Zusammenfassung und Themen. Verspätete Meldungen werden ihrem Veröffentlichungstag zugeordnet. Eine Datumskorrektur aktualisiert beide betroffenen Tage. Administratoren können einen gespeicherten Tag über **Neu berechnen** gezielt aktualisieren.

**Einmalige Bestandskorrektur.** Migration 004 kopiert die bisherigen Briefings in `briefing_legacy_backup`, bevor Webdienst oder Worker sie nach der neuen Regel aufbauen. Die Originalbeiträge bleiben bei der Korrektur erhalten. Sie löst keine KI-Anfragen aus. Weil frühere Importe auch Datumsangaben ohne Zeitzone akzeptiert haben, können alte Briefings zunächst leer sein. Ein regulärer erneuter Quellenabruf bestätigt verlässliche Veröffentlichungsdaten auch bei unverändertem Artikeltext. Altbeiträge, die in der Quelle nicht mehr abrufbar sind, bleiben im Nachrichtenbestand. Für ein vollständiges Backup vor einem Upgrade siehe den folgenden Abschnitt.

## Backup und Wiederherstellung

**SQLite lokal:**

```sh
node --import tsx server/backup.ts
```

Das erstellt mit der SQLite-Backup-API eine konsistente Sicherung unter `backups/`, auch bei laufender Anwendung. Wiederherstellung: beide Dienste stoppen, vorhandene `data/newsdeck.sqlite` plus ggf. `-wal`/`-shm` in einen separaten Sicherungsordner verschieben, gewünschtes Backup als `data/newsdeck.sqlite` kopieren, Dienste starten. Keine aktive Datenbankdatei einfach kopieren oder überschreiben. `.env` getrennt und vertraulich sichern.

**PostgreSQL / Docker:**

```sh
sh scripts/backup.sh
sh scripts/restore.sh backups/newsdeck-ZEITSTEMPEL.dump --replace-database
```

Die Wiederherstellung ersetzt die aktuellen Daten. Vorher zusätzlich sichern. Das Skript stoppt Web und Worker und verwendet eine Datenbanktransaktion. Bei einem Fehler bleiben die Dienste gestoppt, damit der Betreiber die Ursache prüfen kann. Backups verschlüsselt außerhalb des Servers aufbewahren. Ein regelmäßiger Backup-Job kann das Skript per Cron ausführen.

**JSON-Archivexport** in den Einstellungen enthält Quellen, Ordner und deren Zuordnungen. Für eine vollständige Wiederherstellung einschließlich Benutzern und Sitzungen dient die Datenbanksicherung. SQLite-Sicherungen und PostgreSQL-Dumps enthalten die Ordnertabellen nach der Migration automatisch. Einen älteren PostgreSQL-Dump in eine leere Datenbank einspielen, damit keine Tabellen eines neueren Schemas zurückbleiben.

## Architektur und Betrieb

- React + Vite statt Next.js: geschütztes internes Dashboard ohne SEO/SSR-Bedarf; statische Frontend-Dateien werden vom API-Server ausgeliefert. Keine zusätzliche Frontend-Serverinstanz.
- Express/TypeScript statt Python: gemeinsame Sprache, weniger Laufzeitabhängigkeiten. Eingabeprüfung mit Zod, vorbereitete SQL-Abfragen, Helmet/CSP, Login-Limits, HttpOnly/SameSite-Cookies, Ablauf und Widerruf von Sitzungen.
- PostgreSQL ist die Serverdatenbank; SQLite/WAL der einfache lokale Modus. Schema in versionierten Migrationen unter `migrations/`.
- Persistenter DB-Scheduler statt Redis/Celery: atomare Quellen-Leases, zusätzlicher Scheduler-Lease, Wiederanlauf nach Lease-Ablauf, Fehler-Backoff. Ein aktiver Worker bearbeitet Quellen nacheinander; daher für kleine bis mittlere Quellensammlungen vorgesehen, keine Hochdurchsatz-Crawlerfarm. Getrennte Web-/Worker-Prozesse verhindern Crawling im Request-Pfad.
- RSS/Atom werden vollständig bis maximal 100 Einträge pro Feedabruf verarbeitet. Webseiten unterstützen statische Einzelartikel und einfache `article h2/h3`-Newsroom-Listen (maximal zehn Links). Verknüpfte Feeds werden bevorzugt. JavaScript-only-Seiten benötigen später einen gesonderten Connector.
- Firecrawl/Playwright sind als optionale Erweiterungen geeignet, aber nicht zur Laufzeit nötig. Die Kernversion verwendet HTTP + XML/HTML-Parsing, vermeidet Browser-Ressourcen und externe Crawling-Kosten.
- Öffentliche IP-Ziele, DNS-Pinning pro Anfrage, erneute URL-/robots-Prüfung bei Weiterleitungen, 20-Sekunden-Timeout, 3-MB-Limit, mindestens eine Sekunde Abstand je Host, konservative `crawl-delay`-Beachtung. Keine Logins, Cookies oder Paywall-Umgehung. Manche legitimen Spezialadressen werden bewusst konservativ abgewiesen.
- Bilder werden nicht übernommen, solange keine konkreten Wiederverwendungsrechte hinterlegt sind. Datumsangaben werden nicht aus dem Abrufdatum erfunden; fehlende Publikationsdaten bleiben leer.
- Suchindex: PostgreSQL GIN mit `simple`-Tokenisierung; lokal SQLite-Teilstringsuche. Weitere Indizes unterstützen Datum, Themen, Relevanz, Worker und KI-Warteschlange.
- Clustering ist eine konservative Titelähnlichkeitsheuristik (82 %, letzte drei Tage, maximal 300 Kandidaten). Es ist keine semantische Ereignisidentifikation und keine Verifikation unabhängiger Quellen.
- Änderungen am selben Original-Link erzeugen einen Verlauf mit vorherigem Quelltext; KI kann einen belegten Unterschied beschreiben. Ereignisübergreifende Entwicklungsverfolgung bleibt eine Erweiterung.
- Quellenfehler und KI-Fehler bleiben sichtbar. Abrufprotokolle werden nach 90 Tagen entfernt, Nachrichten nicht automatisch gelöscht. Für große Archive eine Aufbewahrungsstrategie vereinbaren.

Health: `/api/health` prüft die Datenbank; `server/worker-health.ts` prüft den Heartbeat. Compose startet Dienste automatisch neu. Logs unter Windows: `data/web*.log`, `data/worker*.log`; Docker: `docker compose logs`.

## Tests und Entwicklung

```sh
npm test
npm run build
npm audit
```

`npm run dev` startet den Backend-Watcher. Für Frontend-Hot-Reload zusätzlich `npx vite --host 127.0.0.1` starten und `APP_ORIGIN=http://localhost:5173` setzen. Für die normale Nutzung genügt der gebaute Ein-Prozess-Webserver auf Port 3000 plus Worker.

Die Tests benutzen ausschließlich isolierte synthetische Daten und lokale Testserver. Der echte RSS-Test wurde zusätzlich in der eingerichteten Anwendung durchgeführt. Externe KI, Meta und SMTP benötigen echte Betreiberzugänge für abschließende Integrationstests.

## Quellen der technischen Entscheidungen

- [Vite: Production Build](https://vite.dev/guide/build)
- [Node.js: SQLite API](https://nodejs.org/api/sqlite.html)
- [Nodemailer: SMTP, TLS und Timeouts](https://nodemailer.com/smtp)
- [Meta: Instagram API / offizielle Postman-Dokumentation](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Tagesschau: RSS-Feeds und Nutzungsbedingungen](https://www.tagesschau.de/infoservices/rssfeeds)
- [Bundesbank: RSS-Angebot](https://www.bundesbank.de/de/startseite/rss)

Die Beispielquellen werden für neue Installationen deaktiviert ausgeliefert. Ein öffentlicher Feed bedeutet keine allgemeine Veröffentlichungslizenz. Die eingerichtete Tagesschau-Quelle ist ausschließlich für diesen privaten, nicht-kommerziellen Newsreader vorgesehen.

# NEWSDECK: priorisierter Verbesserungsplan für ein kleineres Coding-Modell

Stand: 10.11.2026. **Nur Plan, noch nicht umgesetzt.** Befunde, Prüfstand und Quellen: `CODEQUALITAET-ANALYSE-2026-11-10.md` im selben Verzeichnis. Alle unten genannten relativen Pfade beziehen sich auf `C:/Users/Moritz/Documents/ChatGPT/Newsdeck`.

## Arbeitsauftrag und feste Grenzen

Bearbeite jeweils genau **eine** Task-ID beziehungsweise eine ausdrücklich einzeln aufgeführte Untertask. Lies nur deren Ausgangsdateien, betroffene Tests und die genannten Befunde. Ein Task endet mit einem kleinen überprüften Änderungssatz und einem kurzen Übergabeprotokoll. Das nächste Modell erhält dieses Dokument, die Analyse und das Übergabeprotokoll. Ein neuer Architekturentwurf ist nicht Teil des Auftrags.

**Do not touch, gilt für jeden Task:**

- Produktive `.env`, `data/`, `backups/`, vorhandene Sitzungen, Zugänge, Quelleneinträge und laufende Dienste. Keine echten E-Mails, Meta-/KI-Anfragen, Quellenimporte oder Prozessneustarts als Tests.
- Vorhandene Migrationen 001–005 nicht verändern. Schemaänderungen nur als nächste freie Version, einschließlich Registrierung in `Database.migrate`. Für getrennte Dialekte die vorhandene Anordnung übernehmen.
- Quellenlöschung erhält Artikel; Ordnerlöschung erhält Quellen. Themen können manuell auch leer festgelegt werden. Import darf wie bisher teilweise erfolgreich sein.
- Katalog vor Artikel sperren; eine PostgreSQL-Transaktion verwendet genau ihren Client. Im SQLite-Transaktionscallback ausschließlich `q`, nicht das äußere `db.query` verwenden, sonst droht Selbstblockierung der Queue.
- DNS-Pinning, öffentliche Zielprüfung, Redirectprüfung, robots-Schutz, Antwortlimits, Origin-/Rollenprüfung und lokale No-login-Beschränkungen nicht lockern.
- Datumspräzision und Briefing-Zeitzonenlogik, Inhalts-Hash-/Tokenprüfungen und manuelle redaktionelle Entscheidungen unverändert erhalten, außer ein Task nennt eine explizite fachliche Änderung.
- Keine Secrets/Originalartikel in Testfixtures, Logs, Screenshots, Versionsarchiv oder Browserbundle. Keine neuen `VITE_*`-Secrets.
- Kein `npm audit fix --force`, kein pauschales `npm update`, kein Neuaufbau mit anderem Framework, keine generierten Änderungen unter `node_modules/`.
- Keine visuellen Neugestaltungen bei Dateiaufteilungen. Bestehende Klassen, Labels, Endpunkte, JSON-Exportversion 2 und deutsche Texte erhalten.

Neue Dateinamen sind Vorschläge mit verbindlicher Zuständigkeit. Nach einer vorherigen Extraktion darf der aktuelle Modulpfad verwendet werden; das im Task genannte Symbol bleibt der Suchanker. Niemals Code nur deshalb duplizieren, weil Zeilennummern inzwischen verschoben sind.

## Prüfkürzel und Definition „fertig“

**K:** `npm run check`, gezielter Test und anschließend `npm test`. Nach UI-, Build-, Typkonfigurations- oder Dependencyänderungen zusätzlich `npm run build` in der Entwicklungskopie. Später kommen die in T38/T47 eingerichteten Prüfskripte hinzu. Keine bestandene Vollsuite ohne neue Änderungen erneut laufen lassen.

**DB:** Szenario sowohl in temporärem SQLite als auch in dedizierter PostgreSQL-Testdatenbank prüfen, sobald T13 verfügbar ist. Solange PostgreSQL fehlt, Änderung als „SQLite geprüft, PostgreSQL offen“ kennzeichnen, niemals als serverseitig freigegeben.

**UI:** relevante Playwright-Szenarien aus T20; visuell Desktop 1440×1000 und mobil 390×844 in Hell/Dunkel kontrollieren, wenn DOM/CSS geändert wird. Browser ausschließlich gegen isolierte Testinstanz. Bis T20 steht: manuelle Prüfung gegen dieselbe Testinstanz, fehlende Automatisierung dokumentieren.

**SEC:** synthetische Token-/Passwort-/URL-Geheimnisse in Fehlerpfaden verwenden; Ausgaben dürfen diese Werte nicht enthalten. Negative Autorisierungs-/Origin-Fälle gehören zu jedem geänderten Schreibendpunkt.

Fertig bedeutet: Akzeptanz erfüllt, betroffene Tests bestanden, keine nicht vorgesehenen Dateiveränderungen, keine neuen ignorierten Typfehler, Diff auf unbeabsichtigte Verhaltensänderung geprüft. Alte Tests, die ausdrücklich falsche HTTP-Statuscodes festschreiben, dürfen im zugehörigen Status-Task geändert werden; Assertions nicht allgemein abschwächen. Keine willkürliche Coverage-Prozentzahl als Qualitätsersatz.

## Reihenfolge und Freigabepunkte

| Abschnitt | Reihenfolge | Zweck |
|---|---|---|
| Sicherer Start | T01 → T02 | Reproduzierbare Entwicklung ohne Live-Seiteneffekte |
| Vorrangige Befunde | T03 → T04 → T05; T06 → T07 → T08; T11 → T12 | Lieferkette, Fehlergrenzen, Datenintegrität |
| Servernachweis | T13 → T14 | PostgreSQL vor Freigabe tatsächlich prüfen |
| Konfiguration/UI | T09 → T10; T15 → T16 → T17 → T18 → T19 → T20 | Sichere Konfiguration und verlässliche Requests |
| Hintergrund/Netz | T21 → T22 → T23 → T24 → T25 → T26 → T27 → T28 | Begrenzte Arbeit, Besitzprüfung, Wiederanlauf |
| Typen/Daten | T29 → T30 → T31 → T32 → T33 → T34 | Eindeutige Verträge und weniger DB-Arbeit |
| Kleine Module | T35a–h, T36a–j, T52, T53a–b | Jeweils einzeln, erst nach zugehörigen Tests |
| Qualität/Betrieb | T37 → T38 → T39 → T40 → T41 → T42 → T43 → T44 → T45 → T46 → T47 | Checks, Betrieb und Dokumentation |
| Ergänzende Prüfungen | T49 → gegebenenfalls T50; T51 | Performance messen; Barrierefreiheit absichern |
| Abschluss | T48 zuletzt | Abnahme und Übergabe |

Dies ist eine sichere **serielle Standardreihenfolge mit zwei Ausnahmen**: T11/T12 dürfen direkt nach T06 vorgezogen werden; T13/T14 möglichst früh beginnen. Die jeweilige Abhängigkeitenliste hat Vorrang. Priorität beschreibt Dringlichkeit, nicht geschätzte Größe. P1-Tasks und zugehörige Nachweise sind vor öffentlicher Freigabe erforderlich. Bei T05/T13/T14/T41/T43 ist fehlende Docker-Umgebung ein offener Nachweis, kein Anlass, produktive Dienste zu verwenden.

## A. Ausgangslage, Sicherheitsgrenzen und Datenintegrität

### T01 — Entwicklungskopie und überprüfbare Ausgangsbasis

- **Priorität / Abhängigkeit:** P1 / keine. Befunde F04, F27; fehlendes Git.
- **Dateien:** keine Produktdatei ändern; neue `docs/QUALITAET-FORTSCHRITT.md` in der Entwicklungskopie.
- **Änderung:** sichere Quellkopie ohne `.env`, `data`, `backups`, `logs`, `dist`, `.rsshub`, `.npm-cache`, `node_modules` und ZIP verwenden. Vorhandenes Repository außerhalb dieses Ordners nur dann verwenden, wenn es tatsächlich zu diesem Projekt gehört; sonst lokalen Versionsstand in der Entwicklungskopie anlegen. Keine Veröffentlichung/Remoteanlage. Lockfile beibehalten, `npm ci` dort ausführen.
- **Akzeptanz/Checks:** Node-24-/npm-Version protokolliert; K bestanden, 52 Ausgangstests identifiziert; Ausgangsdateihashes oder lokaler Commit dokumentiert. Kopie enthält keine Zugangsdaten. Aktive Installation läuft unverändert.
- **Risiko / Grenze:** Ein Dateiausschluss ist noch kein Geheimnisscan. Falls bekannte Datenpfade in der Kopie auftauchen, vor Teststart korrigieren. Kein Git-Initialisieren oder pauschales Hinzufügen im Live-Ordner.

### T02 — Testumgebung zentral von Betreiberkonfiguration trennen

- **Priorität / Abhängigkeit:** P1 / T01. F27.
- **Dateien:** neu `tests/helpers/environment.ts`, `scripts/run-tests.mjs`; `package.json`, fünf vorhandene Testdateien.
- **Änderung:** Testlauncher setzt vor sämtlichen Serverimports eine nichtproduktive dotenv-Quelle, leere Integrationszugänge und definierte HOST/PORT/ORIGIN/Timezone-Werte. Jede Testdatei erhält eigenen temporären DB-Pfad; bestehende lokale Mockserver bleiben erlaubt. Gemeinsame Hilfsfunktion ersetzt wiederholte ENV-Initialisierung; keine ENV-Ausgabe. Cleanup im finally/after.
- **Akzeptanz/Checks:** alle 52 Tests mit vorhandener, fehlender und absichtlich anders konfigurierter synthetischer ENV gleich erfolgreich. Kein Zugriff auf Live-DB; kein externer HTTP-/SMTP-Aufruf. K. Testdateien weiterhin pro Prozess isolieren.
- **Risiko / Grenze:** `dotenv` wird beim Import geladen; nachträgliches Setzen reicht nicht. Tests, die config gezielt ändern, müssen ihre eigenen Werte wiederherstellen. Keine Produktionskonfiguration für Tests „passend machen“.

### T03 — RSSHub-Sicherheitsmeldungen einzeln bewerten

- **Priorität / Abhängigkeit:** P1 / T01. F01.
- **Dateien:** lesen `scripts/rsshub-package.json`, `.rsshub/package-lock.json`, `scripts/rsshub-service.mjs`, `compose.rsshub.yaml`; neu `docs/RSSHUB-SICHERHEIT.md`.
- **Änderung:** Audit beider Paketbäume datiert erfassen. Pro direktem Advisory: betroffene Version/Commit, transitive Kette, erreichbare Route, Schutz durch Hülle, verfügbare korrigierte Version und Restunsicherheit festhalten. Insbesondere npm-Prereleasevergleiche nicht mit chronologischer Commitreihenfolge gleichsetzen.
- **Akzeptanz/Checks:** alle 12 Paketmeldungen einer Ursache/Disposition zugeordnet; high-Meldungen nicht ignoriert; Upgradekandidat oder begründete Deaktivierungsoption für neue Installationen benannt. Offizielle Fixcommits/Advisories verlinkt. Noch kein Upgrade.
- **Risiko / Grenze:** Auditmeldung ist kein Exploitbeleg; unerreichbare Route ist kein pauschaler Freibrief. Keine Angriffsversuche gegen echte Dienste und kein automatisches Update auf npm-Vorschlag.

### T04 — RSSHub reproduzierbar und kontrolliert aktualisieren

- **Priorität / Abhängigkeit:** P1 / T02, T03; nur mit geprüftem Kandidaten.
- **Dateien:** `scripts/rsshub-package.json`, neu `scripts/rsshub-package-lock.json`, `Setup-RSSHub.ps1`, `docs/RSSHUB.md`.
- **Änderung:** Kandidat im Manifest pinnen, zugehöriges Lockfile unter versioniertem Pfad ablegen. Setup kopiert beide in isolierte Installation und verwendet `npm ci` mit bewusst beibehaltenen Installationsschutzoptionen. Adaptervertrag `init/request` vorher lokal prüfen. Aktive `.rsshub` nicht überschreiben.
- **Akzeptanz/Checks:** zwei frische Installationen liefern gleichen Dependencybaum; audit beider Bäume; verbleibende Meldungen einzeln begründet. Health, erfolgreicher synthetischer Feed, Providerfehler und robots-Sperre bestehen. K.
- **Risiko / Grenze:** Commit-Prereleases können inkompatible Änderungen enthalten. Wenn kein tragfähiger Kandidat existiert, Task nicht durch Overrides erzwingen; sichere neue Standardinstallation ohne RSSHub und dokumentierten offenen Nachweis vorbereiten, Live-Konfiguration unberührt.

### T05 — Docker-RSSHub auf dieselben Schutzregeln bringen

- **Priorität / Abhängigkeit:** P1 / T04, verfügbare isolierte Docker-Umgebung. F09.
- **Dateien:** `compose.rsshub.yaml`, neu `Dockerfile.rsshub`, `scripts/rsshub-service.mjs`, `docs/RSSHUB.md`.
- **Änderung:** Container mit derselben eigenen Hülle und gepinnter RSSHub-Installation bauen. Internes Listeninterface explizit konfigurierbar machen; Windowsstandard bleibt 127.0.0.1, Container nutzt internes 0.0.0.0 ohne veröffentlichten Port. Health, Routeallowlist, robots-Preflight, kein Login, Einzelflug und Cachegrenzen erhalten. Bewegliches latest entfernen.
- **Akzeptanz/Checks:** Fixture-Provider statt Instagram; gesperrte robots verhindert request-Aufruf, fremde Route 404, Parallelabruf kontrolliert abgewiesen, Health erreichbar. Kein Hostport, keine Cookies. Image enthält Hülle und benötigte Module; Compose-Smoke besteht.
- **Risiko / Grenze:** Ein interner Port allein ersetzt keinen Preflight. Nicht einfach den vollständigen offiziellen RSSHub öffentlich machen. Keine pauschale Freigabe beliebiger `RSSHUB_BASE_URL` aus Quellen.

### T06 — Fehlerantworten sicher und semantisch korrekt machen

- **Priorität / Abhängigkeit:** P1 / T02. F02. [Express 5](https://expressjs.com/en/5x/guide/error-handling/).
- **Dateien:** `server/api.ts` Fehlerhandler; neu `server/errors.ts`, `tests/api-errors.test.ts`.
- **Änderung:** `AppError` mit stabilem Code, erlaubtem Status und öffentlicher Nachricht einführen. Unbekannte Fehler immer generisches 500; nie rohe message ausgeben. Zod bleibt 400, JSON-Syntax 400, Größenlimit 413; Datenbankkonflikte nur über bekannte Fehlercodes zuordnen. Bei headersSent an next weiterreichen. Bekannte bisher absichtlich öffentliche Fachfehler explizit als AppError kennzeichnen.
- **Akzeptanz/Checks:** reproduzierter Health-DB-Fehler liefert 500 ohne synthetischen Interntext. Zod/413/404/FK/Unique und Nicht-Error-Throw getestet. Bestehende verständliche Fachmeldungen bleiben erhalten. K + SEC.
- **Risiko / Grenze:** Nicht alle bisherigen `throw new Error` blind als öffentliche 400 markieren. Keine Express-4-Asyncwrapper einführen. Statusänderungen später in T08 endpointweise vervollständigen.

### T07 — Strukturiertes, bereinigtes Fehlerlogging

- **Priorität / Abhängigkeit:** P1 / T06. F23. [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- **Dateien:** neu `server/logger.ts`; Fehlerhandler in `api.ts`, catch-Pfade `worker.ts`, `jobs.ts`, `processing.ts`, `topic-classification.ts`, `notifications.ts`; neu `tests/logging.test.ts`.
- **Änderung:** schmaler Logger für Zeitpunkt, Level, Ereignis, Request-/Job-ID, sichere Fehlerklasse/Code und Dauer. IDs serverseitig erzeugen. Keine Request-/Responsebodies, Cookie-/Authorizationheader oder vollständigen URLs mit Query loggen. Verbindungsstrings und Tokenmuster zusätzlich maskieren. Bekannte Fehlercodes erhalten; generische Providerfehler zählen.
- **Akzeptanz/Checks:** synthetische Secrets verschwinden aus allen getesteten Logpfaden; Zeilenumbrüche erzeugen keinen zweiten Logeintrag; API-Fehler ist über ID zuordenbar. K + SEC. Keine neue externe Logplattform.
- **Risiko / Grenze:** Ungefilterte Error-Objekte können Secrets in message/cause enthalten. Stack nur intern und nach Bereinigung; Loggerfehler dürfen nicht den eigentlichen Fehler verdecken.

### T08 — Fehlende Ressourcen und Konflikte konsistent behandeln

- **Priorität / Abhängigkeit:** P2 / T06. F02.
- **Dateien:** `api.ts` Themen-/Quellen-/Fakten-/Favoriten-/Ordner-/Regelrouten, `source-folders.ts`; `tests/api-errors.test.ts` und betroffene bestehende Tests.
- **Änderung:** Update/fetch/fact unbekannter Artikel/Quelle/Thema → 404; syntaktisch ungültige Eingabe → 400; Unique- und Leasekonflikt → 409. DELETE explizit als idempotent 200 bei fehlender Ressource definieren oder vorhandenes abweichendes Produktverhalten dokumentieren; dann überall derselben festgelegten Regel folgen. Auth 401/403 nicht verändern. Regeln bleiben nach user_id begrenzt.
- **Akzeptanz/Checks:** endpointbezogene Statusmatrix mit positiven und negativen Fällen; keine Erfolgsmeldung für wirkungsloses Update. Leser darf weder Existenz fremder benutzerspezifischer Objekte abfragen noch sie ändern. K + SEC.
- **Risiko / Grenze:** Alte 400-Assertions nur für konkret geänderten Vertrag anpassen. Keine UUID-Pflicht für alle Legacy-IDs nachrüsten.

### T09 — Konfiguration vor dem Start validieren

- **Priorität / Abhängigkeit:** P2 / T02, T06. F16. [Zod](https://zod.dev/basics).
- **Dateien:** `server/config.ts`, `server/index.ts`, `server/worker.ts`, `.env.example`; neu `tests/config.test.ts`.
- **Änderung:** reine `parseConfig(env)` mit Zod: gültige Ports, HTTP(S)-Origin ohne Pfad/Slash, eindeutige Booleans, IANA-Zeitzone, SQLite/PG-Auswahl, zusammengehörige AI-/Meta-/SMTP-Felder. Fehlermeldungen nennen nur Schlüsselnamen. Externe HTTPS-Konfiguration benötigt Secure-Cookie; lokale kompatible KI darf weiterhin explizit HTTP verwenden. Definierte Standards beibehalten.
- **Akzeptanz/Checks:** leere optionale Integrationen zulässig; halbe Konfiguration und ungültige Zeitzone scheitern früh verständlich. Vollständige lokale und Compose-Beispielkonfigurationen bestehen. No-login-Sicherheitsprüfung bleibt zusätzlich im Appstart. K + SEC.
- **Risiko / Grenze:** Kein `z.coerce.boolean()` für ENV, das den String false als truthy behandelt. Tests dürfen Port 0 für ihren Server nutzen, auch wenn reguläre Deploymentports 1–65535 verlangen.

### T10 — Direkte ENV-Zugriffe auf validierte Konfiguration umstellen

- **Priorität / Abhängigkeit:** P2 / T09.
- **Dateien:** `server/auth.ts`, `api.ts`, `connectors.ts`, `rsshub.ts`, `notifications.ts`, `setup.ts`; zugehörige Tests.
- **Änderung:** Servermodule lesen validierte Konfiguration statt verstreut process.env. Setup-E-Mail vor Schreiben validieren und CR/LF abweisen, um neue ENV-Zeilen zu verhindern. Keine Geheimnisse in Konfigurations-Snapshots. Providerkonfiguration gezielt an testbare Funktionen übergeben, statt globalen Zustand auszuweiten.
- **Akzeptanz/Checks:** ENV-Leser im Server auf config/setup-Eingang beschränkt; Test-Konfigurationswechsel bleiben explizit. `setup` erzeugt kompatible Datei, überschreibt keine vorhandene. K + SEC.
- **Risiko / Grenze:** Kein Frontendimport von server/config. Globale config nicht einfrieren, solange bestehende Tests darauf angewiesen sind; Umstellung schrittweise und mit Tests.

### T11 — Themenhierarchie innerhalb derselben Transaktion prüfen

- **Priorität / Abhängigkeit:** P1 / T06, T02. F03.
- **Dateien:** `server/api.ts` validateTopic sowie POST/PUT topics; `tests/topics.test.ts` oder neu `tests/topic-concurrency.test.ts`.
- **Änderung:** `validateTopic(q,parent,id)` mit Transaktionsquery ausführen, erst **nach** `catalogRevision(q,true)`, vor Insert/Update. Prüfung auf vorhandenes Zielthema und Elternkette ebenfalls unter dieser Sperre. Fehlendes Updateziel gemäß T08 behandeln, falls T08 schon umgesetzt.
- **Akzeptanz/Checks:** zwei konkurrierende Änderungen A→B/B→A können nicht beide committen. Barrieren-/Mehrverbindungstest statt Zufallsschleife; Selbstreferenz, längerer Zyklus, gültige Kette und gelöschter Parent ebenfalls prüfen. K + DB.
- **Risiko / Grenze:** Kein äußeres db.query im SQLite-Transaktionscallback. Bestehende Katalog-/Artikel-Sperrreihenfolge und Revisionsänderung nicht umsortieren. Kein Reparieren historischer Produktivdaten in diesem Task.

### T12 — Quellenlöschung mit Claim atomar koordinieren

- **Priorität / Abhängigkeit:** P1 / T06, T02. F08.
- **Dateien:** DELETE sources in `api.ts`, `claimSource` in `jobs.ts` nur falls nötig; neu `tests/source-concurrency.test.ts`.
- **Änderung:** Leaseprüfung und Löschung in einer Transaktion mit passender Zeilensperre beziehungsweise bedingtem DELETE durchführen. Ergebnis „fehlt“ von „aktiv beansprucht“ unterscheiden. Quellenclaim und Löschung müssen einen definierten Gewinner haben.
- **Akzeptanz/Checks:** Test mit zwei Verbindungen/koordiniertem Interleaving: entweder Claim gewinnt und DELETE meldet Konflikt, oder DELETE gewinnt und Claim liefert nichts. Vorhandene Artikel bleiben mit NULL source_id erhalten. K + DB.
- **Risiko / Grenze:** Nicht den Scheduler stoppen, um Rennen zu verstecken. Ordnerwechsel während laufendem Abruf bleibt wie bisher erlaubt; keine globale Quellensperre einführen.

### T13 — Isoliertes PostgreSQL-Testgerüst einrichten

- **Priorität / Abhängigkeit:** P1 / T02. F04.
- **Dateien:** neu `compose.test.yaml`, `tests/helpers/postgres.ts`, `tests/postgres.test.ts`; `package.json`, `.env.example` nur Dokumentation.
- **Änderung:** PostgreSQL 17 separat mit eindeutigem Projekt-/DB-Namen und Testzugang starten. Launcher verlangt explizite TEST_DATABASE_URL und prüft dedizierten Datenbanknamen; niemals DATABASE_URL aus Betreiber-.env übernehmen. Erste Tests: connect, query, transaction commit/rollback, migrate, close. Exit mit klarer Voraussetzung bei nicht verfügbarem Docker; in CI kein stiller Skip.
- **Akzeptanz/Checks:** Test-DB lässt sich frisch erstellen und nur sie wieder entfernen; produktives Compose-Volume wird nicht referenziert. Paralleler lokaler Betrieb ungestört. Transaktion bleibt bei einem Client. K + isolierter PG-Lauf.
- **Risiko / Grenze:** Kein `docker compose down -v` ohne eindeutig isolierte Testprojektzuordnung. Keine öffentliche DB-Portfreigabe.

### T14 — PostgreSQL-Fach- und Migrationstests ergänzen

- **Priorität / Abhängigkeit:** P1 / T13, T11, T12.
- **Dateien:** `tests/postgres.test.ts`, vorhandene Fachtest-Fixtures; Migrationen nur lesen.
- **Änderung:** PostgreSQL-Tests für Neuinstallation, Upgrade 001/002/004→aktueller Stand, gleichzeitiges migrate, Briefing-Trigger, Tagwechsel/DST, Themenänderung, Ordner/FK, Volltextsuche, Claim, Zyklus- und Löschkonkurrenz. Gemeinsame fachliche Assertions wiederverwenden, keine pauschale Ersetzung aller SQLite-Tests.
- **Akzeptanz/Checks:** dieselben Kerninvarianten bestehen auf beiden DBs. Volltextsuche wird mit bewusst abweichender Token- statt Substringsemantik geprüft. Fehlgeschlagene Migration rollt zurück; Wiederholung ist idempotent. SQL-/Deadlockfehler ungekürzt dokumentieren.
- **Risiko / Grenze:** SQLite-SQL kann keine PG-Triggerverifikation ersetzen. Gefundene PG-Fehler in jeweils eigener Folgetask lösen, nicht alle Migrationen rückwirkend umschreiben.

## B. Frontendverhalten vor dem Zerlegen stabilisieren

### T15 — API-Client mit typisierbaren Fehlern und Abbruchsignal extrahieren

- **Priorität / Abhängigkeit:** P2 / T06, T02. F15.
- **Dateien:** `src/main.tsx:api`; neu `src/lib/api.ts`, `tests/client-api.test.ts`.
- **Änderung:** kleine fetch-Hülle mit optionalem AbortSignal, Status und Fehlercode. Body nur bei `body !== undefined` serialisieren. Leere/HTML-/ungültige JSON-Antwort kontrolliert behandeln; kein ungefilterter Serverbody als Fehlermeldung. Requests mit Cookies auf gleicher Origin beibehalten. Noch keine Querybibliothek einführen.
- **Akzeptanz/Checks:** 200 JSON, 204 leer, 400/401/403/413/429/500, HTML-Fehler, Netzwerkabbruch und Abort getestet; Abort wird nicht als normale Fehlermeldung dargestellt. K + SEC.
- **Risiko / Grenze:** Generisches `api<T>` allein validiert keine Antwort; Runtime-Schemas folgen T29. Keine automatischen Retries für POST/PUT/DELETE.

### T16 — Sitzungsablauf und Login-/Logoutfehler korrekt anzeigen

- **Priorität / Abhängigkeit:** P1 / T15. F15.
- **Dateien:** `src/main.tsx` /me-Effekt, Login, Logout und Benutzerzustand; passende Client-/spätere UI-Tests.
- **Änderung:** initialen 401 von Offline/500 unterscheiden. Bei abgelaufener Sitzung geschützte Zustände und laufende Requests invalidieren, Anmeldung anzeigen. Login samt anschließendem /me im gemeinsamen Fehlerpfad; fehlgeschlagener Logout zeigt Fehler und behauptet keinen serverseitigen Widerruf. No-login-Modus erhalten.
- **Akzeptanz/Checks:** Session läuft während offener Ansicht ab → genau ein kontrollierter Wechsel zur Anmeldung; Serverausfall zeigt Wiederholungsoption statt falscher „abgemeldet“-Annahme. Keine alte Nutzerdatenanzeige nach neuem Login. K + UI.
- **Risiko / Grenze:** 403 ist keine abgelaufene Sitzung. Keine Endlosschleife aus /me-Requests oder neuen Loginversuchen.

### T17 — Artikeldetailantworten an aktuelle Auswahl binden

- **Priorität / Abhängigkeit:** P1 / T15. F05.
- **Dateien:** `src/main.tsx` openArticle, Modal-Schließen, Navigation/Popstate.
- **Änderung:** eigener Detail-Requestzähler und AbortController. Neuer Artikel, Schließen, Navigation und Logout invalidieren vorherigen Request. Nur Antwort des aktuellen Requests darf Detailzustand setzen; Lade-/Fehlerzustand gehört zur aktuellen Auswahl.
- **Akzeptanz/Checks:** A langsam/B schnell → B bleibt; während Request schließen → bleibt geschlossen; alter Fehler überschreibt neueren Erfolg nicht; Refresh des aktuellen Artikels funktioniert. K + UI mit künstlich verzögerten Antworten.
- **Risiko / Grenze:** Nicht auf allgemeinen loadSequence verlassen, da Polling und Details verschiedene Lebenszyklen haben. Keine Änderung an Artikel- oder Themeninhalten.

### T18 — Quellenerkennung darf neuere Eingaben nicht überschreiben

- **Priorität / Abhängigkeit:** P1 / T15. F06.
- **Dateien:** `src/main.tsx` Editor/set/Erkennen-Handler.
- **Änderung:** Formularupdates funktional (`setD(previous => ...)`). Erkennung speichert angefragte URL/Typ und Request-ID; Antwort nur übernehmen, wenn Anfrage noch aktuell ist. Nur erkannte Felder URL/Typ ändern, nie alten Gesamtdatensatz zurückschreiben. Änderung der URL/Typ oder Schließen invalidiert laufenden Test.
- **Akzeptanz/Checks:** während Erkennung Name, Ordner, Priorität ändern → bleiben erhalten; URL wechseln → alte Erkennung verworfen; Instagram-RSS behält seinen Typ; Fehler löscht Eingaben nicht. K + UI.
- **Risiko / Grenze:** Kein automatisches Setzen von rights_confirmed/enabled durch erfolgreichen Abruf. Kein Speichern mit falscher ursprünglicher URL.

### T19 — Polling gegen Überlappung und veraltete Seiten schützen

- **Priorität / Abhängigkeit:** P2 / T15, T16, T17. F15.
- **Dateien:** `src/main.tsx` load/useEffect; optional neu `src/hooks/useRefresh.ts`.
- **Änderung:** nächster Poll erst nach Abschluss des vorherigen, Cleanup bricht ab. Sequenzprüfung vor jedem Statecommit, auch Jobs/Briefings/Settings. Gemeinsame Katalogdaten nicht bei jeder Tastatureingabe neu abrufen: Filterrequest und Metadatenrefresh trennen. Bei verborgenem Tab pausieren, bei Rückkehr einmal aktualisieren.
- **Akzeptanz/Checks:** 20-Sekunden-Request erzeugt keine parallelen 15-Sekunden-Polls; Seitenwechsel übernimmt keine alte Antwort; schnelle Suche zeigt letzte Anfrage; bestehende URL-Ordnernavigation bleibt korrekt. K + UI; Requestanzahl für drei Suchänderungen dokumentieren.
- **Risiko / Grenze:** Keine unbegrenzten Browsercaches oder Mutation-invalidierungsfehler. Aktuelle Ordner-/Quellenfallbacks und Begrenzung auf 30 Artikel erhalten.

### T20 — Kleine Browser-Regressionssuite für reale Nutzungsabläufe

- **Priorität / Abhängigkeit:** P1 vor UI-Aufteilung / T02, T15–T19.
- **Dateien:** neu `playwright.config.ts`, `tests/e2e/newsroom.spec.ts`, `tests/e2e/fixtures.ts`; `package.json`/Lockfile falls passender Test-Runner ergänzt wird.
- **Änderung:** isolierte App mit synthetischen Daten starten. Szenarien: Login/401, Suche/Ordner/Zurück, Favorit, Artikeldetailrennen, Quelle bearbeiten während Erkennung, Leserrechte, Importfehler, Modal-Tastaturbedienung. Version des Test-Runners mit vorhandener Playwright-Bibliothek abstimmen.
- **Akzeptanz/Checks:** Tests nutzen Rollen/Labels und kontrollierte Responses, keine festen Schlafzeiten; keine Drittanbieterrequests. Desktop/mobile und Hell/Dunkel repräsentativ geprüft. Fehlerartefakte enthalten nur Testdaten. K + UI.
- **Risiko / Grenze:** Instagram-Loginprototyp nicht für UI-Tests verwenden; keinen persönlichen Browserkontext laden. Keine Snapshotflut aller Seiten ohne konkrete Aussage.

## C. Netzwerk, Integrationen und Hintergrundverarbeitung

### T21 — Eine gemeinsame Deadline pro öffentlichem Abruf

- **Priorität / Abhängigkeit:** P2 / T02, T07. F17. [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- **Dateien:** `server/network.ts`; neu `tests/network.test.ts`.
- **Änderung:** optionalen Kontext aus AbortSignal/absoluter Deadline durch DNS, robots, Wartezeit und Redirects weiterreichen. Zeitbudget für gesamten Abruf definieren und dokumentieren; einzelne 20-Sekunden-HTTP-Grenze sowie 3-MB-Limit behalten. DNS kann ohne native Cancellation spät enden: verspätete Auflösung darf keinen Socket mehr starten. Ungültige Redirect-URL im Callback als Promise-Rejection behandeln.
- **Akzeptanz/Checks:** langsames DNS, langsame Header/Body, nie endender Stream, Redirectkette, ungültiger Location-Header, Abbruch beim Warten, 3-MB-Überschreitung enden kontrolliert; Ressourcen/Timer schließen. DNS-Pinning und verbotene Redirectziele weiter getestet. K + SEC.
- **Risiko / Grenze:** robots-Redirect und Seitenredirect nicht ungewollt unterschiedlich absichern; keine einfachen Promise.race-Lösungen mit unkontrolliert weiterlaufendem Download.

### T22 — Hostabstände und Netzwerkcache begrenzen

- **Priorität / Abhängigkeit:** P2 / T21. F17.
- **Dateien:** `server/network.ts`, `scripts/backfill-previews.ts` nur Parallelitätsgrenze; `tests/network.test.ts`.
- **Änderung:** je Origin einen reservierten Requestslot/kleine Queue verwenden, sodass gleichzeitige Requests nicht denselben Slot nutzen. Wartende Aufrufe abbrechbar. Cacheeinträge nach Ablauf entfernen und maximale Anzahl festlegen. Backfill gleichzeitig auf eine kleine feste Zahl Hosts begrenzen. Prozessübergreifende globale Limits als verbleibende Grenze dokumentieren.
- **Akzeptanz/Checks:** zwei zeitgleiche Requests desselben Origins beginnen mit Mindestabstand, verschiedene Origins blockieren sich nicht; abgebrochene Wartende hinterlassen keine Blockade; Cachegröße bleibt unter Grenze. K, Fakeclock statt minutenlanger Sleeps.
- **Risiko / Grenze:** Keine neue Quellparallelität im Worker. Nicht auf „global host rate limit“ behaupten, solange Web, Worker und Backfill getrennte Prozesse sind.

### T23 — Netzwerk-/Parsergrenzen mit gezielten Fixtures absichern

- **Priorität / Abhängigkeit:** P2 / T21. F18, F33.
- **Dateien:** `tests/network.test.ts`, neu `tests/connectors.test.ts`, `tests/fixtures/feeds/`; `network.ts`, `connectors.ts` nur bei belegtem Fehler.
- **Änderung:** Fixtures für gemischte öffentliche/private DNS-Antworten, IPv6/IPv4-Mapping, Redirect auf interne Adresse, robots-Gruppen/Allow-Tie/Wildcard/Endanker/Encoding, DTD/ENTITY, tiefe/kaputte XML-Struktur, leere Feeds, falsche JSON-LD-Typen und nicht-UTF-8-HTML. Gefundene Parserfehler einzeln beheben; Encoding aus Bytes unter Erhalt des abgesicherten Downloads behandeln.
- **Akzeptanz/Checks:** bekannte Sperrfälle bleiben gesperrt; gültige RSS/Atom/RDF-Feeds und bestehende Datumstests bestehen. Skips sind nachvollziehbar gezählt. Ungeprüftes `cheerio.fromURL` wird nicht verwendet. K.
- **Risiko / Grenze:** RFC-kompatibel bedeutet nicht automatisch weniger konservativ. Regeln wie strengere 403-Behandlung nicht nebenbei lockern; erst Verhalten dokumentieren. Kein Live-Crawling als Test.

### T24 — KI-/Meta-Antworten begrenzen und validieren

- **Priorität / Abhängigkeit:** P1 vor externem Ausbau / T09, T07. F19.
- **Dateien:** `server/ai.ts`, `connectors.ts:fetchInstagramMeta`; neu `server/response-body.ts`, `tests/provider-responses.test.ts`.
- **Änderung:** gemeinsamen begrenzten Bodyreader für fetch-Antworten einführen; bei Überschreitung Reader canceln. KI-Redirects explizit ablehnen. Antwortumschläge mit Zod aus unknown prüfen, bevor choices/media gelesen werden; Meta-Inhalte auf dieselben fachlichen Textlimits wie RSS beschränken. Gesamtdeadline beibehalten; Providerstatus/Retry-After sicher klassifizieren, keine Rohantwort nach außen.
- **Akzeptanz/Checks:** überschrittene und chunked Bodies, HTML statt JSON, falscher Content-Typ, fehlende choices, abgeschnittenes JSON, 401/429/503, Redirect sowie gültige Antwort getestet. Keine Bearerweitergabe an Redirectziel. K + SEC.
- **Risiko / Grenze:** Lokale OpenAI-kompatible Anbieter bleiben unterstützt; nicht ungefragt auf Responses API/SDK umstellen. Keine echten Modellkosten und keine Meta-Berechtigungsänderungen.

### T25 — Zusammenfassungs-Retries mit Endzustand

- **Priorität / Abhängigkeit:** P2 / T24, T09. F20.
- **Dateien:** `processing.ts:analyze`, `jobs.ts` Analyseselektion, `api.ts` gezielter Admin-Retry; `src/main.tsx` nur Status/Retrybutton; neue Tests.
- **Änderung:** maximale Versuche für Zusammenfassung validiert konfigurieren, vorgeschlagener Standard 3. Vor jedem tatsächlichen Versuch zählen; nach Grenze failed statt ewiges retry. Permanente Konfigurationsfehler von transienten unterscheiden. Expliziter Admin-Retry setzt nur diese Analyse zurück. Relevanz/Fakten-/Originaldaten unverändert lassen; Hash-/updated_at-Prüfung erhalten.
- **Akzeptanz/Checks:** kein vierter automatischer Aufruf; neue Inhaltsfassung darf wieder analysiert werden; alter Response überschreibt keine neue Fassung; manueller Faktenstatus bleibt geschützt. Admin-Retry autorisiert, Reader 403. K + UI + SEC.
- **Risiko / Grenze:** Bewusste Verhaltensänderung dokumentieren. Themen-KI bleibt unabhängig; nicht alle bisherigen failed/retry-Datensätze ohne Nutzeraktion erneut losschicken.

### T26 — Leaseverlust stoppen und Artikelwrites absichern

- **Priorität / Abhängigkeit:** P1 / T12, T13, T21, T07. F07.
- **Dateien:** `worker.ts`, `jobs.ts`, `processing.ts:ingest`; neu `server/leases.ts`, `tests/leases.test.ts`.
- **Änderung in zwei separaten Änderungen:** **T26a:** Verlängerungen mit RETURNING/Zeilenzahl prüfen; bei null Zeilen, abgelaufenem Lease oder nicht rechtzeitig bestätigter Verlängerung lokalen Arbeitskontext abbrechen. Scheduler-Heartbeat nur durch gültigen Besitzer schreiben. **T26b nach T26a:** vor jedem Ingest-Commit Quellen-Token und gültige Lease unter koordinierter Transaktion prüfen; alter Besitzer darf keine Artikel/Quellenstatus-/Erfolgslogs mehr als aktuelle Arbeit speichern. Lease-Kontext explizit übergeben, niemals aus globaler Variable lesen.
- **Akzeptanz/Checks:** zwei Workerinstanzen, kontrollierter Leaseablauf und Übernahme; alter Worker kann weder neuen Claim verlängern noch neuere Ergebnisse überschreiben. DB-Störung beim Renewal stoppt weitere Arbeit spätestens vor ungesichertem Commit. K + DB; Mehrprozessfälle und verzögerte externe Antwort.
- **Risiko / Grenze:** Änderungen an Lockreihenfolge können Deadlocks erzeugen. Erst gemeinsame Sperrreihenfolge dokumentieren, dann umsetzen. Keine absolute Exactly-once-Garantie für externe SMTP/HTTP-Wirkungen behaupten. Für ein kleineres Modell sind T26a und T26b zwingend getrennte Arbeitspakete mit Zwischenreview.

### T27 — Web/Worker kontrolliert und zeitlich begrenzt beenden

- **Priorität / Abhängigkeit:** P2 / T21, T26. F21.
- **Dateien:** `index.ts`, `worker.ts`, `jobs.ts`, Connector-/KI-Calls für Signalweitergabe; `tests/shutdown.test.ts`.
- **Änderung:** Shutdown idempotent, keine neuen Claims, laufenden Kontext abbrechen, Timer stoppen, bestätigte eigene Leases freigeben und DB erst danach schließen. Begrenzte Grace-Period dokumentieren; danach Exit mit klarer Diagnose. Claimfehler in oberste Worker-Fehlerbehandlung aufnehmen; transienten DB-Ausfall mit begrenztem Backoff behandeln.
- **Akzeptanz/Checks:** SIGTERM während Sleep, Abruf und KI endet innerhalb festgelegtem Budget; zweite Signalzustellung verursacht keinen Doppelclose. Keine DB-Zugriffe nach close. Neustart übernimmt korrekt ohne manuelles Löschen fremder Locks. K + DB, subprocess-Tests mit synthetischen langsamen Diensten.
- **Risiko / Grenze:** Ein abgebrochener SMTP-Aufruf kann schon angenommen sein. Windows Stop-Process ist kein garantiertes sanftes SIGTERM; lokalen Rest-Lease-Wiederanlauf weiter dokumentieren.

### T28 — Workerzustand und Fortschritt unterscheiden

- **Priorität / Abhängigkeit:** P2 / T26, T27, T09. F22.
- **Dateien:** `worker.ts`, `jobs.ts`, `worker-health.ts`, `/api/status`, `src/main.tsx`; neue Migration nur falls zusätzliche Felder nötig.
- **Änderung:** gemeinsame Schwellenkonstanten; gültigen Schedulerbesitz und letztes Lebenszeichen anzeigen, zusätzlich letzten abgeschlossenen Zyklus/letzten Fortschritt. Zukunftszeitpunkte/ungültige Datumswerte nicht als gesund werten. Health von bewusst passivem zweitem Worker versus aktivem Scheduler definieren.
- **Akzeptanz/Checks:** frischer/staler/fehlender/zukünftiger Heartbeat, verlorener Lease und lebender aber festhängender Job unterscheiden sich. Keine Geheimnisse in Health. Lange gültige Quellenarbeit nicht allein aufgrund Tickdauer als tot einstufen. K + UI.
- **Risiko / Grenze:** Compose unhealthy startet einen Container nicht automatisch neu. Dokumentation darf das nicht behaupten; keine aggressive Restartschleife konstruieren.

## D. Datenverträge und Datenbankzugriffe

### T29 — Gemeinsame transportfähige Datenverträge einführen

- **Priorität / Abhängigkeit:** P2 / T15, T09. F10. [Zod](https://zod.dev/basics).
- **Dateien:** neu `shared/contracts.ts`, optional `shared/source-contracts.ts`, `tsconfig.json`; `api.ts` und `src/lib/api.ts` zunächst nur Quellen/Ordner.
- **Änderung:** SourceType, Role, SourceFolderDTO, SourceDTO und Eingabeschemas definieren; z.infer für TypeScript. DB-Integerflags/JSON-Strings explizit in DTO-Boolean/Arrays mappen. Shared-Module dürfen nur reine Daten/Schemaabhängigkeiten haben, keine ENV/DB/Node-Seiteneffekte. Versions-2-Export gesondert typisieren.
- **Akzeptanz/Checks:** gleiche JSON-Form wie bisher; Legacyimport bleibt kompatibel; fehlerhafte Response wird kontrolliert gemeldet. Browserbundle enthält keinen Serverimport. K + Quellen-/Ordner-Rundlauftests.
- **Risiko / Grenze:** Nicht gleichzeitig sämtliche API-DTOs ändern. Vorhandene UUID-/Legacy-ID-Unterschiede beibehalten, keine DB-Zeile als DTO casten.

### T30 — DB-Ergebnisse und Abfrageparameter gezielt typisieren

- **Priorität / Abhängigkeit:** P2 / T29, T14. F10, F32.
- **Dateien:** `db.ts`; neu `server/db-types.ts`; `source-folders.ts` und Quellenqueries als erster Verbraucher.
- **Änderung:** zulässigen SQL-Parameteruniontyp und generisches Queryergebnis einführen. Explizite Zeilentypen für Quellen/Ordner; CASTs an einer DB-Grenze bündeln. pg COUNT als String/Number bewusst normalisieren. Dialektkontext nicht über falsches globales db ableiten, wenn ein Test eine andere Database-Instanz verwendet.
- **Akzeptanz/Checks:** bestehende q-Transaktionssignatur bleibt benutzbar; keine neuen any/unknown-as-T-Ketten in Verbrauchern; SQLite und PG liefern dieselben DTOs. K + DB.
- **Risiko / Grenze:** Generischer Typ ist keine Laufzeitvalidierung der SQL-Spalten. Queryfunktion nicht durch ORM ersetzen. Den `?`-Übersetzer zunächst explizit auf bisherigen SQL-Teilbereich beschränken und Stringliteral-/Operatorfall als Regressionstest für spätere Erweiterung festhalten.

### T31 — Artikel-/UI-Zustände statt Row-any typisieren

- **Priorität / Abhängigkeit:** P2 / T29, T30, T20.
- **Dateien:** `shared/contracts.ts`, `src/main.tsx`, Artikellisten-/Detailrouten.
- **Änderung in zwei separaten Änderungen:** **T31a:** ArticleListDTO, ArticleDetailDTO, TopicDTO, StatusDTO, BriefingDTO mit tatsächlichen Nullable-/Statusfeldern und Analyse-JSON definieren; API-Mapping testen. **T31b:** UI-State und Modal als diskriminierte Union typisieren, funktionierende Props übernehmen; Menüpunkte als typisierte Objektliste statt any-Tupel.
- **Akzeptanz/Checks:** `Row=Record<string,any>` verschwindet aus den bearbeiteten UI-Datenpfaden; Detail und Liste können nicht versehentlich vertauscht werden; ungültiges gespeichertes Analyse-JSON führt nicht zum vollständigen UI-Absturz. K + UI.
- **Risiko / Grenze:** Nicht tausende Zeilen gleichzeitig neu strukturieren. Rest-any vorübergehend mit konkretem offenen Modul dokumentieren, nicht durch breite Typeassertions verstecken.

### T32 — Read-only DB-Snapshots gesondert anbieten

- **Priorität / Abhängigkeit:** P2 / T30, T14. F13.
- **Dateien:** `db.ts`, `/api/articles` in `api.ts`; `tests/database.test.ts` neu.
- **Änderung:** `readTransaction` oder expliziten Modus ergänzen. SQLite nutzt für reine Snapshots deferred BEGIN, bestehende Schreibtransaktion weiter BEGIN IMMEDIATE; PostgreSQL repeatable read/read only. Queue-Isolation und Rollback beibehalten. Keine beliebige automatische SQL-Erkennung.
- **Akzeptanz/Checks:** Count und Liste stammen aus konsistentem Snapshot; gleichzeitig schreibender zweiter SQLite-Client wird nicht bereits durch BEGIN IMMEDIATE eines Lesers ausgeschlossen; Schreibtransaktionen bleiben korrekt serialisiert. K + DB.
- **Risiko / Grenze:** In Read-only-Pfad keine versteckten Status-/Seen-Updates. Lang laufende Snapshots können weiterhin WAL/Storage belasten; keine pauschale Blockierungsfreiheit versprechen.

### T33 — Artikelthemen gesammelt und im selben Snapshot laden

- **Priorität / Abhängigkeit:** P2 / T31a, T32. F12.
- **Dateien:** Artikellistenquery in `api.ts`; neu `server/article-queries.ts` falls passend; `tests/article-list.test.ts`.
- **Änderung:** benötigte Listenspalten explizit auswählen, content nicht laden. Themen aller maximal 30 IDs mit einer gebundenen IN-Abfrage innerhalb derselben Lesetransaktion holen und per article_id zuordnen. Sortierung, Filter, Pagination, favorite und cluster_count erhalten.
- **Akzeptanz/Checks:** bei 30 Artikeln höchstens drei fachliche Datenqueries für Count/Liste/Themen, ohne Auth/BEGIN/COMMIT. Leere Liste führt keine ungültige IN()-Abfrage aus. DTOs und total identisch; Themenkonsistenz bei konkurrierender Änderung geprüft. K + DB.
- **Risiko / Grenze:** Kein Join, der Artikel vervielfacht und LIMIT/total verfälscht. Stabilen Tie-breaker a.id beibehalten.

### T34 — Archivexport konsistent und begrenzt ausführen

- **Priorität / Abhängigkeit:** P2 / T32, T06. F24.
- **Dateien:** `/api/export` in `api.ts`; neu `server/archive-export.ts`, `tests/archive-export.test.ts`.
- **Änderung in zwei separaten Änderungen:** **T34a:** bestehenden Exportvertrag in Service mit konsistentem Readsnapshot und expliziten Feldlisten übernehmen; geheimer Datenumfang darf nicht wachsen. **T34b:** Tabellen in kleinen Batches innerhalb dieses Snapshots streamen, Backpressure und Clientabbruch behandeln, maximale Laufzeit festlegen. JSON-Struktur erhalten; kein vollständiges Zwischenobjekt mehr.
- **Akzeptanz/Checks:** Export während synthetischer Änderung ist relational konsistent; großer Fixturebestand bleibt innerhalb vorab festgelegter Speicherschwelle; abgebrochener Download schließt Cursor/Transaktion. Fehler nach headersSent beendet Stream statt zweiter JSON-Antwort. K + DB + SEC.
- **Risiko / Grenze:** Streamingfehler können eine unvollständige Datei erzeugen; Client muss sie als Fehler erkennen können, Dokumentation nennt Downloadvalidierung. Export bleibt **kein** vollständiger DB-Backupersatz. Browser-/Proxytimeout nicht durch unendliche Transaktion umgehen.

## E. Mechanische Aufteilung ohne gleichzeitige Funktionsänderung

### T35a–h — Express schrittweise in fachliche Router zerlegen

**Gemeinsame Vorgabe:** P2, nach T06–T14 und den jeweils betroffenen Datenvertragsaufgaben. In **jedem** Untertask höchstens einen Router extrahieren. `makeApp` und bisherige Exporte für bestehende Tests erhalten. Middleware-Reihenfolge schriftlich festhalten: lokaler Zugriffsschutz → Sicherheitsheader/JSON/Cookies → Health → Limits/Origin → Login → Auth → Fachrouter → API-404 → statische Dateien/SPA → Errorhandler. Keine Middleware versehentlich hinter statische Dateien verschieben.

| Einzelner Task | Ausgang → Ziel | Konkrete Abnahme / Tests |
|---|---|---|
| **T35a** Authrouter | `api.ts` login/me/logout/seen/admin → `server/routes/auth.ts`, `server/middleware/auth.ts` | Login öffentlich, me geschützt, reader/admin/no-login identisch; core.test + SEC. |
| **T35b** Quellenordner | `api.ts` source-folders + sources/move → `server/routes/source-folders.ts` | atomare Bulkverschiebung, reservierte Namen, aktive Lease und reader-Matrix identisch; source-folders.test. |
| **T35c** Quellen | `api.ts` saveSource/CRUD/detect/import/export/Meta-/RSSHubtest → `server/routes/sources.ts`, `server/services/sources.ts` | vorhandene Import-Teilerfolge und Versions-2-Rundlauf unverändert; core/source-folders/API-Fehler-Tests. Ein Service enthält genau bisherige saveSource-Logik. |
| **T35d** Themen | Themenrouten + atomare Hierarchieprüfung → `server/routes/topics.ts` | T11-Zykluskonkurrenz bleibt verhindert; Katalogrevision/Farbänderung verhalten sich unverändert; topics/concurrency-Tests. |
| **T35e** Artikel | Liste/Detail/Bild/Favorit/Fakt/Themen-Override → `server/routes/articles.ts` | DTOs, Limits, Bildallowlist, manuelle Themen und Readerrechte identisch; core/topics/article-list + SEC. |
| **T35f** Briefings | Briefingliste/rebuild → `server/routes/briefings.ts` | Zeitzonen und Admin-rebuild unverändert; briefings.test und Reader-403. |
| **T35g** Einstellungen | rules/notifications/users/archive → `server/routes/settings.ts` | Benutzerbindung, keine Passworthashes im Response, Exportvertrag unverändert; core/archive/SEC. |
| **T35h** Status/Betrieb | health/status/jobs → `server/routes/status.ts`; api.ts auf Montage reduzieren | Health bleibt öffentlich und prüft DB, jobs bleibt admin, status bleibt angemeldet; Health-/Fehler-/Lease-Tests. |

**Checks je Untertask:** K, fachlich passende DB-/API-Tests; Route-/Middlewareliste vorher/nachher vergleichen. **Risiko:** Express-Routenreihenfolge, z. B. sources/export vor sources/:id, muss erhalten bleiben. Konstruktorinjektion nur für wirklich benötigte DB/config-Abhängigkeiten; kein universeller Servicecontainer. Einzelne Untertasks dürfen mehrere Tage dauern, aber niemals alle acht Router in einem Änderungssatz verschieben.

### T36a–j — React Ansicht für Ansicht extrahieren

**Gemeinsame Vorgabe:** P2, nach T20, T29, T31 und den jeweiligen Fehlerkorrekturen. Jede Zeile der Tabelle ist ein eigener Task. Ausgang `src/main.tsx`. Bestehende Stateownership zunächst beibehalten und typisierte Props durchreichen; keine neue globale Statebibliothek. CSS-Klassen, Texte und DOM-Reihenfolge bei mechanischer Extraktion unverändert. Neue Props müssen aus DTOs/Unions stammen, kein Row-any.

| Einzelner Task | Neues Ziel / Umfang | Akzeptanz / Tests |
|---|---|---|
| **T36a** Gemeinsame Bausteine | `src/components/Modal.tsx`, `PageTitle.tsx`, `ArticleImage.tsx`, `FolderOptions.tsx` | reine Extraktion; Dialogöffnen/-schließen und Bildfehler unverändert; UI. Barrierefreiheitskorrektur getrennt in T51. |
| **T36b** Anmeldung | `src/features/auth/LoginView.tsx` | T16-Abläufe und deutsche Fehlermeldungen unverändert; Login/Session-UI. |
| **T36c** Artikelkarte | `src/features/articles/ArticleCard.tsx` | Favorit, Themenbadge, Detail, Prioritätskennzeichnung erhalten; UI. |
| **T36d** Artikeldetail | `src/features/articles/ArticleDetail.tsx`, `ArticleTopics.tsx` | Detailrennen, manuell leere Themen, Retry und Faktenformular erhalten; UI + topics.test. |
| **T36e** Quellenformular | `src/features/sources/SourceEditor.tsx` | T18-Konflikttests, Instagram-RSS-Typerhalt, Ordnerdefault und Rechtecheckbox identisch; UI. |
| **T36f** Quellenansicht | `src/features/sources/SourcesView.tsx` | Ordner, Bulk-Auswahl, Import/Export, aktive Leases und sichtbare Auswahl identisch; UI. |
| **T36g** Themenansicht/-formular | `src/features/topics/TopicsView.tsx`, `TopicEditor.tsx` | Hierarchie und Keyword-/Exclusion-Bearbeitung unverändert; UI + topics.test. |
| **T36h** Briefings | `src/features/briefings/BriefingsView.tsx` | Tageslabels, truncated-Hinweis, globale Gruppierung und rebuild erhalten; UI + briefings.test. |
| **T36i** Einstellungen | `src/features/settings/SettingsView.tsx`, `UserEditor.tsx` | Leser sieht keine Adminaktionen; Regeln, Hinweise und Export erreichbar; UI. |
| **T36j** App-Hülle | `src/App.tsx`, `src/features/system/JobsView.tsx`, `src/lib/navigation.ts`, `src/hooks/useNewsroom.ts` | main.tsx nur Root/CSS/App; Navigation und Polling aus T19 beibehalten; vollständige UI-Suite und Build. |

**Checks je Untertask:** K + relevante UI, Sichtprüfung bei geänderten DOM-Grenzen. **Risiko:** Inlinecallbacks, Modalzustand und Closure-Verhalten können sich ändern; nicht gleichzeitig neue useEffect-Abhängigkeiten oder Memoisierung einführen. Bei einem Untertask über ca. 300 veränderten fachlichen Zeilen zuerst nur den darstellenden Teil abspalten; die restliche Zustandsverschiebung als gesonderte Fortsetzung protokollieren. Keine künstliche Zeilenobergrenze als Grund für Mikrokomponenten.

## F. Qualitätswerkzeuge und Betrieb

### T37 — Passwortprüfung asynchron, ohne Hashmigration

- **Priorität / Abhängigkeit:** P2 / T02, T06; vor öffentlichem Mehrnutzerbetrieb. F14. [Node Eventloop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop).
- **Dateien:** `server/auth.ts`, Login-/Benutzerroute, `bootstrap`; Passworttests.
- **Änderung:** scrypt über asynchrone API promisifizieren, alle Aufrufer korrekt awaiten. Einen Dummyhash einmal vorbereiten, unbekannte Konten mit gleichem Verifikationspfad prüfen. Bestehendes salt:key-Format und KDF-Parameter zunächst erhalten; beschädigte Hashes sicher ablehnen. Requestlimits bleiben.
- **Akzeptanz/Checks:** alte Hashes funktionieren; falsches Passwort/beschädigter Hash werden abgelehnt; unbekanntes Konto erzeugt nicht je Request einen neuen Hash. Synthetischer paralleler Healthrequest wird nicht durch synchrones scrypt blockiert. K + SEC.
- **Risiko / Grenze:** Async allein schützt den Workerpool nicht vor Überlast; vorhandene Limits nicht erhöhen. Keine neue Hashversion, Argon2-Migration oder Änderung an gespeicherten Nutzerpasswörtern in diesem Task.

### T38 — Lintregeln mit nachvollziehbarem Einstieg

- **Priorität / Abhängigkeit:** P2 / T29–T31, T35/T36 soweit umgesetzt. F11.
- **Dateien:** neu `eslint.config.mjs`; `package.json`, Lockfile; neue/ausgelagerte TS/TSX-Module.
- **Änderung:** mit Node24/TS5.9 kompatible ESLint-/typescript-eslint-/React-Hooks-Versionen recherchieren und exakt festlegen. Flat Config, korrekte Dateiumgebungen, typgestützte Regeln gegen schwebende Promises/unsichere Datenzugriffe und Hooks-Regeln. `npm run lint` zunächst mit klar benannter Legacy-Ausnahmeliste, neue Module ohne Ausnahmen.
- **Akzeptanz/Checks:** absichtlicher Floating-Promise- und Hooks-Testfehler wird erkannt; Builddateien, data und Fremdpakete ausgeschlossen. Keine globale Abschaltung von no-explicit-any/no-unsafe-* als scheinbarer Erfolg. K + lint.
- **Risiko / Grenze:** Eventhandler dürfen Promise liefern, müssen Fehler aber selbst kontrolliert behandeln. Kein unkontrolliertes Auto-fix über das ganze Projekt; Restverstöße in Folgetasks je Modul abbauen.

### T39 — Typprüfung nach Laufzeitkontext trennen und verschärfen

- **Priorität / Abhängigkeit:** P2 / T30, T31, T38. F11.
- **Dateien:** `tsconfig.json`, neu `tsconfig.server.json`, `tsconfig.client.json`, `tsconfig.scripts.json`; `package.json`; betroffene kleine Module.
- **Änderung in zwei separaten Änderungen:** **T39a:** Browser-/Server-/Script-Includes trennen; scripts/*.ts in regulären Check aufnehmen, MJS über checkJs/JSDoc oder passende Deklaration schrittweise erfassen. **T39b:** noUncheckedIndexedAccess aktivieren und echte Fehlfälle pro Modul behandeln; exactOptionalPropertyTypes gesondert erst nach sauberer Optionalmodellierung evaluieren.
- **Akzeptanz/Checks:** Browsercode kann keinen Node-Globalzugriff unbemerkt verwenden; alle TS-Einstiegsskripte geprüft; kein @ts-ignore zur Flucht. `npm run check` prüft alle Kontexte und K bleibt grün.
- **Risiko / Grenze:** NodeNext/.js-Imports und tsx-Laufzeit nicht pauschal auf Bundler-Auflösung umstellen. MJS mit externem RSSHubimport braucht eigene Typgrenze, keinen Import aus ignoriertem node_modules in Clientprojekt.

### T40 — Einheitliche Formatierung als separater Änderungssatz

- **Priorität / Abhängigkeit:** P2 / größere unmittelbar laufende Extraktionen abgeschlossen. F11.
- **Dateien:** neu `.prettierrc.json`, `.prettierignore`; `package.json`; ausdrücklich versionierte eigene Quell-/Test-/Konfigurationsdateien.
- **Änderung:** bestehende Prettier-Version verwenden, `format:check` und `format` definieren. Zunächst Checkumfang festlegen, dann einmal reine Formatierung. SQL/Markdown nur aufnehmen, wenn dafür bewusst passende Formatierungsregeln gelten.
- **Akzeptanz/Checks:** Formatcheck ohne Warnungen im vereinbarten Umfang; fachlicher Diff leer, K bestanden. Die 24 Ausgangswarnungen nicht mit pauschalem Ignore verstecken.
- **Risiko / Grenze:** Kein `prettier --write .` ohne Ignoredatei. Keine Produktivdaten, Backups, Screenshots oder Lockfiles anderer Installationen formatieren.

### T41 — Produktionsimage verkleinern und reproduzierbar prüfen

- **Priorität / Abhängigkeit:** P2 / T14, T38, T39; isoliertes Docker. F25.
- **Dateien:** `Dockerfile`, `package.json`, `package-lock.json`, `compose.yaml`.
- **Änderung:** minimalen Ansatz wählen: benötigten tsx-Loader als Runtimeabhängigkeit führen und final nur Produktionsabhängigkeiten plus vorhandene Server-/Migrations-/dist-Dateien installieren/kopieren. Frontend-/Testwerkzeuge bleiben Buildstage. Node24-/Postgres17-Images auf überprüfte Version/Digest pinnen und Updateprozess dokumentieren. Buildstage führt Checks aus.
- **Akzeptanz/Checks:** frischer Imagebuild; Web und Worker starten mit read_only/non-root/cap_drop; Migration und Health bestehen. Finales Image enthält kein Playwright/Vite/TypeScript nur zu Buildzwecken, alle Laufzeitimporte vorhanden. Audit und Größenvergleich dokumentiert.
- **Risiko / Grenze:** Nicht einfach npm prune --omit=dev ausführen, solange tsx dev-only ist. Keine Backend-Kompilierung zusätzlich in demselben Task. Compose-Passwörter nicht über config-Ausgabe in Logs schreiben.

### T42 — Windowsstart auf aktuellen Build und echte Bereitschaft prüfen

- **Priorität / Abhängigkeit:** P2 / T09, T27. F26.
- **Dateien:** `Start-Newsdeck.ps1`, `Stop-Newsdeck.ps1`; optional neuer `scripts/build-manifest.mjs`.
- **Änderung:** Start vorläufig mit eindeutigem Quell-/Lock-/Konfigurationsfingerabdruck gegen Buildmanifest vergleichen; fehlender oder veralteter Build löst kontrollierten Build aus. Setup-Exitcode prüfen. Nach Prozessstart zeitlich begrenzt auf Health warten und Fehler melden. PID-Datei allein reicht nicht: exakten Node-Pfad/Entrypoint/Arbeitsordner prüfen.
- **Akzeptanz/Checks:** frische Installation, unveränderter Neustart, geänderte UI-Datei, kaputte PID-Datei, fremder Prozess unter alter PID, fehlgeschlagener Build und Portkonflikt getestet. Keine fremden Prozesse beendet. Testverzeichnis statt Live-Ordner; Shellsyntaxprüfung plus kontrollierter Lauf.
- **Risiko / Grenze:** Benutzerprozesse bleiben versteckt; kein pauschales Stoppen aller Node-Prozesse. Force-Stop wird nicht als graceful bezeichnet; Rest-Lease bleibt sicher.

### T43 — Backups erst nach Erfolg veröffentlichen und Restore beweisen

- **Priorität / Abhängigkeit:** P1 vor Serverfreigabe / T14. F30.
- **Dateien:** `server/backup.ts`, `scripts/backup.sh`, `scripts/restore.sh`; neu `tests/backup.test.ts`, Betriebsdokumentation.
- **Änderung in zwei separaten Änderungen:** **T43a:** Backup in eindeutige temporäre Datei schreiben, bei Erfolg prüfen und atomar auf endgültigen Namen verschieben; Fehler bereinigt nur eigene temporäre Datei. **T43b:** isolierten Restoretest in leere SQLite-/PG-Testdatenbank automatisieren; Produktionsrestore erklärt/prüft Ziel und Schema-Voraussetzung. Fehlender/kaputter Dump darf Dienste nicht unnötig stoppen. Alte Dumps mit neueren Restobjekten ausdrücklich ablehnen oder leeres Ziel verlangen.
- **Akzeptanz/Checks:** SQLite integrity_check/foreign_key_check; PG Restore samt Migration, Tabellen-/Zeilen-/Fachinvarianten und Login mit synthetischem Konto. Unterbrochener Dump hat keinen scheinbar gültigen finalen Dateinamen. Kein Restore gegen Produktivziel.
- **Risiko / Grenze:** Backups enthalten sensible Daten. Kein Umbau des Wiederherstellungsziels ohne explizite Zielprüfung; --replace-database allein ersetzt kein nachgewiesenes Backup. „Dump nicht leer“ ist keine Integritätsprüfung.

### T44 — SMTP-Lebenszyklus und endgültigen Fehlerzustand testen

- **Priorität / Abhängigkeit:** P2 / T09, T07, T26. F20, F27. [Nodemailer](https://nodemailer.com/smtp).
- **Dateien:** `notifications.ts`, Notification-DTO/UI; neu `tests/notifications.test.ts`; neue Migration nur falls nötig.
- **Änderung:** Transportfactory injizierbar, close garantiert in finally. Nach acht Versuchen failed statt unsichtbar pending. Retry-After/Backoff für passende Fehler, permanente Auth-/Empfängerprobleme sicher kennzeichnen; stabile Message-ID behalten. Admin/Benutzer-Wiederholung nur als gesondert definierte Aktion, kein automatisches Reset aller Meldungen.
- **Akzeptanz/Checks:** synthetischer Transport für Erfolg, Timeout, 4xx/5xx, DB-Fehler nach send und erneuten Lauf; kein echter Versand. Doppelte DB-Benachrichtigung verhindert. Mögliche doppelte SMTP-Zustellung nach Annahme/Crash dokumentiert. K + SEC.
- **Risiko / Grenze:** Keine Exactly-once-Zusage und keine Deaktivierung von requireTLS/Zertifikatsprüfung. Benutzer dürfen nur eigene Benachrichtigungen sehen.

### T45 — Betriebs- und Einmalskripte klar voneinander trennen

- **Priorität / Abhängigkeit:** P2 / T02, T09, T39. F31.
- **Dateien:** `scripts/import-requested-sources.mjs`, `check-requested-sources.ts`, `verify-live.ts`, `backfill-previews.ts`, `instagram-preflight.ts`; Dokumentation.
- **Änderung:** datierte Import-/Prüfskripte in klar bezeichnetes Archiv verschieben oder Start explizit mit Testziel/Dry-run/Schreibflag absichern. Erfolgreicher Abruf darf nicht automatisch Rechte bestätigen. verify-live nach Neustart prüft Erhalt bekannter IDs/Invarianten statt exakter Gesamtzahl bei aktivem Worker. Backfill mit Batchgröße, Fortschritt und Resume; Secrets nie ausgeben.
- **Akzeptanz/Checks:** Dry-run verändert nichts, falsches Ziel wird abgewiesen, wiederholter Import erzeugt keine Duplikate; neue Meldungen während Neustartprüfung sind kein Fehlalarm. K und Script-Checks; keine echten Skripte gegen localhost:3000 starten.
- **Risiko / Grenze:** Historische Prüfergebnisse nicht rückwirkend „korrigieren“. Instagram-Sitzungsprototyp bleibt eigenständig und wird nicht an RSSHub angeschlossen.

### T46 — Dokumentation auf den tatsächlich geprüften Stand bringen

- **Priorität / Abhängigkeit:** P2 / umgesetzte Verhaltenstasks. F29.
- **Dateien:** `README.md`, `docs/ARCHITEKTUR.md`, `docs/ABNAHME.md`, `docs/RSSHUB.md`, `.env.example`; datierte Instagram-/Quellendokumente nur mit ergänzendem Statusverweis.
- **Änderung:** aktuelle Architektur/Tabellen/Module, Startwege, geprüfte Testanzahl, image_url/Bildproxy-Verhalten, Testbefehle, Konfigurationsschlüssel, JSON-Exportgrenze, Retry-/Lease-/Shutdownverhalten und aktuelle PG-/Restore-Nachweise dokumentieren. Historische Protokolle als historisch kennzeichnen statt Ergebnisse umzuschreiben. Proxy-/TLS-Konfiguration und Login-freier Lokalmodus getrennt beschreiben.
- **Akzeptanz/Checks:** jeder dokumentierte Befehl existiert, Scriptnamen/Ports/ENV stimmen; keine behauptete erfolgreiche Meta-/SMTP-/Dockerprüfung ohne datierten Beleg. Entwicklung mit Vite dokumentiert nötigen APP_ORIGIN und Konflikt mit lokalem No-login-Modus. Link-/Schlüsselkonsistenzcheck.
- **Risiko / Grenze:** Keine rechtlichen Nutzungsrechte aus technischer Abrufbarkeit ableiten. Klartextzugänge werden nie in Dokumente übernommen.

### T47 — Wiederholbare Qualitätsprüfung automatisieren

- **Priorität / Abhängigkeit:** P2 / T02, T14, T20, T38–T41, T43.
- **Dateien:** `package.json`; bei bestätigtem GitHub-Hosting neu `.github/workflows/quality.yml`, sonst providerneutraler lokaler Prüflauncher; Dependencyupdate-Konfiguration nur für tatsächlich verwendeten Hoster.
- **Änderung:** Checks für Install aus Lock, Typen, Lint, Format, Unit/API, PostgreSQL, Browser und Build. Linux prüft Docker/PG; Windows prüft DPAPI-/PowerShell-Helfer. Audit für Haupt- und RSSHub-Baum getrennt mit dokumentierten Ausnahmen aus T03. Artifacts nur synthetisch; Secretschutz und minimale CI-Berechtigungen. Kein Remote/Repository allein für CI anlegen.
- **Akzeptanz/Checks:** gebrochener Typ/Test/Build macht Job rot, erwartete Plattformskips sind sichtbar. PG-Job darf DB-Tests nicht lautlos überspringen. Neuer hoher Auditfund erfordert Bewertung; begründete Alt-Ausnahme hat Verantwortlichkeit und Überprüfdatum. Frischer Lauf reproduzierbar.
- **Risiko / Grenze:** Keine Providerzugänge im Build. Browserinstallationen gehören in Tests, nicht Produktionsimage. Zeitbasierte Benchmarks nicht als instabile harte CI-Grenze verwenden.

### T49 — Performance mit synthetischem Archiv messen

- **Priorität / Abhängigkeit:** P2 / T14, T19, T33, T34; vor jeder spekulativen Optimierung. F24, F34.
- **Dateien:** neu `scripts/benchmark.ts`, `tests/fixtures/archive.ts`, `docs/PERFORMANCE.md`.
- **Änderung:** reproduzierbare synthetische Bestände z. B. 1.000/10.000/100.000 Artikel, dokumentierte Themen-/Quellen-/Revisionsverteilung. Feed mit Filtern, Suche, tiefe Seite, Detail, Status, Briefingänderung und Export messen. Queries, p50/p95, Eventloopverzögerung, Peak-RSS und DB-Pläne für beide DBs erfassen. Hardware/Versionen angeben.
- **Akzeptanz/Checks:** Vorher-/Nachhermessung für T33/T34 oder erhaltenen Baseline-Stand; kein Live-Datenzugriff, keine externen Calls. Konkrete Engpässe mit EXPLAIN beziehungsweise EXPLAIN QUERY PLAN belegt. Bundlegröße gegen 249,04/77,26 kB Ausgangswert vergleichen.
- **Risiko / Grenze:** Keine allgemein garantierten Antwortzeiten aus lokalem Benchmark ableiten. Messung selbst darf keine produktive DB erzeugen oder migrieren.

### T50 — Nur gemessene Archivengpässe beheben

- **Priorität / Abhängigkeit:** P3 / T49; nur bei dokumentiertem Engpass.
- **Dateien:** die konkret gemessene Query, nächste freie Migration, passende Querytests. Kandidaten: `article-queries`, `briefings.ts`, Notificationqueries, Detail-Revisionsabfrage.
- **Änderung:** **pro Engpass eine Untertask** mit Ausgangsplan und Ziel festlegen: passender zusammengesetzter/Expression-Index; unnötige COUNTs reduzieren; Revisionen/Briefingdetails paginieren. Keysetpagination oder SQLite-FTS nur als eigenständige Vertrags-/Migrationstask, wenn Messung Nutzen belegt. Bestehende API nicht stillschweigend kürzen.
- **Akzeptanz/Checks:** funktional gleiche Filter/Sortierung bzw. explizit getesteter neuer Pagingvertrag, messbarer Gewinn gegenüber T49 und keine relevante Schreib-/Speicherregression. K + DB + UI bei Vertragserweiterung.
- **Risiko / Grenze:** Kein blindes Indexsetzen für jede WHERE-Spalte. Keine Redisqueue, DB-Workerthreads oder parallelisierten Ingests nur aufgrund synchroner API ohne gemessene Notwendigkeit.

### T51 — Tastaturbedienung und Fokusfehler separat beheben

- **Priorität / Abhängigkeit:** P2 / T20, T36a, T36f, T36j. F28. [W3C Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- **Dateien:** `src/components/Modal.tsx`, Quellenimport-Button, mobile Navigation, `src/style.css`, Browsertests.
- **Änderung:** Modal über eigenen Ref auf sichtbare/fokussierbare Elemente begrenzen, Hintergrund während offenem Dialog inert; eindeutige Titel-ID, Escape und Fokus-Rückgabe erhalten. Import mit echtem fokussierbaren Button, der Fileinput öffnet. Geschlossene mobile Navigation nicht tabbable, Menütaste aria-expanded/controls. Relevante Text-/Fokuskontraste messen, nur belegte Unterschreitungen korrigieren.
- **Akzeptanz/Checks:** kompletter Dialog nur mit Tastatur, Tab/Shift-Tab umschließen korrekt, Escape/Fokusrückgabe; Import per Enter/Space; keine unsichtbaren Sidebar-Fokusziele. Mobile/Hell/Dunkel visuell und mit automatischer Accessibilityprüfung testen. K + UI.
- **Risiko / Grenze:** Kein gleichzeitiger Designwechsel. Background-inert darf den Dialog nicht selbst sperren; hidden/disabled Elemente und leere Dialoge testen.

### T48 — Abschließende Abnahme und eindeutige Übergabe

- **Priorität / Abhängigkeit:** P1 Freigabepunkt / alle P1 und alle zur Umsetzung ausgewählten P2-Tasks; T50 darf begründet entfallen.
- **Dateien:** `docs/ABNAHME.md`, `docs/QUALITAET-FORTSCHRITT.md`; nur Nachweise ergänzen.
- **Änderung:** aus frischer Entwicklungskopie komplette Prüfstrecke ausführen. Ergebnis je Plattform/DB/Integration unterscheiden. Offene Befunde und zurückgestellte Tasks mit Grund dokumentieren. Nur geprüfte Änderungen als fertig markieren; keinen produktiven Deploy/Restart automatisch auslösen.
- **Akzeptanz/Checks:** Typ/Lint/Format/Unit/API/Build grün; PG-Migration und konkurrierende Themen-/Quellenoperationen geprüft; Browserrennen ausgeschlossen; Audit beider Bäume bewertet; Backuprestore belegt; keine Geheimnisse in Artefakten. Neue Taskzahl/Testzahl nicht aus dem Plan schätzen, sondern aus tatsächlichem Lauf übernehmen.
- **Risiko / Grenze:** Ohne Docker/PG/Restore-Nachweis keine Behauptung „Server produktionsbereit“. Ohne echten SMTP-/Meta-/KI-Lauf nur simulierte Integration als geprüft bezeichnen.

### T52 — Feedparser aus dem zyklischen Connectorimport lösen

- **Priorität / Abhängigkeit:** P2 / T23, T29. F33.
- **Dateien:** `server/connectors.ts`, `server/rsshub.ts`; neu `server/feed-parser.ts`, `server/article-item.ts`; Connector-/Feedtests.
- **Änderung:** Item-Typ und reine Feedfunktionen aus connectors herausziehen. RSSHub importiert parseFeed aus reinem Parsermodul; Connectorregistry darf weiterhin RSSHub importieren, aber nicht umgekehrt. Bestehende Parserexports vorübergehend re-exportieren, damit Tests/Verbraucher einzeln umziehen können.
- **Akzeptanz/Checks:** Importgraph hat keinen connectors↔rsshub-Zyklus mehr; parseFeed benötigt weder DB noch Netzwerk noch ENV. RSS/Atom/RDF-/Bild-/Datumfixtures liefern identische Ergebnisse. K. Parseroptionen unverändert.
- **Risiko / Grenze:** Keine gleichzeitige Parserbibliotheksmigration und keine Neuinterpretation von published/updated. HTTP-Download bleibt in Connectoren.

### T53 — Datenbankerzeugung von reinen Modulimports trennen

- **Priorität / Abhängigkeit:** P2 / T30, T35a–h, T52. F35.
- **Dateien:** `server/db.ts`, neu `server/runtime.ts`; `index.ts`, `worker.ts`, `init.ts`, `backup.ts`; zunächst ein Service plus seine Tests.
- **Änderung in zwei separaten Änderungen:** **T53a:** Database-Klasse/Querytypen von globaler Instanz trennen; bestehende Instanz über ausdrücklich benanntes Runtime-Modul weiter bereitstellen. Reine Parser-/Regel-/Konfigurationsfunktionen dürfen runtime nicht importieren. **T53b:** `makeApp` und einen fachlichen Service mit explizitem DB/config-Parameter versorgen, Einstiegspunkte erzeugen/übergeben die Instanz. Weitere Services danach je einzeln umstellen; kein universeller DI-Container.
- **Akzeptanz/Checks:** Import reiner Funktionen legt keine SQLite-Datei an und öffnet keinen PG-Pool. Zwei Testinstanzen können getrennte DBs benutzen, ohne gegenseitige config/db-Mutation. Web/Worker/Backup behalten Migration-/Closeverhalten. K + DB.
- **Risiko / Grenze:** Klassen-/Runtime-Import nicht versehentlich wieder zyklisch machen. Bei schrittweiser Umstellung dürfen Transaktionen niemals Queryfunktion einer anderen DB-Instanz nutzen. Bestehende Einstiegspunkte und unterstützte Datenbanken erhalten.

## Ausdrücklich zurückgestellte Erweiterungen

- Meta-Pagination über die dokumentierte erste Seite hinaus ist eine Produktfunktion, keine verdeckte Bugkorrektur. Bei Bedarf eigene Spezifikation mit Cursor-/Ratelimit-/Rückimportgrenze.
- Passwortrücksetzung, Kontosperre und Sitzungsverwaltung sind sinnvolle Betriebsfunktionen, benötigen aber einen eigenen Autorisierungs- und UI-Vertrag.
- Dauerhafte Aufbewahrungs-/Löschregeln für Artikel, Revisionen und Analysen müssen fachlich vereinbart werden. Der Plan löscht keine Archive, um Performance zu verbessern.
- Ein umfassender SQL-Tokenizer für `?`-Platzhalter ist aktuell nicht notwendig. Falls PostgreSQL-JSON-Operatoren oder Literale damit eingeführt werden, zuerst Adaptervertrag/Tests erweitern oder explizite dialektspezifische Queries verwenden.
- Proxytrust wird nur passend zur echten Bereitstellung gesetzt. Lokaler Betrieb benötigt keine globale trust-proxy-Änderung; Mehrinstanzratelimits erfordern eine eigene Deploymententscheidung.

## Übergabevorlage pro Task

Die folgende Vorlage als kurzen Eintrag in `docs/QUALITAET-FORTSCHRITT.md` verwenden. Keine Secrets oder langen Toolausgaben hineinkopieren.

```text
Task-ID / Datum:
Status: offen | in Arbeit | fertig | Nachweis fehlt
Ausgangsstand (Commit oder Hashreferenz):
Geänderte Dateien:
Konkrete Verhaltensänderung:
Unveränderte Schutzregeln:
Checks mit tatsächlichem Ergebnis:
Offene Punkte / notwendiger externer Nachweis:
Nächste genau eine Task-ID:
```

## Kopierbarer Startauftrag an das umsetzende Modell

```text
Arbeite im NEWSDECK-Projekt ausschließlich an Task <ID> aus
docs/CODEQUALITAET-PLAN-2026-11-10.md. Lies zusätzlich die dort genannten
Befunde in docs/CODEQUALITAET-ANALYSE-2026-11-10.md und den letzten Eintrag
in docs/QUALITAET-FORTSCHRITT.md, sofern bereits vorhanden. Prüfe zunächst
die Abhängigkeiten.

Nutze nur die sichere Entwicklungskopie. Produktive Daten, Zugänge und
laufende Dienste bleiben unberührt. Setze genau den Task um, keine
zusätzlichen Refactorings. Übernimm alle Do-not-touch-Regeln des Plans.
Bei einem Fehler erst die konkrete Ursache nachweisen. Keine bestehenden
Tests abschwächen, um einen Fehler zu verdecken. Führe die im Task genannten
Checks aus, prüfe den Diff und protokolliere Ergebnis, offene Nachweise und
die nächste Task-ID. Wenn eine benötigte Entscheidung nicht im Plan steht,
bereite den betroffenen Teil zur Prüfung vor und benenne die Entscheidung;
erfinde keine Änderung der Fachregeln.
```

**Erster nächster Task ist T01.** Dieser Plan setzt keine der vorgeschlagenen Codeänderungen bereits voraus.

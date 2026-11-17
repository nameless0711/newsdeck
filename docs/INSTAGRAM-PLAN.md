# Plan: kostenlose Instagram-Integration

Stand: 01.11.2026. Status: geplant, noch nicht implementiert. Dieser Plan ist die Arbeitsgrundlage für die nächste Umsetzung.

Fortschritt: Lokaler Anmeldeprototyp mit separatem Edge-Fenster, DPAPI-Sitzungsspeicherung, Wiederverwendungsprüfung und Trennen implementiert. Persönliche Anmeldung und Wiederverwendung im frischen Browser erfolgreich. Aktueller robots.txt-Preflight schließt automatischen Profilabruf weiterhin aus; kein angemeldeter Feedabruf durchgeführt. Details: [Anmeldetest](INSTAGRAM-ANMELDETEST.md). Entscheidung A: lokaler RSSHub-Ausbau pausiert; als Nächstes offizielle Meta-Anbindung anhand geeigneter Zielprofile prüfen.

## Ziel und Kostenrahmen

Öffentliche Instagram-Profile als Quellen in NEWSDECK verfolgen, neue Beiträge automatisch übernehmen und bestehende Themen, Suche und Briefings verwenden. Keine bezahlten RSS-Anbieter oder Scraping-Abos. Lokaler Rechner, Internet, Strom und Wartung bleiben erforderlich. Ein dauerhaft zuverlässiger Zugriff auf jedes öffentliche Profil kann nicht zugesagt werden.

Annahme für die erste Version: ein lokaler Betreiber, eine verbundene Instagram-Sitzung, zunächst zwei bis drei Profile; Beitragstext, Autor, Veröffentlichungszeit und Original-Link. Keine privaten Profile, Stories, Nachrichten oder Medienarchive. Nutzungsrechte für Speicherung und KI-Verarbeitung bleiben getrennt vom technischen Zugriff zu prüfen.

## Bestätigter Ausgangspunkt

- RSSHub läuft lokal; der NEWSDECK-Connector und das Profil-Testformular existieren.
- Anonyme Live-Tests lieferten zunächst einen RSSHub-Auswertungsfehler; die aktuelle Diensthülle stoppt bereits an der robots.txt-Prüfung. Kein erfolgreicher Instagram-Import belegt.
- `scripts/rsshub-service.mjs` leert alle Instagram-Anmeldewerte ausdrücklich. Ein Cookie in der Umgebung würde heute nicht ausreichen.
- `server/connectors.ts` enthält bereits einen Meta-Business-Discovery-Connector. Zugang, Berechtigungen und Live-Abruf sind noch nicht eingerichtet.
- Bestehende Quellensperren, Duplikaterkennung und Fehlerbehandlung sollen weiterverwendet werden.

## Entscheidung über den Zugriffsweg

| Weg | Geeignet für | Bewertung |
| --- | --- | --- |
| Offizielle Meta-Anbindung mit eigener OAuth-Anmeldung | Verbundene professionelle Konten; über Facebook Login/Business Discovery unterstützte fremde Business-/Creator-Profile | Bevorzugter Betriebsweg, wenn die Zielprofile unterstützt werden. Meta-App, passende Konten und Berechtigungen erforderlich. Kein bezahlter Feedanbieter vorgesehen; konkrete aktuelle Zugangsvoraussetzungen vor Einrichtung prüfen. |
| Lokale Anmeldung auf instagram.com und RSSHub mit eigener Sitzung | Technischer Versuch für öffentliche Profile außerhalb des offiziellen Zugriffs | Kein Software-Abo. Experimentell: Sitzungsablauf, Prüfungen durch Instagram und Parseränderungen können den Abruf stoppen. |
| Instaloader mit eigener Anmeldeoberfläche | Alternative zum RSSHub-Adapter bei nachgewiesenem Parserproblem | Unterstützt Anmeldung, Zweifaktor-Anmeldung und gespeicherte Sitzungen. Zusätzliche Python-Komponente und gleichermaßen unsicherer Plattformzugriff. Erst nach kleinem Vergleichstest auswählen. |
| Manuelle Übernahme eines Links und eines vom Nutzer gelieferten Textes | Quellen, deren automatische Abfrage nicht funktioniert | Kostenloser Rückfallweg mit ausdrücklich manueller Aktualisierung. Kein Ersatzversprechen für automatische Überwachung. |

Instagram Login ist kein allgemeiner Zugriff auf beliebige fremde Profile. Der offizielle Instagram-Login-Weg und Facebook Login mit Business Discovery müssen im Produkt klar getrennt sein.

## Umsetzungsfolge und Entscheidungspunkte

### 1. Machbarkeit vor vollständigem Ausbau

- [ ] Zwei bis drei konkrete Zielprofile festhalten und klären, ob eigene/verwaltete Konten oder fremde öffentliche Quellen gemeint sind. Bis dahin können Kontoverwaltung und lokale Tests ohne Zugang vorbereitet werden.
- [ ] Für passende professionelle Profile den vorhandenen Meta-Connector zuerst testen: benötigte Berechtigungen, aktuelle API-Version, Pagination und tatsächliche Felder prüfen. Die bestehende Begrenzung auf 50 Einträge darf spätere Synchronisation nicht unbemerkt abschneiden.
- [ ] Installierten RSSHub-Code auf tatsächlich verwendeten Cookie-Namen, Sitzungsbedarf und Rückgabeformat prüfen und Version festhalten. Kein blindes Setzen sämtlicher Cookie-Varianten.
- [ ] Vor einem angemeldeten Abruf die bestehenden Projektregeln und Abrufbedingungen prüfen. Anmeldung allein hebt die derzeitige robots.txt-Sperre nicht auf. Eine Sitzung darf nicht als automatische Ausnahme in die Diensthülle eingebaut werden.
- [ ] Nur bei passendem Zugriffsweg einen echten angemeldeten Test ausführen. Ergebnis enthält Quelle, Uhrzeit, Status, Anzahl und Beispiel-Links, aber keine Anmeldedaten.

Entscheidung A: Funktioniert Meta für die gewünschten Quellen, diesen Weg ausbauen. Andernfalls Sitzungstest nur soweit zulässig durchführen. Bleibt der Zugriff ausgeschlossen, diesen Zweig stoppen und den manuellen Rückfallweg anbieten. Scheitert ausschließlich RSSHub am Antwortformat, einmal denselben zulässigen Abruf mit Instaloader vergleichen. Nicht automatisch zwischen Anbietern wechseln, um eine Sperre zu umgehen.

### 2. Eigene Anmeldung gestalten

Bevorzugte lokale Sitzungsvariante: NEWSDECK bietet „Instagram verbinden“. Ein lokaler Helfer öffnet ein separates Browserprofil auf der echten Instagram-Seite. Der Nutzer meldet sich dort selbst an und erledigt gegebenenfalls 2FA oder eine Sicherheitsprüfung. Der Helfer übernimmt anschließend nur die benötigte Instagram-Sitzung aus diesem eigens angelegten Profil. Keine Auslese bestehender privater Browserprofile.

- [ ] Helfer an Loopback binden; Verbindungsstart und Sitzungsübernahme nur mit NEWSDECK-Adminsession, Origin-Prüfung und einmaligem kurzlebigem Verbindungscode.
- [ ] Prüfen, ob die Sitzung tatsächlich zum angezeigten Konto gehört. Erst danach „Verbunden“ anzeigen; das bedeutet noch nicht „Quellenabruf funktioniert“.
- [ ] Sitzung unter Windows mit Betriebssystemschutz, beispielsweise DPAPI für denselben Benutzer, speichern. Unter anderem Betriebssystem gesonderte Schlüsselverwaltung entwerfen. Verschlüsselungsschlüssel nicht neben dem verschlüsselten Geheimnis ablegen.
- [ ] Keine Passwörter speichern; Cookies/Token weder an das NEWSDECK-Frontend zurückgeben noch in Logs, Export, ZIP, Versionsverwaltung oder Fehlermeldungen aufnehmen.
- [ ] „Verbindung testen“, „Erneut anmelden“ und „Trennen“ vorsehen. Trennen entfernt lokale Geheimnisse, löscht zugehörigen Cache und pausiert abhängige Quellen. Lokales Löschen ersetzt keine Abmeldung aller Sitzungen bei Instagram.

Alternative ausdrücklich geprüft: Eine eigene Benutzername-/Passwort-/2FA-Maske über Instaloader wäre technisch möglich. Sie wird erst gewählt, wenn der Browserweg nicht passt und ein Prototyp funktioniert. Passwort und 2FA-Code wären nur kurzzeitig im Arbeitsspeicher zu halten; wiederverwendet würde allein die Sitzung. Einen eigenen Nachbau von Instagrams undokumentiertem Login-Protokoll entwickeln wir nicht als erste Lösung.

Offizielle Variante: Eigener „Mit Meta verbinden“-Ablauf mit OAuth, zufälligem `state`, fest erlaubter Rücksprungadresse, minimalen Leseberechtigungen, geschützten Tokens und deren Erneuerung. Die für localhost zugelassene Redirect-Konfiguration wird vor Umsetzung geprüft. Meta-App-Einrichtung, Zustimmung und gegebenenfalls Freigaben können eine Mitwirkung des Kontoinhabers verlangen.

### 3. Integration in NEWSDECK

- [ ] Verbindungen als eigene Datensätze führen: Anbieter, Kontokennung, Status, letzter erfolgreicher Test und Referenz auf geschütztes Geheimnis. Quellen verweisen auf eine Verbindung; exportiert werden nur nicht geheime Quellendaten.
- [ ] Zustände unterscheiden: nicht verbunden, Anmeldung läuft, verbunden, Anmeldung erforderlich, Zugriff eingeschränkt, vorübergehender Fehler.
- [ ] RSSHub bei erlaubtem Sitzungsbetrieb ausschließlich das benötigte Geheimnis bereitstellen; bei Kontowechsel Prozess beziehungsweise Cache kontrolliert erneuern. Der bisherige anonyme Modus bleibt ausdrücklich wählbar.
- [ ] Internen Sitzungsdienst gegen fremde lokale Aufrufer absichern. Health-Endpunkt zeigt nur Status. Für Docker denselben Zugriffsschutz und dieselben Abrufregeln wie unter Windows gewährleisten.
- [ ] Beitrag-ID beziehungsweise kanonischen Link zur Deduplizierung nutzen. Textänderungen als Revision behandeln; fehlendes Datum nicht als neues aktuelles Ereignis ausgeben. Leeres Profil und unlesbare Antwort unterscheiden.
- [ ] Oberfläche in verständlichem Deutsch: Verbindungsstatus, konkrete Fehlerursache, letzte erfolgreiche Aktualisierung, Original-Link.

### 4. Schonender Betrieb

- [ ] Startwert: ein Abruf zur Zeit und frühestens alle 60 Minuten je Quelle; gemeinsame Cache-Nutzung. Das ist eine vorsichtige Produkteinstellung, keine zugesicherte Instagram-Grenze.
- [ ] Bei 429 `Retry-After` berücksichtigen und zentral pausieren. Bei abgelaufener Anmeldung oder Sicherheitsprüfung keine automatischen Login-Schleifen.
- [ ] Bestehenden Scheduler und dessen Wiederanlauf nutzen; Sperren zwischen mehreren Quellen derselben Verbindung teilen.
- [ ] Nur notwendige Textdaten übernehmen; umfangreiche Rückimporte und Medien-Downloads zunächst ausschließen.

### 5. Abnahme

- [ ] Automatisierte Tests: OAuth-/Verbindungsstart, unberechtigter Zugriff, Ablauf und Trennen, Geheimnisfilter, Fehlerzustände, Parser und Deduplizierung. Testdaten als solche kennzeichnen.
- [ ] Echte Anmeldung durch den Nutzer und mindestens ein belegter Abruf eines geeigneten Zielprofils.
- [ ] Wiederholungsabruf erzeugt keine Duplikate; ein neuer verfügbarer Beitrag wird übernommen. Falls während des Tests keiner erscheint, bleibt dieser Nachweis offen.
- [ ] Neustart erhält die geschützte Verbindung; „Trennen“ unterbindet weitere angemeldete Abrufe.
- [ ] Mindestens 24 Stunden Beobachtung mit mehreren planmäßigen Abrufen. Dies ist ein begrenzter Stabilitätstest, keine dauerhafte Zuverlässigkeitsgarantie.
- [ ] Build, relevante Tests und Bedienprüfung bestehen. Dokumentation enthält tatsächlich belegte Ergebnisse und verbleibende Einschränkungen.

## Nächster konkreter Arbeitsschritt

Stand 09.11.2026: **Instagram (Meta API) → Profil testen** ist in NEWSDECK verfügbar. Profilprüfung und Worker nutzen denselben Business-Discovery-Connector. Der Test zeigt weitere Ergebnisseiten an, der Worker verarbeitet zunächst die erste Seite. 31 automatisierte Tests und der Build sind erfolgreich. Die laufende Anwendung meldet ohne Token erwartungsgemäß fehlenden Zugang. Für den nächsten Schritt die eigene Meta-App und das verknüpfte professionelle Konto einrichten, dann ein echtes Zielprofil prüfen. Siehe [Einrichtung im README](../README.md#instagram-über-meta-business-discovery).

Live-Test nach Einrichtung: Der Benutzertoken hat `instagram_basic`, `pages_show_list` und `pages_read_engagement`. Die eingetragene Seiten-ID wurde anhand der Meta-Seitenabfrage durch die verknüpfte Instagram-Konto-ID ersetzt. Die direkte API-Abfrage für das eigene Konto lieferte HTTP 200 und einen Beitrag. Business Discovery für das Testprofil `nasa` liefert Meta-Code 10 (App hat keine Berechtigung für diese Aktion). NEWSDECK und Worker laufen mit der korrigierten ID. Nächster Schritt: App-Freigabe für Business Discovery im Meta App Dashboard prüfen und danach den Profiltest wiederholen.

Beim Wiederholungstest blieb Meta-Code 10 bestehen. Die Tokenabfrage bestätigt, dass `instagram_manage_insights` fehlt. Nächster Test mit einem neu ausgestellten Benutzertoken, der auch dieses Recht enthält.

Der Wiederholungstest mit dem erweiterten Token war erfolgreich. Nach dem Neustart bestätigte der NEWSDECK-Profiltest `@nasa` und lieferte HTTP 200 mit 50 Beiträgen. Web und Worker waren erreichbar. Als Nächstes das gewünschte Zielprofil testen und als Quelle speichern. Automatischer Import und längerfristiger Betrieb bleiben separat zu prüfen.

Phase 1 durchführen: Zugriffsmatrix und einen kleinen Verbindungstest vorbereiten, bevor eine umfangreiche Login-Oberfläche gebaut wird. Danach anhand realer Zielprofile den Meta- oder lokalen Sitzungsweg auswählen. Die aktive Anwendung wird durch diesen Plan noch nicht verändert. Eine persönliche Anmeldung, 2FA und Meta-Zustimmung kann der Agent nicht ohne Mitwirkung des Kontoinhabers abschließen.

## Recherchegrundlagen

- [Metas offizielle API-Sammlung auf Postman](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api): professionelle Konten, Unterschied der Login-Varianten und Einschränkungen. Die Meta-Entwicklerseiten antworteten bei dieser Recherche mit HTTP 429; konkrete Freigaben und Redirect-Regeln deshalb vor der Umsetzung nochmals prüfen.
- [RSSHub-Konfiguration](https://github.com/DIYgod/RSSHub/blob/master/lib/config.ts): Instagram-Cookie-Konfiguration. Das Vorhandensein einer Option beweist keinen erfolgreichen Live-Abruf.
- [Instaloader-Anmeldung und Sitzungen](https://instaloader.github.io/module/instaloader.html): Login, 2FA, Sitzung speichern/laden und Kontoprüfung.
- [Instaloader-Probleme bei der Anmeldung](https://github.com/instaloader/instaloader/blob/master/docs/troubleshooting.rst): dokumentierte Einschränkungen der Anmeldung.
- Lokale Befunde und Live-Testprotokolle: `docs/RSSHUB.md`.

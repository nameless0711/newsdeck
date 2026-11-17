# Architekturentscheidungen

## Datenfluss

Browser → Express API → relationale Datenbank.

Separater Worker → persistenter Scheduler-Lease → Quellen-Lease → RSS/HTML/Meta-Connector → kanonische URL + Inhaltshash → Original/Revision → Themenregeln → optionale KI → Benachrichtigungen + Tagesbriefing.

Web und Worker benötigen keinen Browser, keine ChatGPT-Sitzung und keine Codex-Automation. Compose verantwortet Prozessneustarts; Daten liegen im PostgreSQL-Volume. Im lokalen Modus liegt die SQLite-Datenbank unter `data/`.

## Entitäten

`users`, `sessions`; `topics` mit selbstreferenzierendem Elternschlüssel; `sources`; `articles`; `clusters`; `article_topics`; `revisions`; `analyses`; `favorites`; `fetch_logs`; `notification_rules`; `notifications`; `briefings`; `settings`; `worker_locks`; `migrations`.

Fremdschlüssel schützen Referenzen. Quellenlöschung entfernt keine Nachrichten. Eine ursprüngliche Quellenbezeichnung wird am Artikel gespeichert. Favoriten und Benachrichtigungen gehören Benutzern. Der Nachrichtenbestand ist gemeinsam, nicht mandantenfähig.

## Wiederanlauf

- Quellenclaim per atomarem UPDATE mit RETURNING.
- Schedulerclaim per bedingtem UPSERT; Heartbeat alle 30 Sekunden.
- Abgelaufene Claims werden erneut übernommen. URL-UNIQUE + Inhaltshash verhindern doppelte Meldungen.
- Artikel samt Themen/Revision werden in einer Transaktion geschrieben.
- Quelldaten werden vor KI-Auswertung dauerhaft gespeichert.
- Fehlgeschlagene Abrufe und KI-Auswertungen verwenden begrenztes exponentielles Backoff.

## Erweiterungspunkte

- Weitere Connectoren implementieren `fetch(source): Promise<Item[]>` und werden in `connectors` registriert. API-Quellentyp-Schema und UI-Auswahlliste mit ergänzen.
- Weitere KI-Protokolle: den Anbieteraufruf in `processing.ts` in zusätzliche Providerklassen auslagern; das validierte Ergebnisformat beibehalten. Aktuell werden kompatible Anbieter über URL, Schlüssel und Modell ausgetauscht.
- Für große Quellensammlungen: echte parallele Job-Queue, providerbezogene Rate Limits, dedizierter Volltextindex, Aufbewahrung und Observability ergänzen.
- Für semantische Ereigniscluster: Embeddings und nachvollziehbare redaktionelle Merge/Split-Funktionen. Die aktuelle Heuristik darf nicht als verifizierte Ereignisidentität dargestellt werden.

## Nächster Bereitstellungsschritt

Auf einem Server mit laufender Docker-Engine Compose bauen/starten, PostgreSQL-Backup/Restore testen, Domain und HTTPS einrichten. Danach echte KI-/SMTP-/Meta-Zugänge optional konfigurieren und jeweils gezielt einen Integrationstest durchführen.

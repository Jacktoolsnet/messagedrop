# Geodata-Importläufe im Admin

Manuelle und geplante Importe erhalten beim Dispatch eine gemeinsame `batchId`.
Die Admin-Ansicht lädt alle Aufträge des zuletzt gestarteten Laufs anhand ihrer
Service-Job-IDs, statt nur die letzten 20 Aufträge zu laden. Bereits laufende,
vom Geodata-Service wiederverwendete Jobs gehören ebenfalls zum neuen Lauf.
Die Zuordnung liegt in der Datenbank und bleibt beim Neuladen erhalten.

Die Datenbankinformation und das regelmäßige Polling verwenden dieselbe Auswahl.
Laufende Länder werden zusätzlich über der Liste angezeigt; in der vollständigen
Liste stehen laufende und wartende Aufträge zuerst. Der Zähler der abgeschlossenen
Aufträge umfasst erfolgreiche und fehlgeschlagene Aufträge.

## Deployment

Geodata-Service, Admin-Backend und Admin-Frontend gemeinsam aktualisieren
(Geodata-Service zuerst). Das Admin-Backend ergänzt beim Start automatisch
die optionale Spalte `batchId` und ihren Index in `tableGeodataImportDispatch`.
Es werden keine vorhandenen Importaufträge gelöscht oder neu gestartet.

Alte Aufträge haben keine verlässliche Importlauf-Zuordnung. Solange noch kein
neuer Lauf vorhanden ist, zeigt die Ansicht sämtliche aktiven Jobs, alle Jobs
seit dem ältesten aktiven Job sowie die letzten 20 historischen Jobs.
Eine vollständige rückwirkende Zuordnung bereits abgeschlossener Altaufträge
ist ohne gespeicherte Lauf-ID nicht möglich.

Die bestehende Aufbewahrungsfrist für Import-/Dispatch-Daten gilt weiterhin.
Bei fehlenden Service-Jobs bleibt ein Eintrag mit Fehlerhinweis sichtbar,
statt stillschweigend aus der Liste zu verschwinden.

## Rate limits and log forwarding

The Admin backend's global IP budget (600 requests / 10 minutes) and shared
log-route budget also counted incoming Geodata service logs. A burst of rapidly
completed imports could exhaust those budgets and, with a shared client IP,
temporarily block browser requests with HTTP 429. This response alone does not
indicate a process crash.

POSTs to `/info-log`, `/warn-log`, and `/error-log` bypass those two
budgets **only after cryptographic service-JWT verification** (including audience).
Route authentication still applies. Browser tokens, invalid tokens, log reads,
and other routes retain their previous limits. The Geodata import API itself
does not have an application-level rate limiter; proxy/Plesk limits are independent.

The Geodata forwarder allows at most four concurrent HTTP requests and queues
up to 200 further entries in memory. Overflow entries are not forwarded but remain
in local service logs, with a local warning throttled to once per 30 seconds.
HTTP 429 pauses forwarding according to Retry-After (default 60 seconds, capped
at one hour); queued and newly arriving entries during this pause remain local.
There is no persistent forwarding/replay queue. Forwarding failures must not
escape to the import caller, and forwarding warnings are never forwarded recursively.

Deploy/restart both Admin backend and Geodata service. If a process actually exits
after this change, collect its process-manager/Plesk output and exit signal:
the rate-limit response is not proof of the cause of that exit.

## Queue visibility after restart

For a known admin batch, every status refresh now also queries the Geodata
service's complete active queue (`activeOnly=true`, no history limit) and merges
it by job ID. Thus jobs from earlier runs, or jobs accepted by the service before
an admin dispatch record could be written, remain visible after an admin restart.
The latest batch's completed jobs remain listed; additional jobs outside that
batch are shown while active. The heading reflects the combined run/queue view.

The frontend now subscribes to Socket.IO updates while the database-information
tab is visible, with an initial snapshot and a fresh snapshot after reconnection.
There is no periodic frontend job polling. See [deployment and operation of live updates](geodata-live-updates.md).
A failed live-queue read fails the refresh rather than presenting a completed-only batch as current.

This does not change worker recovery: an Admin restart leaves Geodata workers
alone. On a Geodata-service restart, its existing recovery marks interrupted
running jobs as failed and launches remaining queued jobs; it does not mark them
as successfully imported. Deploy all three components (Geodata first).

The authenticated Geodata push endpoint `/geodata-import/events` also bypasses
the browser IP budget; its route additionally checks the Geodata issuer.

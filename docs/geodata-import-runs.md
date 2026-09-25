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

## Priorität der Länder

Manuelle und geplante Läufe bearbeiten die ausgewählten Länder in dieser Reihenfolge:

1. Letzter abgeschlossener Importversuch fehlgeschlagen.
2. Noch kein erfolgreicher Import vorhanden.
3. Bereits erfolgreich importiert (einschließlich unveränderter Daten).

Nur der letzte abgeschlossene Versuch zählt: Ein späterer Erfolg hebt die
Fehler-Priorität auf. Laufende und wartende Aufträge verdecken frühere Fehler
nicht. Falls die Job-Historie bereits bereinigt wurde, erkennt der Service
vorhandene Importe weiterhin an ihrer aktiven Datenversion. Gelöschte Fehler
können dagegen nicht mehr zur Priorisierung herangezogen werden.

Das Admin-Backend holt vor dem ersten Auftrag einen authentifizierten Importplan
vom Geodata-Service (`POST /geodata/import-plan`). Innerhalb derselben Priorität
bleibt die ausgewählte Reihenfolge erhalten. Bei einem fehlgeschlagenen Planabruf
werden keine neuen Aufträge angelegt. Der Service wählt auch aus einer bestehenden
Warteschlange nach derselben Priorität, innerhalb einer Priorität nach Anlagezeit.
Die Priorität wird aus der Datenbank ermittelt und funktioniert daher auch nach
einem Neustart. Ein laufender Auftrag wird nicht verdrängt; fehlgeschlagene
Aufträge werden nicht automatisch erneut angelegt.

Für diese Änderung zuerst den **Geodata-Service**, dann das **Admin-Backend**
aktualisieren und neu starten. Frontend, Umgebungsvariablen und Datenbankschema
bleiben unverändert. Den Geodata-Neustart möglichst außerhalb eines laufenden
Imports durchführen: Die bestehende Recovery markiert unterbrochene Importe
als fehlgeschlagen; wartende Aufträge bleiben erhalten.

## Einzelnes Land erneut versuchen

Fehlgeschlagene Aufträge haben im Admin-Importverlauf ein Wiederholen-Symbol
(`refresh`) mit Tooltip und zugänglicher Beschriftung. Es startet nur dieses
Land mit den ursprünglichen Kategorien, Unterkategorien sowie Refresh-/Force-
Optionen erneut, unabhängig von später geänderten oder ungespeicherten Einstellungen.
Der Button ist während der Anfrage und bei einem bereits aktiven Auftrag für
dasselbe Land gesperrt. Die bestehende Service-Deduplizierung bleibt erhalten.

Der geschützte Admin-Endpunkt `POST /geodata-import/jobs/:jobId/retry` prüft den
ursprünglichen Job. Laufende, wartende und erfolgreiche Jobs werden nicht erneut
gestartet. Bei fehlgeschlagener Übergabe oder abgelaufener Service-Historie dient
die gespeicherte Dispatch-Konfiguration als Rückfall. Ohne ursprüngliche
Konfiguration wird kein Retry ausgeführt.

Die Zuordnung des Landes im bestehenden Importlauf zeigt anschließend auf den
neuen Versuch; die anderen Länder und die Lauf-ID bleiben unverändert. Der alte
fehlgeschlagene Service-Job bleibt zu Diagnosezwecken in der Service-Historie.
Ein Retry verändert weder die Einstellungen noch den Zeitpunkt des letzten
geplanten Laufs. Live-Updates und Import-Keep-alive werden ebenfalls informiert.

Deployment: **Admin-Backend und Admin-Frontend** aktualisieren (Backend zuerst).
Kein Geodata-Neustart und keine Datenbankschema- oder ENV-Änderung erforderlich.

## Importstatistik

Ab diesem Deployment speichert der Geodata-Service je Auftrag dauerhaft
`downloadedBytes` und `importedRecords`. Die nullable BIGINT-Spalten werden beim
Start automatisch ergänzt; historische Aufträge werden nicht mit erfundenen
Nullwerten aufgefüllt. Nach dem Start eines neuen Imports werden die Zähler
initialisiert. Übersprungene Länder und reine Export-Reparaturen erhalten null
neue Downloadbytes und null neue POI-Datensätze.

Die Downloadgröße ist die heruntergeladene PBF-Nutzdatenmenge laut lokaler Datei,
nicht HTTP-/TLS-Overhead oder zusätzlich übertragene Bytes durch Wiederholungen.
Sie wird während des Downloads gespeichert und über spätere Phasen hinweg
beibehalten. Bei einem regulären Downloadfehler wird noch die letzte Teilgröße
erfasst; bei hartem Prozessabbruch bleibt der zuletzt gespeicherte Stand.
Die Anzeige verwendet dezimale GB (1 GB = 1.000.000.000 Bytes).

Die Datensatzanzahl zählt tatsächlich gespeicherte POI-Zeilen der neuen Version,
nicht rohe OSM-Objekte oder mehrfach verarbeitete Features. Sie wird nach dem
Einlesen erfasst und bei regulären Fehlern vor dem Verwerfen der Version nochmals
gezählt. Erzeugte, aber wegen eines Fehlers anschließend verworfene Datensätze
zählen somit zur geleisteten Importarbeit, nicht zum aktiven Datenbankbestand.
Während des Einlesens bzw. nach einem harten Abbruch kann die Anzahl unbekannt sein.

Die Zusammenfassung oberhalb der Auftragsliste enthält ausschließlich den letzten
Admin-Importlauf; andere zusätzlich angezeigte aktive Jobs zählen nicht dazu.
Jeder Job zählt einmal. Bei Retry zählt der zuletzt angezeigte Versuch pro Land,
nicht zusätzlich die früheren Versuche. Die kumulierte Dauer ist die Summe der
Bearbeitungszeiten ab `startedAt` bis `completedAt` bzw. bis zur Statusaufnahme
bei laufenden Jobs. Wartezeit ist ausgeschlossen; dies ist nicht die verstrichene
Kalenderzeit des gesamten Laufs. Fortschrittsereignisse aktualisieren die Summen.

Fehlende Werte werden als „—“ angezeigt; bei teilweise bekannten Werten weist
die Zusammenfassung darauf hin, dass nur erfasste Werte summiert werden.
Ohne gespeicherte Importlauf-Zuordnung wird keine vermeintliche Lauf-Summe gebildet.

Deployment: **Geodata-Service, Admin-Backend und Admin-Frontend** aktualisieren,
Geodata zuerst. Keine neuen ENV-Variablen. Den Service möglichst erst nach Ende
eines laufenden Imports neu starten. Vollständige Werte gibt es für neue Importe;
alte Jobs werden nicht rückwirkend rekonstruiert.

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

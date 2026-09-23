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

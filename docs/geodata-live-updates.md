# Geodata-Live-Updates (Socket.IO)

## Aufbau

- Import-Worker: meldet nach gespeicherten Fortschrittsänderungen per Node-IPC an
  den Geodata-Service. Neue Jobs, Worker-Ende und Wiederherstellung der Queue
  lösen ebenfalls Änderungen aus.
- Geodata-Service → Admin-Backend: signierter HTTP-Push an
  `POST /geodata-import/events` (Service-JWT). Der Inhalt ist nur ein
  Änderungshinweis, keine ungeprüften Statusdaten. Meldungen werden zusammengefasst
  (ca. eine Sekunde), fehlgeschlagene Zustellungen mit begrenztem Backoff wiederholt.
- Admin-Backend → Browser: vorhandener Socket.IO-Server, Ereignis
  `geodata:snapshot`. Das Backend liest bei Änderungen den maßgeblichen DB-Status
  über die bestehenden Service-Endpunkte und sendet einen vollständigen Snapshot.
  Ohne abonnierte Ansicht werden keine Snapshots abgefragt.
- Der Browser verbindet sich nur im Reiter **Datenbankinformationen** der
  Geodata-Einstellungen. Beim Reiterwechsel oder Verlassen der Seite wird die
  Verbindung geschlossen. Es gibt kein regelmäßiges GET-/jobs-Polling mehr.
- Nach Wiederverbindung wird neu abonniert und der volle Status abgeglichen.
  Gleichzeitige Snapshot-Abfragen werden verhindert; bei Fehlern wird verzögert
  erneut versucht. Eine unterbrochene Browserverbindung wird sichtbar angezeigt.
- Nur Admin-/Root-JWTs dürfen abonnieren. Bei Tokenablauf wird die Verbindung
  beendet. Service-JWTs sind ausschließlich für den internen Änderungseingang
  vorgesehen; zusätzlich wird dessen Geodata-Issuer geprüft.

Die Verbindung vom Service zum Backend benötigt **keinen weiteren Socket-Port**.
Socket.IO selbst läuft auf dem bereits vorhandenen HTTP-Port des Admin-Backends.
Direkt per CLI gestartete Importskripte ohne Service-Parent senden keine
IPC-Live-Updates; beim Öffnen/Aktualisieren der Ansicht sind ihre DB-Daten sichtbar.

## Deployment-Reihenfolge

Nach Möglichkeit laufende Importe zunächst beenden lassen: Das bestehende
Recovery-Verhalten markiert einen beim Geodata-Neustart unterbrochenen laufenden
Job als fehlgeschlagen und arbeitet anschließend die wartenden Jobs ab.

1. **Admin-Backend** (`platform/admin/backend`) deployen und neu starten.
   Der neue Service-Endpunkt, der Socket-Handler und die Rate-Limit-Ausnahme
   müssen gemeinsam vorhanden sein.
2. **Geodata-Service** (`services/geodata`) einschließlich
   `scripts/import-local-dataset.js` deployen und neu starten.
   Alte bereits laufende Worker enthalten die IPC-Änderung noch nicht.
3. **Admin-Frontend** (`platform/admin/frontend`) mit aktualisiertem
   `package.json` und `package-lock.json` bauen und das Build deployen.
   Neu ist die Laufzeitabhängigkeit `socket.io-client`:
   `npm ci`, danach der übliche Produktionsbuild mit Node 24.17.0.
   Anschließend Browser neu laden.

Keine zusätzliche Datenbankmigration und keine neue Pflicht-ENV-Variable.

## Plesk / Reverse Proxy

- Der bestehende Admin-Backend-Host muss `/socket.io/` inklusive WebSocket-Upgrade
  an den Node-Prozess weiterleiten. Der Client verwendet ausschließlich WebSocket,
  keinen versteckten HTTP-Long-Polling-Fallback.
- Bei HTTPS ist es eine **wss://**-Verbindung; die TLS-Konfiguration des bestehenden
  Backend-Hosts wird verwendet.
- Proxy-Idle-Timeout größer als `pingInterval + pingTimeout` einstellen
  (hier 20 + 30 Sekunden, beispielsweise 75 Sekunden).
- Je nach Plesk/nginx/Apache-Konfiguration muss die Upgrade-Weiterleitung angepasst
  werden. Nicht pauschal Proxy-Modi abschalten oder Konfigurationen überschreiben.
  Offizielle Beispiele: https://socket.io/docs/v4/reverse-proxy/
- `ADMIN_ORIGIN` muss weiterhin zum Frontend passen; `environment.apiUrl`
  muss auf den Admin-Backend-Host zeigen.
- Der Geodata-Service benötigt Netzwerkzugriff auf das Admin-Backend über
  `ADMIN_BASE_URL` / `ADMIN_PORT` bzw. den bestehenden Override `ADMIN_LOG_URL`.
  Service-JWKS/Signierschlüssel und
  `SERVICE_JWT_AUDIENCE_ADMIN=service.admin-backend` müssen wie bei der
  bestehenden Logweiterleitung stimmen. Ein individuell gesetzter
  `GEODATA_SERVICE_JWT_ISSUER` muss auf beiden Seiten übereinstimmen.

**Betriebsgrenze:** Diese Implementierung verwendet den lokalen Socket.IO-Raum
eines einzelnen Admin-Node-Prozesses. Plesk/Passenger daher mit **einem
Admin-Backend-Worker** betreiben. Für mehrere Worker/Instanzen ist zusätzlich
prozessübergreifendes Pub/Sub bzw. ein passender Socket.IO-Adapter samt
prozessübergreifender Änderungsverteilung nötig; Sticky Sessions allein reichen
für HTTP-Push → Socket-Worker nicht aus.

## Kontrolle nach Deployment

1. Reiter „Datenbankinformationen“ öffnen: Im Browser-Netzwerkprotokoll muss
   `/socket.io/?EIO=4&transport=websocket` als **101 Switching Protocols** erscheinen.
2. Unter WebSocket-Nachrichten: `geodata:subscribe`, dann `geodata:snapshot`.
   Im Leerlauf sind Heartbeats normal, aber keine periodischen GET-/jobs-Anfragen.
3. Bei einem Import müssen Land, Warteschlange und Fortschritt automatisch wechseln.
4. Reiter wechseln: Verbindung wird geschlossen; zurückwechseln: neuer Snapshot.
5. Kurz Netzwerkverbindung trennen: Warnung; nach Wiederverbindung aktueller Status.
6. Bei fehlenden Updates: Geodata-Warnlog auf
   `Geodata live update delivery failed` und Admin-Warnlog auf
   `Geodata live snapshot failed` prüfen. 401/403 deuten auf JWT-Konfiguration,
   404 auf fehlendes Backend-Deployment/Proxy-Routing. Änderungen bleiben in der DB;
   ein Verbindungsproblem startet keine zusätzlichen Importe.

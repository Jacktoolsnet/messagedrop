# Notifications / Web Push einrichten

Diese Anwendung nutzt Browser Web Push mit VAPID-Schlüsseln.

## Wo die Konfiguration im Code verwendet wird

- Frontend lädt den Public Key über `GET /utils/vapid-public-key`.
- Backend initialisiert die VAPID Keys beim Start in `backend/utils/keyStore.js`.
- Push-Versand läuft über `backend/utils/notify.js` und `web-push`.
- Subscriptions werden pro User über `POST /user/subscribe` in `tableUser.subscription` gespeichert.

## Benötigte Backend-Variablen

Auf jeder Stage muss das Backend mindestens eines davon haben:

```env
# separat empfohlen
VAPID_KEY_PASSWORD=<starkes-passwort>

# oder Fallback, falls VAPID_KEY_PASSWORD fehlt
ENCRYPTION_KEY_PASSWORD=<starkes-passwort>
```

Optional, wenn ein bestehendes Key-Paar explizit gesetzt werden soll:

```env
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@messagedrop.de
# alternativ z.B. https://p.frontend.messagedrop.de
```

Wenn `backend/keys/vapid.keys.enc` noch nicht existiert, erzeugt das Backend beim Start automatisch ein neues VAPID-Key-Paar und speichert es verschlüsselt dort ab. Dafür muss `VAPID_KEY_PASSWORD` oder `ENCRYPTION_KEY_PASSWORD` gesetzt sein.

## Variante A: Keys automatisch vom Backend erzeugen lassen

1. Auf der Stage im Backend-Environment setzen:

   ```env
   VAPID_KEY_PASSWORD=<starkes-passwort>
   VAPID_SUBJECT=mailto:admin@messagedrop.de
   ```

2. Sicherstellen, dass das Backend Schreibrechte auf `backend/keys/` hat.
3. Backend neu starten.
4. Prüfen, ob die Initialisierung erfolgreich war:

   ```bash
   grep -i "VAPID keys ready" backend/logs/backend-info-*.log
   ```

5. Prüfen, ob der Public Key ausgeliefert wird:

   ```bash
   curl https://<backend-domain>/utils/vapid-public-key
   ```

   Erwartet: JSON mit `status: 200` und `publicKey`.

## Variante B: Keys per Shell erzeugen und setzen

Im Backend-Verzeichnis:

```bash
cd backend
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Alternativ, falls `npx` verfügbar ist:

```bash
cd backend
npx web-push generate-vapid-keys --json
```

Dann die Ausgabe als Environment setzen:

```env
VAPID_PUBLIC_KEY=<generierter-public-key>
VAPID_PRIVATE_KEY=<generierter-private-key>
VAPID_KEY_PASSWORD=<starkes-passwort>
VAPID_SUBJECT=mailto:admin@messagedrop.de
```

Nach dem nächsten Backend-Start speichert `keyStore.js` diese Keys verschlüsselt unter `backend/keys/vapid.keys.enc`.

## Wichtig bei Stage-Wechseln

- Wenn ein VAPID-Key-Paar gewechselt wird, sind bestehende Browser-Subscriptions mit dem alten Key nicht mehr gültig.
- Das Frontend erkennt einen Key-Wechsel und unsubscribed/resubscribed beim nächsten User-Lauf (`ensurePushSubscription`).
- Für einen schnellen Test im Browser ggf. Website-Daten/Service-Worker löschen oder Notification-Berechtigung zurücksetzen.

## Smoke-Test

1. Frontend über HTTPS öffnen, einloggen.
2. DevTools → Application prüfen:
   - Service Worker registriert
   - Push Subscription vorhanden
   - Notification Permission ist `granted`
3. API prüfen:

   ```bash
   curl https://<backend-domain>/utils/vapid-public-key
   ```

4. Backend-Logs beim Auslösen einer passenden Notification prüfen:

   ```bash
   grep -i "webpush" backend/logs/backend-*.log
   ```

Erfolgsfall: `webpush notification queued`.

Fehlerfälle:

- `vapid_public_key_missing`: VAPID Keys wurden nicht geladen/erzeugt.
- `sendNotification: missing VAPID keys`: Backend hat keinen Public/Private Key im Speicher.
- `webpush.sendNotification failed` mit `403`: häufig falscher/wechselnder VAPID Key oder alte Subscription.
- `400`, `404`, `410`: Subscription ist ungültig/abgelaufen und wird vom Backend gelöscht.

## Hinweis zum Frontend-Service-Worker

Das Frontend registriert aktuell `messagedrop-service-worker.js`. Der Angular Service Worker (`ngsw-worker.js`) wird zwar mitgebaut, muss aber auch in den registrierten Worker eingebunden sein, damit Angular Push-Payloads automatisch verarbeitet werden. Wenn Subscriptions funktionieren, aber keine Push-Benachrichtigung angezeigt wird, sollte geprüft werden, ob der Custom Worker den Angular Worker importiert oder selbst einen `push`-Handler implementiert.

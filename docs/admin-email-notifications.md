# Admin-Benachrichtigungen per E-Mail

## Konfiguration und Umstellung

- SMTP mit den bestehenden `MAIL_*`-Variablen konfigurieren.
- `ADMIN_NOTIFICATION_EMAIL` auf **eine** interne Empfängeradresse setzen.
  Wenn leer, wird `ADMIN_ROOT_EMAIL` verwendet. Eine fehlende/ungültige Adresse
  wird protokolliert; interne Meldungen werden dann nicht versendet.
- `ADMIN_ROOT_EMAIL` und die E-Mail-Adressen aller Admin-Benutzer vor dem Rollout
  prüfen. Login-Codes gehen ausschließlich an den jeweiligen Benutzer.
  Der bisherige Root-Fallback auf `MAIL_ADDRESS` / `MAIL_USER` bleibt für OTP bestehen;
  eine explizite Root-Adresse wird empfohlen.
- Backend und Admin-Frontend gemeinsam ausrollen. SMTP-Test und Root-/Benutzerlogin
  testen, solange noch eine bestehende Admin-Sitzung verfügbar ist.
- Nach erfolgreicher Prüfung alte Make-Szenarien deaktivieren und Zugangsdaten
  widerrufen. `MAKE_API_KEY`, `MAKE_PUSHBULLET_WEBHOOK_URL`, `PUSHBULLET_TOKEN`,
  `PUSHBULLET_CHANNEL`, `PUSHBULLET_DEVICE` und `ADMIN_OTP_PUSH_REQUIRED`
  aus der Deployment-Konfiguration entfernen. Diese Variablen werden nicht mehr verwendet.
  Lokale/produktive Secrets werden durch die Codeänderung nicht automatisch gelöscht.

## Versandverhalten

- Interne Mails: neue Moderationsanfragen, DSA-Signals/Notices, Loginfehler und PoW-Aktivierung.
- OTP: genau ein Versandversuch; bei fehlender Adresse, fehlender SMTP-Konfiguration
  oder Versandfehler wird der Login nicht fortgesetzt und die Challenge gelöscht.
  SMTP-Annahme bestätigt nicht den tatsächlichen Eingang im Postfach.
- Interne Hintergrundmeldungen: maximal drei Versuche bei vorübergehenden Fehlern,
  mit 1 bzw. 2 Sekunden Abstand. Keine Wiederholung bei Konfigurations-,
  Authentifizierungs- oder permanenten SMTP-Fehlern.
- Loginfehler und PoW-Aktivierungen: jeweils höchstens eine Meldung pro fünf Minuten
  **pro Backend-Prozess**, unabhängig von Benutzer/IP. Weitere Ereignisse werden
  unterdrückt und protokolliert, nicht nachträglich gesammelt versendet.
- Wiederholungen und Begrenzung liegen nur im Arbeitsspeicher: Neustarts verlieren
  ausstehende Versuche; dies ist keine persistente Zustellwarteschlange.
  Bei unklaren SMTP-Verbindungsabbrüchen können Wiederholungen doppelte Mails erzeugen.
- Bestehende DSA-Mails an meldende Personen, Zertifikatsmails und App-interne
  Nutzerbenachrichtigungen bleiben bestehen.

## Prüfungen

Backend-Tests (Node 24.17.0):

```bash
cd platform/admin/backend
node --test test/mail-notifications.test.js
```

Vor dem produktiven Abschalten der bisherigen Dienste: OTP für Root und normalen
Benutzer, Loginfehler, Moderationsanfrage, DSA-Signal, DSA-Notice und PoW-Ereignis
auslösen und Empfänger/Postfach prüfen. Auch SMTP-Ausfall und fehlende Benutzeradresse
testen. Tests im Repository versenden keine echten E-Mails.

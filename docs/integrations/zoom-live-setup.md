# Zoom Live in CareSuite HealthOS

## Technische Trennung

Zoom ist bewusst vollständig von Google Workspace getrennt:

- eigene Tabellen mit Präfix `zoom_`
- eigene OAuth-State-Verwaltung
- eigener AES-GCM-Schlüssel
- eigene Supabase Edge Functions
- eigene Zoom-API- und Webhook-Verarbeitung
- eigene Audit-Ereignisse
- keine Abhängigkeit zu `google_workspace_*`
- keine Verwendung von Google-Tokens oder Google-Secrets

Gemeinsam sind ausschließlich die CareSuite-Kerndaten `tenants`, `profiles` und
`roles`, damit Mandant und Berechtigung korrekt aufgelöst werden.

## Zoom Marketplace

In Zoom Marketplace eine General App für CareSuite anlegen:

1. OAuth aktivieren.
2. Meeting SDK unter **Embed** aktivieren.
3. Die von Zoom benötigten Meeting-, Benutzer- und optional
   Aufzeichnungsberechtigungen hinzufügen.
4. Folgende Redirect URL eintragen:

   `https://euagyyztvmemuaiumvxm.supabase.co/functions/v1/zoom-auth`

5. Event Subscription aktivieren und folgende Zieladresse eintragen:

   `https://euagyyztvmemuaiumvxm.supabase.co/functions/v1/zoom-webhook`

6. Mindestens diese Events auswählen:

   - `meeting.started`
   - `meeting.ended`
   - `meeting.participant_joined`
   - `meeting.participant_left`

7. Client ID, Client Secret, Meeting SDK Key, Meeting SDK Secret und Webhook
   Secret Token ausschließlich über das Git-Bash-Deployskript eintragen.

## Deployment

Im CareSuite-Repository in Git Bash:

```bash
bash scripts/deploy-zoom-live-gitbash.sh
```

Automatischer Modus nach vorheriger Prüfung der Migrationen:

```bash
bash scripts/deploy-zoom-live-gitbash.sh --yes
```

Erneutes Deployment ohne Änderung bestehender Secrets:

```bash
bash scripts/deploy-zoom-live-gitbash.sh --skip-secrets
```

## Sicherheitsstandard

- Zoom-Passwörter werden nicht von CareSuite verarbeitet.
- OAuth- und SDK-Secrets bleiben in Supabase Secrets.
- Zugriffs- und Refresh-Tokens werden AES-256-GCM-verschlüsselt.
- Start-URL, Beitritts-URL und Kenncode werden verschlüsselt gespeichert.
- Der fachliche CareSuite-Terminname wird nicht an Zoom übertragen.
- Zoom erhält den neutralen Titel `CareSuite Videotermin`.
- Aufzeichnungen sind standardmäßig deaktiviert.
- Webhooks werden per HMAC-Signatur und Zeitfenster geprüft.
- Doppelte Webhooks werden idempotent verworfen.
- Sämtliche Zoom-Aktionen werden mandantenbezogen auditiert.

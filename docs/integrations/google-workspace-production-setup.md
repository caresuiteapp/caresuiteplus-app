# Google Workspace – Produktionseinrichtung

Die Implementierung verwendet Google OAuth 2.0/OIDC mit PKCE. CareSuite fragt
keine Google-Passwörter ab. Zugriffs- und Refresh-Tokens werden mit AES-256-GCM
verschlüsselt in Supabase gespeichert und nur in Edge Functions entschlüsselt.

## Google Cloud

1. Ein eigenes Google-Cloud-Projekt für CareSuite HealthOS verwenden.
2. OAuth-Zustimmungsbildschirm als externe oder interne Workspace-App einrichten.
3. OAuth-Client vom Typ „Webanwendung“ erstellen.
4. Als autorisierte Redirect-URI exakt hinterlegen:
   `https://<SUPABASE-PROJECT-REF>.supabase.co/functions/v1/google-workspace-auth`
5. Folgende APIs aktivieren:
   Gmail, Calendar, Drive, Docs, Sheets, Slides, Tasks, People und Google Chat.
6. App-Datenschutz, Nutzungsbedingungen, Supportkontakt und verifizierte Domain
   hinterlegen. Restricted/Sensitive Scopes müssen vor allgemeiner Freigabe die
   Google-Prüfung durchlaufen.

## Supabase Secrets

```text
GOOGLE_WORKSPACE_CLIENT_ID
GOOGLE_WORKSPACE_CLIENT_SECRET
GOOGLE_WORKSPACE_REDIRECT_URI
GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY
GOOGLE_WORKSPACE_RETURN_ORIGINS
CARESUITE_PUBLIC_URL
```

`GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY` ist ein zufälliger, 32 Byte langer
Schlüssel in Base64. Er darf nach dem ersten produktiven Connect nicht ohne
kontrollierte Tokenmigration ersetzt werden.

## Deployment

1. Migration `0269_google_workspace_live.sql` anwenden.
2. Edge Functions `google-workspace-auth` und `google-workspace-proxy` deployen.
3. Die Secrets ausschließlich serverseitig in Supabase setzen.
4. In CareSuite unter `Connect > Kommunikationskanäle > Google Workspace` mit
   einem Business-Admin verbinden.
5. Status, erkannte Scopes und alle zehn Dienstkarten prüfen.
6. Mindestens eine lesende und eine ausdrücklich bestätigte schreibende Aktion
   je freigegebenem Dienst testen.
7. Audit-Einträge und Token-Refresh nach Ablauf des ersten Access-Tokens prüfen.

## Sicherheitsgrenzen

- Keine Secrets in Expo-, Browser- oder Android-Umgebungsvariablen.
- Keine Domain-wide Delegation ohne gesonderte Mandantenentscheidung und
  dokumentierte Workspace-Admin-Freigabe.
- Schreibende Aktionen werden nur mit `confirmed: true` ausgeführt.
- Audit-Einträge enthalten keine E-Mail-, Dokument- oder Gesundheitsinhalte.
- Scopes werden nicht angenommen, sondern aus der tatsächlichen Google-Antwort
  abgeleitet. Nicht freigegebene Dienste bleiben sichtbar als „Freigabe fehlt“.

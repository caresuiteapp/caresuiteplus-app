# CareSuite+ — Communication Center (Core Platform)

## Architektur

Das Kommunikationszentrum ist eine **Core-Plattformfunktion** — nicht an Office, Assist oder andere Module gebunden.

```
CareSuite+ Core
└── Communication Center
    ├── Business-App (/business/messages)
    ├── Mitarbeiter:innenportal (/portal/employee/messages)
    ├── Klient:innenportal (/portal/client/messages)
    ├── Angehörigenportal (/portal/relative/messages)
    ├── Demo Store (ohne Supabase env)
    └── Migration 0011_communication_center.sql (Produktion)
```

## Kern-Dateien

| Bereich | Pfad |
|---------|------|
| Typen & Konstanten | `src/features/communication/` |
| Services | `communication.service.ts`, `communication.*.ts` |
| Hooks | `src/hooks/communication/` |
| UI | `src/components/communication/` |
| Screens | `src/screens/communication/` |
| Routen | `app/business/messages/`, `app/portal/*/messages/` |
| Migration | `supabase/migrations/0011_communication_center.sql` |
| Tests | `src/__tests__/communication/` |

## Sicherheitsregeln

- **Tenant-Isolation**: Jede Entität hat `tenantId` / `tenant_id`
- **Portal-Filter**: `communication.portalFilter.ts` entfernt interne Notizen
- **Soft Delete**: Standard für Nachrichten und Threads; Audit in `communication_audit_events`
- **Berechtigungen**: `communication.*` PermissionKeys + Portal-Rechte
- **Keine Secrets im Frontend**

## Demo-Modus

Vollständig funktionsfähig über `communication.demoStore.ts` und `communication.demoData.ts` (28+ Threads, 80+ Nachrichten).

## Realtime

Vorbereitet in `communication.realtime.ts` — Demo simuliert Heartbeats; Produktion nutzt Supabase Channels:

- `tenant:{tenant_id}:communication_threads`
- `thread:{thread_id}:messages`

## Storage (Produktion)

Buckets (Kommentar in Migration):

- `communication-attachments`
- `communication-voice`
- `communication-images`

Pfad: `tenant/{tenant_id}/threads/{thread_id}/...`

## Navigation

- Business-Tab „Nachrichten“ in `shellConfig.ts`
- Ops-Hub Karte „Kommunikationszentrum“

## Deferred (Produktion)

- Echte Supabase-Repositories (aktuell Demo Store)
- Push-Benachrichtigungen (Expo Notifications)
- Echte Audio-Aufnahme (expo-av nicht im Projekt — UI/Service vorbereitet)
- Storage Bucket Policies als separate Migration

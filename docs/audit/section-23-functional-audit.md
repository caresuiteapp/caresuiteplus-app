# Section 23 — Functional Recovery Audit

**Branch:** `recovery/hybrid-live-restore`  
**Date:** 2026-06-18  
**Tenant (live):** Helferhasen+  
**Mode:** `EXPO_PUBLIC_DEMO_MODE=false`

| Bereich | Route | Service | Status | Root Cause | Fix | Paket |
|---------|-------|---------|--------|------------|-----|-------|
| Klient:innen Liste | `/office/clients` | `useClientList` → `clientListService` → `supabaseClientRepository` | BEHOBEN | Prior: `clientMapper` + lifecycle ohne `lead`; Encoding-Korruption in ListView | Restore mapper/lead (verified); UTF-8 + Loading-Text | A |
| Klient:in anlegen | `/office/clients/new` | `clientService.create` | FUNKTIONIERT | — | Verified intake route + Supabase insert | A |
| Mitarbeitende Liste | `/office/employees` | `useEmployeeList` → `employeeSupabaseRepository` | BEHOBEN | Prior: silent empty bei fehlendem Tenant | `enabled: true` + ErrorState (verified); Loading-Text | B |
| Mitarbeitende anlegen | `/office/employees/create` | `employeeSupabaseRepository.create` | FUNKTIONIERT | — | Route + create flow verified | B |
| Nachrichten Inbox | `/office/messages` | `useOfficeMessageThreads` → `messagethreadservice` | BEHOBEN | Live threads OK; Kontext-Spalte fehlte | 3-Spalten-Layout + ContextPanel | C |
| Chat Detail / Senden | `/office/messages` | `messageservice.sendOfficeMessage` | BEHOBEN | Send live OK | Verified; mark read on select | C |
| Neuer Chat Modal | `/office/messages` | `createOfficeMessageThread` | BEHOBEN | **Export fehlte** in `messageservice.ts` | Implement `createOfficeMessageThread` | C |
| Thread Kontext (Status/Prio) | `/office/messages` | `patchOfficeMessageThread` | BEHOBEN | Hook stubs „noch nicht wiederhergestellt“ | Service + Hook wiring | C |
| Broadcast Liste | `/office/messages?tab=broadcasts` | `broadcastService.listBroadcasts` | FUNKTIONIERT | Code OK | Verified | D |
| Broadcast senden | Modal | `broadcastService.sendBroadcast` | RLS BLOCKIERT (live) | Migration 0096 nicht auf Remote | Doc + user apply 0096 | D |
| Benachrichtigungen Glocke | PlatformTopbar | `useNotifications` → `notificationservice` | BEHOBEN | Topbar: statisches Emoji → `/business/messages` | `NotificationBellWithCenter` | D |
| Klientenportal Codes | `/business/office/access/client-portal` | `clientPortalAccessListService` | FUNKTIONIERT | Restored from prior recovery | Audit only | E |
| Mitarbeiterportal | `/portal/employee` | `portalofficemessageservice` | FUNKTIONIERT | Recovery auth retained | Audit only | E |
| Office Nav Kommunikation | Sidebar | `officenav.ts` | FUNKTIONIERT | Prior fix verified | — | — |
| PlatformShell Listen | Desktop | `platformshell.tsx` flex | FUNKTIONIERT | Prior fix verified | — | — |
| ClientDetailModal | Desktop adaptive | `ClientsAdaptiveScreen` | FUNKTIONIERT | Prior fix verified | — | — |
| EmployeeDetailModal | Desktop adaptive | `EmployeesAdaptiveScreen` | FUNKTIONIERT | Prior fix verified | — | — |

## Summary counts (post-fix)

| Status | Count |
|--------|-------|
| FUNKTIONIERT | 8 |
| BEHOBEN | 8 |
| RLS BLOCKIERT | 1 |
| ROUTE FEHLT | 0 |
| LÄDT KEINE DATEN | 0 |
| BUTTON OHNE FUNKTION | 0 |
| UI NICHT ANGEBUNDEN | 0 |

## User action required

1. **Apply migration `0096_broadcast_rls_live_roles.sql`** on live Supabase (Helferhasen+) so Broadcast send/list works for `owner`/`admin` roles.
2. Ensure migrations **0089–0094** are applied if Broadcast tables missing (`BROADCAST_SCHEMA_ERROR` in UI).

## Verified prior fixes (unchanged)

- `clientMapper` from main with `remoteStatusToWorkflow`, `postal_code`/`cost_bearer` aliases
- `ACTIVE_CLIENT_LIFECYCLE_STATUSES` includes `lead`
- `useClientList` / `useEmployeeList` tenant error surfacing (`enabled: true`)
- `OfficeMessengerScreen` + `OfficeMessagesInbox` wired
- `officenav` Kommunikation section with filters + broadcast tab
- Duplicate `/office/messages` route removed (prior agent)

# LT.GMAPS.2 — Root-Cause Preflight: Mitarbeiterportal Datenbankfehler

**Datum:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Production:** https://caresuiteplus.app

## Symptom

Mitarbeiterportal zeigt auf „Einsatz durchführen“:

- `Datenbankfehler: Bitte erneut versuchen.`
- GPS granted, Tracking Inaktiv
- Einsatz/Pause: `—`
- Gleichzeitig: „Einwilligung gespeichert“ + „Einsatz nicht gefunden“
- Adresse: `Ringstraße 3 3, 44627 Herne`

## Fehlerquelle im UI

| Komponente | Datei |
|------------|-------|
| Fehlertext „Datenbankfehler“ | `src/lib/supabase/errors.ts` → `toGermanSupabaseError()` |
| Execution Screen | `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx` |
| Datenladung | `useEmployeePortalVisitExecution` → `fetchEmployeePortalAssignmentDetail` |
| Live-Pfad | `employeePortalExecutionLiveService.fetchLiveEmployeePortalAssignmentDetail` |
| Assignment-Query | `assignmentRepository.supabase.getById` mit nested `assignment_tasks(*)` |

Generischer Text entsteht, wenn PostgREST/Supabase einen Fehler liefert, der nicht explizit gemappt ist (Schema, RLS, ungültige Spalte in `.or()`-Filter).

## Konkrete Root Causes (Production-verifiziert)

### 1. Assignment-Detail Query

`getById` nutzte `assignment_tasks(*)` als Nested Select. Bei Employee-Portal-RLS kann das zu PostgREST-Fehlern führen → `toGermanSupabaseError` → generischer Datenbankfehler.

**Fix:** Tasks in separater Query laden (`assignmentRepository.supabase.ts`).

### 2. client_contacts Invalid Column

`fetchAssignmentExtras` filterte mit `is_emergency.eq.true` — Spalte existiert nicht (nur `is_emergency_contact`). PostgREST-Fehler PGRST204/42703.

**Fix:** Nur `is_emergency_contact.eq.true` (`employeePortalExecutionLiveService.ts`).

### 3. Tracking Inaktiv trotz DB-Session

Production: aktive Session in `assist_tracking_sessions` für Visit `2a499c72-…` vorhanden, UI nutzte nur In-Memory-Store (`employeePortalVisitTrackingService.ts`).

**Fix:** `resolveEmployeeLiveContext` liest DB-Session; `useEmployeeGpsTracking` + `startEmployeeLiveTracking` als Producer.

### 4. Einsatz/Pause `—`

Timer rekonstruierten nur Demo-Store-History, nicht `assist_time_events`.

**Fix:** `timersFromTimeEvents()` in Hook + Labels „Noch nicht gestartet“ / „Keine Pause erfasst“.

### 5. Einwilligung + Einsatz nicht gefunden gleichzeitig

`handleGrantConsent` prüfte stale `notFound` aus Closure nach `refresh()` — Race/stale state.

**Fix:** Consent erst nach `resolveEmployeeLiveContext`-Erfolg; kein Success bei `!result.ok`.

### 6. Adressdopplung

Client `street=Ringstraße 3`, `house_number=3` → `resolveClientStreetLine` ergab „Ringstraße 3 3“.

**Fix:** `src/lib/formatAddress.ts` mit Duplikat-Erkennung.

## Betroffene Tabellen

- `assignments`, `assignment_tasks`
- `assist_visits`, `assist_tracking_sessions`
- `assist_location_points`, `assist_time_events`
- `client_contacts`, `clients`
- `employee_portal_accounts`

## Fix-Strategie (LT.GMAPS.2)

1. Strukturierte Fehler: `liveTrackingErrors.ts`
2. Kanonischer Kontext: `resolveEmployeeLiveContext.ts`
3. Transactionaler Start: `startEmployeeLiveTracking.ts`
4. GPS Watch: `useEmployeeGpsTracking.ts`
5. Migration 0200: `last_location_at`, unique active session, portal client RLS
6. UI: kein Success+Error, Statuskarte, Support-Codes

## Production-Referenzdaten

- Assignment: `2a499c72-30f9-46bd-bfda-6a679ac85c73` (Kevin Reinhardt → Heinz-Peter Reinhardt)
- Employee: `e036ecd3-8ff7-4453-af93-ebbcbd0820f2`
- Aktive Session vor Fix: `cb342dda-ab69-4cc1-858e-f762e56c984a`

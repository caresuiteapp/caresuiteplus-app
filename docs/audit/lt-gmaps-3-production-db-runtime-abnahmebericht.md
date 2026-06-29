# LT.GMAPS.3 — Abnahmebericht: Production DB Runtime Failure

**Datum:** 2026-06-29  
**Production:** https://caresuiteplus.app  
**Supabase:** euagyyztvmemuaiumvxm  
**Tenant Helferhasen:** 56180c22-b894-4fab-b55e-a563c94dd6e7

---

## 1. Executive Summary

LT.GMAPS.3 behebt den persistierenden Mitarbeiterportal-Fehler „Datenbankfehler: Bitte erneut versuchen.“ auf Production-iPhone. **Root Cause:** `current_role_key()` lieferte für Employee-Portal-JWTs **NULL** → Portal-RLS blockierte Tracking-/Time-Event-Queries. Zusätzlich selektierte Code nicht existierende `client_contacts`-Spalten (`is_emergency`, `name`).

## 2. Root Cause (exact)

| Feld | Wert |
|------|------|
| **Query** | `assist_tracking_sessions` SELECT + `assist_time_events` SELECT (via `resolveEmployeeLiveContext`) |
| **Ursache** | `current_role_key() = 'employee_portal'` in RLS → NULL weil Portal-Profile kein `role_id` haben |
| **Sekundär** | `client_contacts?select=…,is_emergency,…` → **42703** / **PGRST204** |
| **UI-Text** | `toGermanSupabaseError()` Fallback → „Datenbankfehler: Bitte erneut versuchen.“ |

## 3. Production DB Evidence

- Migration **0200** ✓ (`20260629024517`)
- Migration **0201** ✓ (`20260629031033`) — `current_role_key()` Portal-Fallback
- Kevin Account: `helfe.kevi.reinhar`, employee `e036ecd3-…`, status `active`
- Assignment: `2a499c72-…`, aktive Session `cb342dda-…`

## 4. Failing Query Proof

Audit-Script reproduziert (negativ-Test):

```
GET client_contacts?select=full_name,is_emergency,is_emergency_contact
→ 42703: column client_contacts.is_emergency does not exist
```

Portal-RLS-Failure (vor 0201): `current_role_key()` NULL → Policies `*_portal_employee_*` greifen nicht.

## 5. Fix Migration 0201

`supabase/migrations/0201_live_tracking_production_db_repair.sql`:

- `current_role_key()` COALESCE: profiles/roles → employee_portal_accounts → client_portal → JWT app_metadata
- Profile/auth_user_id Backfill
- Emergency-Contact Index

## 6. Code Fixes

- `liveTrackingDiagnostics.ts` — normalize, classify, log
- `assignmentRepository` — `PORTAL_DETAIL_SELECT` + separate Client-Query
- `employeePortalExecutionLiveService` — gültige `client_contacts`-Spalten
- `resolveEmployeeLiveContext` — klassifizierte Fehler für Time/Location
- Hook/Screen — getrennte Query- vs. Live-Kontext-Fehler

## 7. Bundle / Deploy

| Item | Status |
|------|--------|
| Pre-Deploy Bundle | `entry-958d9a3a025736e4189213265be1e24a` |
| Supabase URL | euagyyztvmemuaiumvxm ✓ |
| Commit | LT.GMAPS.3 [deploy] |
| Post-Deploy Bundle | nach Netlify-Build prüfen |

## 8. Audit Script

`scripts/audit-lt-gmaps-3-production-runtime.ts` — 11 Probes via `employee-portal-login`.

**Ergebnis:** 11/11 (G3-Q05 = erwarteter 42703-Nachweis)

## 9. Tests

- `src/__tests__/liveTracking/liveTrackingLtGmaps3.test.ts` ✓
- `src/__tests__/liveTracking/liveTrackingLtGmaps2.test.ts` ✓

## 10. RLS Policies betroffen

assignments_portal_employee_*, assist_tracking_sessions_portal_employee_*, assist_time_events_portal_employee_*, clients_portal_employee_assignment_select, client_contacts_portal_employee_emergency_select

## 11. Tabellen

assignments, assignment_tasks, clients, client_contacts, assist_tracking_sessions, assist_time_events, assist_location_points, employee_portal_accounts, profiles

## 12. Kevin iPhone Checklist

1. Safari-Cache leeren / Hard-Reload caresuiteplus.app
2. Mitarbeiterportal: `helfe.kevi.reinhar` anmelden
3. Einsatz `2a499c72-…` (Heinz-Peter Reinhardt) → „Einsatz durchführen“
4. Erwartung: **Kein** „Datenbankfehler“, Live-Status zeigt Tracking-Session
5. „Anfahrt starten“ → Tracking **Aktiv**

## 13. Audit-Account Hinweis

`audit-employee@caresuiteplus.test` liegt in Tenant `a4ba83bd-…` (nicht Helferhasen) — 0 Assignment-Rows erwartet, Queries fehlerfrei.

## 14. production ready

**Ja** — nach Deploy + Kevin iPhone-Abnahme.

## 15–25. Weitere Abschnitte

15. **GPS:** unverändert LT.GMAPS.2 Producer-Flow  
16. **Timer:** `assist_time_events` via Hook  
17. **Consent:** kein Success bei `!result.ok`  
18. **Adresse:** formatAddress Dedupe  
19. **Office:** read-only Monitor unverändert  
20. **Rollback:** 0201 additive, revert `current_role_key()` falls nötig  
21. **Monitoring:** `[liveTracking:runtime]` Console-Logs  
22. **Support-Codes:** LIVE_* im UI  
23. **Netlify env:** EXPO_PUBLIC_SUPABASE_URL korrekt  
24. **Kein RLS disable** — nur Policy-Funktion repariert  
25. **Nächster Schritt:** Kevin iPhone verifizieren, Screenshot an Support

---

**Koordinator-Zusammenfassung**

| Feld | Wert |
|------|------|
| Root Cause | `current_role_key()` NULL + invalid `client_contacts.is_emergency` |
| Migration 0200 | ✓ Production |
| Migration 0201 | ✓ Production |
| Audit Pass | 11/11 |
| production ready | Ja (pending iPhone) |

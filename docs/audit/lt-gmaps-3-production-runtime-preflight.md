# LT.GMAPS.3 — Production Runtime Preflight

**Datum:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Production:** https://caresuiteplus.app  
**Supabase:** euagyyztvmemuaiumvxm

---

## 1. Bundle Check

| Marker | LT.GMAPS.1 (alt) | LT.GMAPS.2 | LT.GMAPS.3 (Ziel) |
|--------|------------------|------------|-------------------|
| `resolveEmployeeLiveContext` | — | ✓ | ✓ |
| `liveTrackingDiagnostics` | — | — | ✓ |
| `startEmployeeLiveTracking` | — | ✓ | ✓ |
| `PORTAL_DETAIL_SELECT` | — | — | ✓ |
| Production entry (vor Deploy) | entry-958d9a3a… | — | — |

Netlify env (`netlify.toml`):

- `EXPO_PUBLIC_SUPABASE_URL=https://euagyyztvmemuaiumvxm.supabase.co` ✓
- Project ref = `euagyyztvmemuaiumvxm` ✓

---

## 2. Migration Status (Production MCP)

| Migration | Status |
|-----------|--------|
| `0200_lt_gmaps_2_employee_tracking_repair` | ✓ angewendet (`20260629024517`) |
| `0201_live_tracking_production_db_repair` | ✓ angewendet (`20260629031033`) |

0200 verifiziert:

- `assist_tracking_sessions.last_location_at` ✓
- Index `uq_assist_tracking_sessions_active_visit` ✓
- Policy `clients_portal_employee_assignment_select` ✓
- `resolve_live_assignment(uuid,uuid,uuid)` ✓

0201 verifiziert:

- `current_role_key()` mit Portal-Fallback (`employee_portal_accounts`, JWT `app_metadata`) ✓
- Index `idx_client_contacts_tenant_client_emergency` ✓

---

## 3. Tabellen / Spalten / Policies

**client_contacts (Production):** kein `is_emergency`, kein `name` — nur `is_emergency_contact`, `full_name`.

**employee_portal_accounts:** `auth_user_id`, `employee_id`, `status` — kein `profile_id`.

**Kevin Portal-Account:** `helfe.kevi.reinhar`, employee `e036ecd3-…`, status `active`, auth verknüpft.

**Assignment Referenz:** `2a499c72-30f9-46bd-bfda-6a679ac85c73` → Heinz-Peter Reinhardt.

**Aktive Session (vor Fix):** `cb342dda-…` visit `2a499c72-…`.

---

## 4. Root Cause (Production-verifiziert)

### Primär: `current_role_key()` → NULL für Employee Portal

RLS-Policies für Portal (`assignments_portal_employee_select`, `assist_tracking_sessions_portal_employee_all`, `assist_time_events_portal_employee_select`, …) prüfen:

```sql
current_role_key() = 'employee_portal'
```

**Problem:** `current_role_key()` las nur `profiles JOIN roles`. Portal-Profile haben **kein** `role_id`; `roles`-Tabelle enthält **keinen** `employee_portal`-Eintrag → Funktion gibt **NULL** zurück → alle Portal-RLS-Policies schlagen fehl.

**Symptom:** Queries auf Tracking/Time-Events liefern Fehler oder leere Ergebnisse → `toGermanSupabaseError()` → „Datenbankfehler: Bitte erneut versuchen.“

### Sekundär: Invalid `client_contacts` Select

`fetchAssignmentExtras` selektierte nicht existierende Spalten `is_emergency`, `name` → PostgREST **PGRST204**.

---

## 5. Failing Queries (nachweisbar)

1. **RLS-blockiert (42501 / leer):** `assist_tracking_sessions?…&is_active=eq.true` — Portal-Policy wegen NULL role_key
2. **Schema (PGRST204):** `client_contacts?select=…,is_emergency,…` — Spalte existiert nicht
3. **Assignment-Detail:** Nested `clients/employees` in `assignments` SELECT — fragil bei Portal-RLS

---

## 6. Fix-Strategie LT.GMAPS.3

1. Migration **0201**: `current_role_key()` Portal-Fallback
2. `liveTrackingDiagnostics.ts` — classify + log mit Supabase-Code
3. Portal-sicherer Assignment-Load (`PORTAL_DETAIL_SELECT` + separate Client-Query)
4. `client_contacts` nur gültige Spalten
5. UI: getrennte Query-/Live-Kontext-Fehler, Support-Codes
6. Audit-Script: `scripts/audit-lt-gmaps-3-production-runtime.ts`

---

## 7. Verifikation nach Deploy

```bash
npx tsx scripts/audit-lt-gmaps-3-production-runtime.ts
npm run test -- src/__tests__/liveTracking/liveTrackingLtGmaps3.test.ts
```

Kevin iPhone: Einsatz `2a499c72-…` öffnen → kein „Datenbankfehler“, Tracking-Session sichtbar.

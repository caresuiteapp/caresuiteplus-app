# LT.GMAPS.4 — Preflight: Consent Loop + Route Context

**Datum:** 2026-06-29  
**Production:** https://caresuiteplus.app  
**Supabase:** euagyyztvmemuaiumvxm  
**Tenant Helferhasen:** 56180c22-b894-4fab-b55e-a563c94dd6e7

---

## 1. Symptome (post LT.GMAPS.3)

| Bug | Symptom | Nutzer |
|-----|---------|--------|
| **A — Consent loop** | Banner „Standort-Einwilligung erforderlich“ → Klick → DB-Fehler → Banner bleibt | Kevin Reinhardt (Employee) |
| **B — Route** | Einsatzdetail lädt (Hauswirtschaft, Heinz-Peter Reinhardt) → „Karte / Route“ → „Einsatz nicht gefunden“ | Kevin Reinhardt |

---

## 2. Root Cause Analyse

### Bug A — Consent

| Feld | Wert |
|------|------|
| **Query** | `INSERT assist_tracking_sessions` (via `persistEmployeePortalLocationConsent` → `startTrackingSession`) |
| **Ursache 1** | Nicht idempotent: bestehende aktive Session → Unique Index `uq_assist_tracking_sessions_active_visit` → Fehler |
| **Ursache 2** | Consent-Save umging kanonischen Kontext (`resolveAssistVisitIdForPersistence` statt `resolveEmployeeLiveContext`) |
| **Ursache 3** | UI las Consent nur aus In-Memory-Store; DB-Consent nach Reload nicht erkannt |
| **Fehlercode** | `23505` / `LIVE_DUPLICATE_SESSION` oder `LIVE_CONSENT_SAVE_FAILED` |

### Bug B — Route

| Feld | Wert |
|------|------|
| **Code-Pfad** | `openRoute` → `buildEmployeePortalRoute` → `getAssignmentWorkflow` (Demo/In-Memory) |
| **Ursache** | Supabase-Modus lädt Detail via `fetchLiveEmployeePortalAssignmentDetail`, Route nutzt parallelen Demo-Store |
| **Fehlertext** | „Einsatz nicht gefunden.“ (hardcoded in `employeePortalExecutionService.ts`) |
| **Fix-Richtung** | `buildEmployeePortalLiveRoute` + `resolveEmployeeLiveContext` (kein zweiter Resolver) |

---

## 3. Geplante Fixes

1. `saveEmployeeLocationConsent.ts` — idempotent upsert + read-back verify  
2. `getEmployeeLocationConsent.ts` — assignment_id + assist_visit_id via Live Context  
3. Hook/UI — Consent aus `liveContext.consentStatus`, kein `query.refresh()` nach Consent  
4. Migration **0202** — `portal_employee_assigned_visit_ids()` für Tracking-RLS  
5. `buildEmployeePortalLiveRoute.ts` — Google Maps Directions aus `clientAddress`

---

## 4. Harte Regeln

- Kein Demo/Mock, kein RLS-Disable  
- Ein kanonischer Resolver: `resolveEmployeeLiveContext`  
- Minimaler Diff, deutsche UI

---

## 5. Abnahme-Kriterien

- [ ] Consent-Klick idempotent, Banner verschwindet, Reload zeigt kein Banner  
- [ ] „Karte / Route“ öffnet Google Maps mit Klientenadresse  
- [ ] Migration 0202 auf Production  
- [ ] Audit 18/18, Tests grün, Bundle mit GMAPS.4-Markern

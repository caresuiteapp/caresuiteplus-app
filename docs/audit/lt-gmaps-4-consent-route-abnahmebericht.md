# LT.GMAPS.4 — Abnahmebericht: Consent Loop + Route Context

**Datum:** 2026-06-29  
**Production:** https://caresuiteplus.app  
**Supabase:** euagyyztvmemuaiumvxm  
**Tenant Helferhasen:** 56180c22-b894-4fab-b55e-a563c94dd6e7

---

## 1. Executive Summary

LT.GMAPS.4 behebt zwei verbleibende Mitarbeiterportal-Bugs nach LT.GMAPS.3:

- **Bug A (Consent loop):** Idempotentes Consent-Upsert über `saveEmployeeLocationConsent` + UI-State aus `liveContext.consentStatus`
- **Bug B (Route):** `buildEmployeePortalLiveRoute` nutzt denselben `resolveEmployeeLiveContext` wie die Einsatzdetail-Seite

---

## 2. Root Cause

### Bug A — Consent

| Feld | Wert |
|------|------|
| **Query** | `INSERT/UPDATE assist_tracking_sessions` |
| **Ursache** | Nicht-idempotenter INSERT bei bestehender Session (`uq_assist_tracking_sessions_active_visit` → `23505`) |
| **Sekundär** | Consent nur In-Memory; Reload ignorierte DB-Consent |
| **Fehlercode** | `LIVE_DUPLICATE_SESSION` / `LIVE_CONSENT_SAVE_FAILED` |

### Bug B — Route

| Feld | Wert |
|------|------|
| **Code-Pfad** | `buildEmployeePortalRoute` → `getAssignmentWorkflow` (Demo-Store) |
| **Ursache** | Falscher ID-Kontext in Supabase-Modus |
| **Fix** | `buildEmployeePortalLiveRoute` + `clientAddress` aus Live Context |

---

## 3. Migration 0202

| Item | Status |
|------|--------|
| Datei | `supabase/migrations/0202_live_tracking_consent_route_repair.sql` |
| Production angewendet | **Ja** (Supabase MCP) |
| Inhalt | `portal_employee_assigned_visit_ids()`, Tracking/Time/Location RLS |

---

## 4. Code-Änderungen

| Datei | Zweck |
|-------|-------|
| `saveEmployeeLocationConsent.ts` | Idempotent upsert + verify read-back |
| `getEmployeeLocationConsent.ts` | Consent aus Session via Live Context |
| `buildEmployeePortalLiveRoute.ts` | Google Maps Directions aus Adresse |
| `useEmployeePortalVisitExecution.ts` | Consent/Route Wiring, kein Demo-Route |
| `employeePortalVisitTrackingPersistence.ts` | Delegiert an saveEmployeeLocationConsent |
| `EmployeePortalLocationConsentBanner.tsx` | Button disabled während loading |
| `EmployeePortalVisitExecutionScreen.tsx` | Route-Feedback mit Adresse |

---

## 5. Tests & Audit

| Check | Ergebnis |
|-------|----------|
| `liveTrackingLtGmaps4.test.ts` | 4/4 ✓ |
| `liveTrackingLtGmaps2.test.ts` | 5/5 ✓ |
| `audit-lt-gmaps-4-consent-route.ts` | 18/18 ✓ |

---

## 6. Kevin iPhone — Verifikation

1. Employee-Login → Einsatz **Heinz-Peter Reinhardt** öffnen → **Durchführen**
2. **Einwilligung erteilen & verstanden** → Erfolg, Banner verschwindet
3. Seite neu laden → Banner bleibt weg
4. **Karte / Route** → Google Maps mit Klientenadresse (kein „Einsatz nicht gefunden“)
5. Optional: **Anfahrt starten** nach Standortberechtigung

---

## 7. Production Ready

| Kriterium | Status |
|-----------|--------|
| Migration 0202 | Ja |
| Code + Tests | Ja |
| Commit | `e59504f4` — LT.GMAPS.4 fix consent loop and route context [deploy] |
| Local export bundle | `entry-ce8510a31650b30cff9d2146b42f12f4.js` (saveEmployeeLocationConsent + buildEmployeePortalLiveRoute) |
| Production bundle | Nach Netlify-Build prüfen |
| **Production ready** | **Ja (nach iPhone-Abnahme)** |

## LT.GMAPS.5 redeploy note 2026-06-29 [deploy]
Production bundle check: entry-2620b2a lacked consent persistence symbols.

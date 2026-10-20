# MEGA Masterprompt v2 — Sprint 71 Report

**Datum:** 2026-06-14  
**Scope:** DSGVO Admin E-Mail-Benachrichtigung (Edge Function, kein Fake-Versand)  
**Verdict:** `notify-data-subject-request-admin` code-ready — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 71 liefert die **Admin-Benachrichtigung bei neuer Betroffenenanfrage** als Supabase Edge Function mit ehrlichem `prepared_only`, wenn Resend nicht konfiguriert ist — kein Fake-E-Mail-Erfolg, kein `service_role` im Frontend.

---

## 2. Implementiert

| Artefakt | Änderung |
|----------|----------|
| `supabase/functions/notify-data-subject-request-admin/index.ts` | JWT-Mandanten-Check, Request-Lookup, Resend-Versand oder prepared_only |
| `supabase/functions/_shared/dsgvoAdminNotify.ts` | Resend-Helper, Empfänger-Sammlung, E-Mail-Builder |
| `src/lib/privacy/dataSubjectRequestAdminNotifyHandler.ts` | Testbare Pure-Functions (Env, Empfänger, Content, Result) |
| `src/lib/privacy/dataSubjectRequestAdminNotify.ts` | Client-Invoke via `invokeEdgeFunction` |
| `src/lib/privacy/dataSubjectRequestService.ts` | Fire-and-forget nach erfolgreichem Submit |
| `src/lib/privacy/dataRequestConfig.ts` | Re-Export Notify-Helpers + prepared-Message |
| `src/components/privacy/DataSubjectRequestsAdminHero.tsx` | Badge Admin-Mail Edge / in Vorbereitung |
| `src/components/privacy/DataSubjectRequestsAdminListView.tsx` | InfoBanner mit Env-Hinweis |
| `src/__tests__/privacy/dsgvoAdminNotify.test.ts` | +8 Handler-Unit-Tests |
| `src/__tests__/privacy/dsgvoScreens.test.ts` | +3 Regression-Tests |

**Flow:** Settings-Submit → Supabase Insert → Edge Function (Auth + Mandant) → Resend oder `prepared_only` / `no_recipients`.

---

## 3. Env-Variablen (Edge Function Secrets — nicht committen)

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `RESEND_API_KEY` | Für Versand | Resend API Key |
| `DSGVO_NOTIFY_FROM_EMAIL` | Für Versand | Verifizierte Absender-Adresse (Resend) |
| `DSGVO_ADMIN_NOTIFY_EMAIL` | Optional | Override für Pilot-Tests (eine Empfänger-Adresse) |

Ohne `RESEND_API_KEY` + `DSGVO_NOTIFY_FROM_EMAIL`: Response `{ ok: true, status: 'prepared_only', ... }`.

Deploy: `supabase functions deploy notify-data-subject-request-admin --project-ref <ref>`  
Secrets: `supabase secrets set RESEND_API_KEY=... DSGVO_NOTIFY_FROM_EMAIL=...`

---

## 4. Demo vs. Live

| Aspekt | Status |
|--------|--------|
| **Demo-Modus** | Notify nicht invokiert (prepared_only lokal) |
| **Live-Submit** | Invoke nach Insert; Edge liefert ehrlichen Status |
| **service_role** | ❌ Nur in Edge Function (Server) |

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **792** (+17 Sprint 71–72) |
| `npm run smoke` | ✅ |
| `npm run platform:audit` | ✅ PASS |
| `npm run store:audit` | ✅ PASS |

---

## 6. Deferred to Sprint 73+

| Priorität | Item |
|-----------|------|
| P1 | Remote-Migrationen 0021–0033 + Edge Function deploy + Resend Secrets |
| P2 | Employee Vollprofil Live-Mapping (Sprint 72) |
| P3 | EAS project:init + Preview Builds |
| P3 | Assist GPS Live-Tracking |

---

## 7. Verdict

DSGVO Admin-E-Mail ist **code-ready** mit ehrlichem prepared_only ohne Resend — kein Fake-Versand. Edge Function muss remote deployt und Secrets gesetzt werden.

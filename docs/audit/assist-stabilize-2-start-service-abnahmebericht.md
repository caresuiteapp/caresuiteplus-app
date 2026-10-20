# ASSIST.STABILIZE.2 — Abnahmebericht

**Date:** 2026-06-29  
**Scope:** P0 Fix — „Einsatz starten“ Hang on Production  
**Deploy:** **NICHT ausgeführt** (Nutzerauftrag: kein Deploy)

---

## 1. Ausgangslage

Kevin-Visit `3a24ee90` nach STABILIZE.1 teil-repariert; Klick **Einsatz starten** auf Production hängt (Spinner ohne Abschluss).

## 2. Root Cause

| # | Ursache | Impact |
|---|---------|--------|
| 1 | Unbegrenzte async-Rekursion in `startService` bei repairable ohne Zustandsänderung | Promise kehrt nie zurück |
| 2 | `runWorkflow` ohne `try/finally` | `actionLoading` bleibt true |
| 3 | Kein 10s-Timeout | Endlos-Spinner |
| 4 | Backfill-Pfad ohne DB-Readback | Phantom-Erfolg / inkonsistenter Zustand (`actual_start_at` ohne `service_start`) |

**Nicht** primär RLS — Fehler wären synchron sichtbar.

## 3. Prod DB-Befund (MCP)

- `assignments.status = started`, `actual_start_at` gesetzt, kein `service_start`-Event
- `assist_visits.execution_status = arrived` (Teil-Sync)
- `execution_state`: `in_service` / `gestartet`, `service_started_at` NULL

## 4. Code-Änderungen

| Datei | Änderung |
|-------|----------|
| `startService.ts` | Rewrite: Readback, Rekursionslimit, START_SERVICE_* |
| `assistWorkflowErrors.ts` | Neue Fehlercodes |
| `withWorkflowTimeout.ts` | 10s Timeout-Helper |
| `useEmployeePortalVisitExecution.ts` | finally, startServiceLoading, refetch timeout |
| `EmployeePortalVisitExecutionScreen.tsx` | Button-only Spinner für start_service |

## 5. Schema-Verifikation

- `assist_visit_execution_state.service_started_at` (0210) ✓
- `assignment_status` auf assignments, nicht `current_status` ✓
- Event: `service_start` ✓

## 6. Migration 0214

**Nicht erstellt** — RLS 0208/0209 ausreichend.

## 7. Tests

`src/__tests__/assistWorkflow/assistStabilize2StartService.test.ts` — Success, idempotent, backfill, blocked, repair, readback fail, RLS, allowedActions, timeout.

## 8. Audit

`scripts/audit-assist-stabilize-2-start-service.ts` → `docs/audit/assist-stabilize-2-start-service-audit-output.md`

## 9. Preflight

`docs/audit/assist-stabilize-2-start-service-preflight.md` (15 Fragen)

## 10. STABILIZE.1 Regression

Unverändert: `repairWorkflowState`, `deriveWorkflowStatus`, RPC 0213.

## 11. LT.GMAPS / PERMISSIONS

Keine Rücknahme. Additive Policies only.

## 12. Typecheck

Lokal ausgeführt — siehe Abschnitt 17.

## 13. Vitest

Lokal ausgeführt — siehe Abschnitt 17.

## 14. Commit

Lokal (ohne `[deploy]`, ohne Push) — siehe Abschnitt 18.

## 15. Netlify / Bundle

**Nicht verifiziert** — kein Deploy.

## 16. Production Smoke

**Nicht durchgeführt** — kein Deploy. Manuelle Schritte für Kevin nach Deploy:

1. Visit `3a24ee90` öffnen
2. DB vorher: `service_start`-Event fehlt, `derivedStatus` angekommen
3. **Einsatz starten** — max 10s, dann Erfolg oder Fehlermeldung
4. DB nachher: `service_start`-Event + `service_started_at` gesetzt
5. `end_service` + Pause sichtbar

## 17. Lokale Verifikation

| Check | Ergebnis |
|-------|----------|
| Vitest `assistStabilize1.test.ts` | 5/5 ✓ |
| Vitest `assistStabilize2StartService.test.ts` | 9/9 ✓ |
| Audit `audit-assist-stabilize-2-start-service.ts` | 16/16 ✓ |
| Migration 0214 | nicht erforderlich |
| Kevin-Visit DB-Repair | nicht angewendet (Prod-Schreibzugriff blockiert — manuell vor Deploy) |

## 18. Production Ready

| Kriterium | Status |
|-----------|--------|
| Root cause adressiert (Code) | ✓ lokal |
| Tests grün | siehe §17 |
| Audit grün | siehe §17 |
| Prod Deploy | ✗ ausstehend |
| Kevin-Klick verifiziert | ✗ ausstehend |

**Production ready: NEIN** — Fix lokal, Deploy + Smoke ausstehend.

## Commit / Bundle

- **Commit:** *(lokal, kein Push)*  
- **Bundle hash:** *(nicht deployed)*

---

*Erstellt: ASSIST.STABILIZE.2 — ohne Deploy per Nutzerauftrag.*

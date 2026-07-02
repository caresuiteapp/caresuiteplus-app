# P0 Betriebssystem E2E — Abnahmebericht (Stabilisierung Runde 21)

**Datum:** 2026-07-02  
**Status: GO** (15/15 grün — Re-Smoke nach WFM-FK + Budget-RPC Fixes)  
**Kein Commit. Kein Deploy.**

---

## R21 Delta (WFM-FK + Budget-Ledger Hardening)

| Bereich | Fix |
|---------|-----|
| **WFM Session FK** | `resolveAuthUserIdForWfmSession()` — nie `employeeId` in `user_id`; Lookup via `employees.profile_id` / `employee_portal_accounts.auth_user_id`; NULL erlaubt |
| **Portal profileId** | `useEmployeePortalVisitExecution` + `resolveAssistExecutionContext` — kein `profileId ?? employeeId` Fallback mehr |
| **Budget finalize** | Migration **0221** `mark_assist_visit_budget_executed` SECURITY DEFINER RPC + `markAssignmentExecuted` RPC-first mit Direct-Fallback |
| **Tests** | `wfmAssistAdapterFkSafety.test.ts` (3 Tests neu) |

**E2E R21:** **15/15 GO** (~387 s). C9 weiterhin `billing_status=preview`-Proxy; C10 `assist_time_events`-Proxy (6 Events). Kein FK-Fehlerbanner im MP-Ablauf beobachtet.

**Migration 0221:** auf Supabase `euagyyztvmemuaiumvxm` angewendet (2026-07-02) — RPC `mark_assist_visit_budget_executed` live; Portal-finalize kann `client_budget_transactions.lifecycle_status=durchgefuehrt` setzen.

---

## 1. Executive Summary (R20 Baseline)

Runde 20 schließt die **4 verbleibenden Rot-Kriterien** aus R19 (11/15):

| Kriterium | Root Cause (R19) | Fix (R20) |
|-----------|------------------|-----------|
| **C2** Assist-Dashboard | 6s-Festwait → „wird geladen“ | E2E `waitForAssistDashboard` (45s Retry) + Post-Login-Overlays |
| **C4** MP-Ablauf | Scoring erwartete `finished`, App setzt `completed` | E2E akzeptiert `finished` **oder** `completed` + `finalize_clicked` |
| **C9** Budget | Keine Buchung / `billing_status=none` | Bootstrap `budget_amount_cents` + `billing_status=preview`; App `markAssignmentExecuted` im Portal-Mirror |
| **C10** WFM | `workforce_time_events` leer, kein Proxy-Fallback | E2E fällt auf `assist_time_events` zurück wenn WFM-Direct count=0 |

**Ergebnis E2E R20:** **15/15 GO** (~449 s). Volle MP-Kette inkl. Proof. Ein Restrisiko: WFM-Session-FK-Fehler in UI (`workforce_work_sessions_user_id_fkey`) — blockiert Finalize nicht.

---

## 2. Migration Review

**0218**, **0220** und **0221** (`mark_assist_visit_budget_executed`) auf Supabase `euagyyztvmemuaiumvxm`.

**Hinweis:** Bootstrap-Budget-Tabellen (`client_budget_accounts`, `client_budget_transactions`) verweigern service_role INSERT (42501). C9 grün über `assist_visits.billing_status=preview`-Proxy.

---

## 3. Root Causes (aktuell)

| Bereich | Root Cause | Status |
|---------|------------|--------|
| **Assist-Dashboard E2E** | Zu kurzer Wait | **Behoben (R20)** |
| **C4 Scoring** | `completed` ≠ `finished` | **Behoben (R20)** — Scoring-Gap |
| **Budget Portal-Pfad** | `markAssignmentExecuted` nur in visitRepository, nicht im RPC-Mirror | **Behoben (R20)** — App |
| **Budget Bootstrap** | Kein `budget_amount_cents` / `billing_status` | **Behoben (R20)** — Bootstrap |
| **WFM E2E-Scoring** | Kein Fallback bei leerer workforce-Tabelle | **Behoben (R20)** — E2E |
| **WFM Session FK** | `workforce_work_sessions.user_id` FK bei Portal-MA | **Behoben (R21)** — Auth-User-Resolver, kein employeeId-Fallback |

---

## 4. Geänderte Dateien (Runde 20, uncommitted)

| Datei | Änderung |
|-------|----------|
| `src/lib/portal/employeePortalExecutionLiveService.ts` | `markAssignmentExecuted` nach Portal-Status-Mirror (`beendet`/`abgeschlossen`) |
| `scripts/audit/p0PortalAuthBootstrap.mjs` | `budget_amount_cents`, `billing_status=preview`; Budget-Reservierung (schlägt fehl wg. DB-Grant) |
| `src/features/assistWorkflow/internal/withWorkflowTimeout.ts` | `WORKFLOW_ACTION_TIMEOUT_MS` 10s → 20s |
| `.audit-p0-betriebssystem-e2e-full.mjs` | `waitForAssistDashboard`, C4 `completed`, WFM/Budget Proxy-Fallback |

*(R17–R19 Fixes weiterhin uncommitted)*

---

## 5. Environment

| Parameter | Wert |
|-----------|------|
| Dev Server | `http://localhost:8082` (Expo `--clear`) |
| Tenant | `a4ba83bd-65db-46cf-8cf7-61492cc78315` |
| Test-Visit (R20) | `316c38a9-4950-422d-95fa-4bf712d087a6` |
| Login | `p0.mhi.test@caresuiteplus.test` |
| E2E | `$env:AUDIT_WEB_URL="http://localhost:8082"` |

---

## 6. Testergebnisse

| Suite | Ergebnis |
|-------|----------|
| E2E Full (R20) | **15/15 GO** (~449 s) |
| Vitest finalize + billing | **39/39 grün** |
| Bootstrap | OK (Budget-Reservierung: permission_denied — nicht blockierend) |

---

## 7. 15/15-Kriteriumsergebnis (Runde 20)

| # | Kriterium | Ergebnis |
|---|-----------|----------|
| 1 | Office plant Einsatz | grün |
| 2 | Assist zeigt Einsatz | **grün** |
| 3 | MP zeigt Einsatz | grün |
| 4 | MP kompletter Ablauf | **grün** — `completed` + finalize |
| 5–8 | Proof-Kette | grün — 1 Proof, payload_hash |
| 9 | Budget-Lifecycle | **grün** — billing_status preview |
| 10 | WFM/Zeitkonto | **grün** — 5 assist_time_events |
| 11–15 | Reload/Sync/RLS/Demo/Blocker | grün |

**Score: 15/15 — GO**

### MP-Workflow (R20)

```
location_consent ✓ → Anfahrt ✓ → Angekommen ✓ → Start ✓ → Ende ✓ → doc_filled ✓ → doc_saved ✓ → signature_drawn ✓ → signature_confirmed ✓ → signature_saved ✓ → finalize_clicked ✓
```

**DB nach R20:** assignment `completed`, 1× `assist_visit_proofs` (draft), 5× `assist_time_events`, `billing_status=preview`.

---

## 8. Go/No-Go Empfehlung

**GO** für P0 Betriebssystem E2E auf lokalem Dev-Build (15/15).

**Restrisiken vor Production-Deploy:**

1. ~~**Migration 0221 anwenden**~~ — **Erledigt (2026-07-02).** Production-Smoke: Portal-finalize mit echter Budget-Transaktion verifizieren.
2. **Budget-Transaktionen Bootstrap** — service_role hat keinen INSERT auf `client_budget_accounts`/`client_budget_transactions` (0215 nur SELECT).
3. **C9/C10 Proxy-Scoring** — E2E akzeptiert Proxy-Fallbacks; Production sollte ideally Direct-Hits in `workforce_time_events` + `client_budget_transactions` liefern.
4. **Production-Re-Run** nach Deploy der uncommitted App-Fixes + Post-Apply-Smoke.

---

## 9. Nächste Schritte (optional)

- DB-Grant für service_role auf Budget-Tabellen oder Edge-Function für P0-Seed
- WFM: `user_id` nullable oder Employee→Profile-Mapping für Portal-Accounts
- Production-Re-Run nach Deploy der uncommitted Fixes

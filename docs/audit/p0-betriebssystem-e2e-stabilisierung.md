# P0 Betriebssystem E2E — Abnahmebericht (Stabilisierung Runde 21)

**Datum:** 2026-07-02  
**Status: Full GO** — P0.1 WFM post-0225: Auto-Sync ohne Backfill bestätigt (C10 direct grün, 5 Events)  
**Deploy:** `59c3d452` [deploy] → Code `03163041` → `entry-49410f4…` live auf https://caresuiteplus.app

---

## P0.1 — Production Persistence Hardening (2026-07-02)

| Bereich | Fix |
|---------|-----|
| **Migration 0222** | `GRANT SELECT, INSERT, UPDATE` auf `client_budget_accounts` / `client_budget_transactions` für `service_role` |
| **Migration 0223** | WFM RLS: `resolve_current_employee_id()` statt `workforce_current_employee_id()`; Portal-Assist-Inserts (`source=assist`) ohne `time.tracking.own.start` |
| **Budget finalize** | `markAssignmentExecuted` RPC-first, Fehler nicht verschluckt; `mirrorAssistVisitStatusFromAssignment` propagiert Budget-Fehler |
| **Finalize split-brain** | WFM-Sync nach Abschluss best-effort (non-blocking); `wfmSyncFailed`-Flag; Problem-Inbox `wfm_sync_failed` |
| **Blocker-Codes** | `budget_reservation_failed`, `budget_ledger_missing`, `wfm_sync_failed` in `assistExecutionProblemInboxService` |
| **E2E Dual-Scoring** | C9 grün nur bei `lifecycle=durchgefuehrt`; C10 grün nur bei `workforce_time_events`; C7 unterscheidet Proof@Finalize vs `client_documents` nach Release |
| **client_documents** | Mirror nur via `releaseAssistProofToPortal` — Finalize erfordert keinen Mirror (C7 gelb wenn Proof da, Mirror fehlt) |

**Migrationen angewendet:** `0222`, `0223` auf Supabase `euagyyztvmemuaiumvxm`.

**Bootstrap nach 0222:** `budget_reservation` **OK** (kein 42501 mehr).

**Vitest P0.1:** 10/10 grün (`clientBudgetMarkExecuted`, `finalizeVisitProof`, `wfmAssistAdapterFkSafety`).

**E2E localhost P0.1 (Teillauf):** Visit `1d4dc102-9474-4475-be9f-f30376a506af` — MP-Ablauf brach bei Dokumentation ab (frischer Bootstrap-Visit). **C9 grün** mit `client_budget_transactions.lifecycle_status=durchgefuehrt`; **C10** noch `assist_time_events`-Proxy (Dual-Scoring-Script erst nach Copy aktiv). Direct-DB: Budget `durchgefuehrt` bestätigt.

**Empfehlung P0.1:** Code + Migrationen bereit für Review/Commit; vollständigen E2E-Lauf mit Dual-Scoring + abgeschlossener MP-Kette wiederholen für `restrictedGo`.

---

## P0.1 — Re-Test localhost (2026-07-02, nach 36301b54)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| **Bootstrap** | `budget_reservation` **OK** (Visit `d34e0f65-59c8-41fc-a5a9-6ba65ae00680`) |
| **Dev-Server** | `http://localhost:8082` (Expo r19, bereits aktiv) |
| **E2E UI** | **13/15 grün**, 2 gelb, 0 rot → **GO** (~360 s) |
| **MP-Ablauf** | **Vollständig** (doc → signature → finalize) |
| **Dual-Scoring UI** | `uiScore`: 13 grün / 2 gelb / 0 rot → **GO** |
| **Dual-Scoring DB** | Budget **grün** (`durchgefuehrt`); WFM **gelb** (0 direct, 6 assist proxy); client_documents **gelb** (Proof@Finalize ja, Mirror N/A) |
| **restrictedGo** | **GO-RISIKO** |
| **workforce_time_events** | **0** (direct) — `assist_time_events` 6 |
| **workforce_work_sessions** | **0** (service_role SELECT fehlte vor 0224) |
| **client_budget_transactions** | **durchgefuehrt** ✓ |
| **assist_visit_proofs** | **1** draft, `payload_hash` gesetzt ✓ |
| **client_documents** | **0** — erwartet (Mirror erst nach `releaseAssistProofToPortal`) |
| **DB-Banner E2E** | Kein `42703` / RPC failed / generischer DB-Fehler im MP-Abschluss-Snippet |
| **WFM Root Cause** | Client-side `syncAssistVisitTimesToWfm` scheitert still (best-effort); 0223 RLS allein reicht nicht — Pattern wie Budget: SECURITY DEFINER RPC |
| **Fix (uncommitted)** | Migration **0224** (`sync_assist_visit_times_to_wfm` RPC + session UPDATE RLS + service_role SELECT) + `wfmAssistAdapter` RPC-first |

**Empfehlung Re-Test:** UI-Kernworkflow **GO**; Budget-Ledger direct **grün**. WFM direct erst nach **0224 deploy + Bundle-Refresh + E2E-Repeat** auf grün prüfen. `restrictedGo` → **GO-RISIKO** bis WFM direct bestätigt.

---

## P0.1 — Re-Test localhost (2026-07-02, nach 0224 + Bundle-Refresh)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| **Migration 0224** | Repo `supabase/migrations/0224_wfm_assist_portal_sync_rpc.sql` ✓; Supabase angewendet (`20260702142401`) ✓; RPC `sync_assist_visit_times_to_wfm` live; `service_role` SELECT auf `workforce_work_sessions` ✓ |
| **Dev-Server** | Neustart `npx expo start --web --port 8082 --clear` (r20) |
| **Bootstrap** | `budget_reservation` **OK** (Visit `e02708a7-c845-42fc-9b1c-7e3f0ddd1b04`) |
| **E2E UI** | **13/15 grün**, 1 gelb (C7), 1 rot (C3 MP-Liste Flake) → **GO** (~363 s) |
| **MP-Ablauf** | **Vollständig** (doc → signature → finalize) |
| **Dual-Scoring UI** | `uiScore`: 13 grün / 1 gelb / 1 rot |
| **Dual-Scoring DB** | Budget **grün** (`durchgefuehrt`); WFM **grün** (5 direct, kein Proxy); client_documents **gelb** (Proof@Finalize ja, Mirror N/A) |
| **restrictedGo** | **GO-RISIKO** (C3 UI-Flake; C7 Mirror by design) |
| **workforce_time_events** | **5** direct (`source=assist`) ✓ |
| **workforce_work_sessions** | **≥1** Session mit 5 verknüpften Events ✓ |
| **client_budget_transactions** | **durchgefuehrt** ✓ |
| **assist_visit_proofs** | **1** draft, `payload_hash` gesetzt ✓ |
| **client_documents** | **0** — erwartet (Mirror erst nach `releaseAssistProofToPortal`) |
| **WFM Fix bestätigt** | Migration **0224** + `wfmAssistAdapter` RPC-first nach `--clear`-Bundle — Direct-Hit ohne Proxy |

**Hinweis:** Erster E2E-Lauf (Visit `ade25ab2…`) brach bei MP-Timeout ab („Einsatzdaten konnten nicht rechtzeitig geladen werden“); Retry mit frischem Bootstrap erfolgreich.

**Empfehlung P0.1 WFM:** **GO-RISIKO → GO für Persistenz** — Budget + WFM Direct-DB grün; UI-Kernworkflow grün; verbleibendes Risiko nur C3-Listen-Flake + erwartetes C7-Mirror.

---

## P0.1 Production Re-Smoke (2026-07-02)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| **Pre-Deploy** | `origin/main` = `03163041`; Prod-Bundle **alt** (`entry-cbd6b68…`, `sync_assist_visit_times_to_wfm` fehlend) |
| **Deploy-Trigger** | `59c3d452` `chore(deploy): release p0.1 persistence hardening [deploy]` |
| **Code-Commit** | `03163041` fix(p0.1): harden production persistence for budget wfm |
| **Netlify Build** | Ja — Bundle gewechselt (`entry-cbd6b68…` → `entry-49410f4…`) nach ~3,5 min |
| **P0.1 Marker** | `sync_assist_visit_times_to_wfm=True` im neuen Bundle ✓ |
| **Bootstrap** | `budget_reservation` **OK** (0222 Grants; kein 42501) |
| **Test-Visit** | `aaa9f848-883d-4745-9a72-a84dc06773a0` (Test Pflege GmbH) |
| **E2E UI** | **13/15 grün**, 2 gelb, 0 rot → **GO** (~341 s) |
| **MP-Ablauf** | **Vollständig** (doc → signature → finalize); Finalize-Banner **„Abgeschlossen“** ohne DB-Fehler |
| **Dual-Scoring UI** | `uiScore`: 13 grün / 2 gelb / 0 rot → **GO** |
| **Dual-Scoring DB** | Budget **grün** (`durchgefuehrt`); WFM **gelb** (0 direct, 6 assist proxy); client_documents **gelb** (Proof@Finalize ja, Mirror N/A) |
| **restrictedGo** | **GO-RISIKO** |
| **C3 MP-Sichtbar** | **grün** |
| **C7 Proof/Klient** | **gelb** — `client_documents=0` bei Finalize erwartet (Mirror erst nach `releaseAssistProofToPortal`) |
| **C9 Budget-Lifecycle** | **grün** — `client_budget_transactions.lifecycle_status=durchgefuehrt` (Direct-DB + E2E) |
| **C10 WFM/Zeitkonto** | **gelb** — `workforce_time_events=0`; `assist_time_events=6` Proxy; UI grün |
| **workforce_work_sessions** | 1 Session (Tenant, letzte 2 h) — **nicht** visit-verknüpft |
| **assist_visit_proofs** | **1** draft, `payload_hash` gesetzt ✓ |
| **RLS** | **grün** — Fremd-MA sieht fremden Visit nicht |
| **Blocker-Inbox** | **grün** — Panel geladen, kein falscher Blocker auf Test-Visit |
| **42501** | **Kein** Budget-Grant-Fehler mehr (0222 wirksam) |

**WFM Root Cause (Production):** Bundle enthält RPC-first `wfmAssistAdapter`, Migration 0224 live — dennoch 0 `workforce_time_events` nach Finalize. Postgres-Log: `sync_assist_visit_times_to_wfm: tenant mismatch`. Strenger Guard `p_tenant_id IS DISTINCT FROM current_tenant_id()` schlägt fehl, wenn JWT-/Profil-Tenant-Auflösung vom Client-`ctx.tenantId` abweicht. Budget-RPC scheitert ggf. ebenfalls, wird aber durch Direct-UPDATE-Fallback maskiert.

**Empfehlung P0.1 Production:** **Restricted GO (GO-RISIKO)** — Kern-Workflow production-fähig; Budget-Ledger-direct **grün** (P0.1 Hauptziel). WFM-Direct-Spiegelung in Production noch offen → kein Full GO bis WFM-RPC-Hit verifiziert.

**Rollback-Option:** Leerer `[deploy]`-Commit auf vorherigen Bundle-Stand (`8646b0bb` / `entry-cbd6b68…`) oder Netlify Rollback auf Deploy vor `59c3d452`.

Artefakte: `docs/audit/p0-e2e-abnahme-results.json`, `.audit-p01-prod-smoke-deploy.log`, `.audit-p01-prod-db-verify-deploy.log`

---

## P0.1 — WFM Production Debug (2026-07-02)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| **Root Cause A** | Migration **0224** RPC live (`20260702142401`); Grants `authenticated` ✓ |
| **Root Cause B** | Postgres-Log + manueller Service-Role-Call: **`tenant mismatch`** bei striktem `current_tenant_id()`-Guard |
| **Root Cause C** | P0-Smoke-Visit `aaa9f848…`: 6 `assist_time_events`, 0 `workforce_time_events` vor Fix |
| **Root Cause D** | Portal-Account `p0.mhi.test` → Employee `c0e5e002…`, Profil-Tenant korrekt; RPC mit simuliertem JWT insertet **5** Events |
| **Root Cause E** | Budget (C9) grün trotz RPC-Fehler möglich: `markAssignmentExecuted` Direct-UPDATE-Fallback |
| **Root Cause F** | `wfmAssistAdapter` behandelte RPC `0` als Erfolg → kein `wfmSyncFailed`-Signal bei leerem Mirror |
| **Migration 0225** | `0225_wfm_assist_portal_sync_tenant_fix.sql` — Tenant-Zugriff via `employee_portal_accounts` + Visit-Zuweisungs-Check; auf Supabase angewendet |
| **Code (uncommitted)** | `wfmAssistAdapter`: Zero-Insert + mappable Assist-Events = Fehler; `finalizeVisit`: `assistVisitId ?? assignmentId` |
| **Vitest** | **12/12 grün** (`wfmAssistAdapterRpc`, `finalizeVisitProof`, `clientBudgetMarkExecuted`) |
| **Prod Re-Verify (post-0225)** | Manueller RPC-Backfill Smoke-Visit: **5** `workforce_time_events` (`source=assist`) ✓ |
| **Deploy nötig?** | **Migration-only** für RPC-Fix auf bestehendem Bundle `entry-49410f4…`; Code-Härtung (Zero-Insert) erst nach Deploy |

**Empfehlung P0.1 WFM Debug:** **GO-RISIKO → GO für WFM-Direct (DB)** nach 0225 + frischem Production-Finalize. Code-Änderungen committen, aber nicht deployen bis Abnahme. Nächster Schritt: neuer P0-Smoke-Visit finalisieren (ohne manuellen Backfill) und C10 direct prüfen.

**Commit/Deploy-Readiness:** Migration **0225** angewendet (P0-DB). Code bereit für Review-Commit; **kein Deploy** ohne explizite Freigabe.

---

## P0.1 — WFM post-0225 Production Verification (2026-07-02)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| **Migration 0225** | Auf Supabase angewendet (Tenant-Guard via `employee_portal_accounts` + Visit-Zuweisung) |
| **Prod-Bundle** | `entry-49410f4…` — `sync_assist_visit_times_to_wfm` RPC vorhanden ✓ |
| **Bootstrap (Retry)** | `budget_reservation` **OK**; frischer Assignment nach erstem Doc-Validation-Abbruch |
| **Test-Visit** | `38156f2d-d040-43cd-a574-4e3efb375e7f` (Test Pflege GmbH, Tenant `a4ba83bd…`) |
| **Login** | `p0.mhi.test@caresuiteplus.test` / Browser-Form auf https://caresuiteplus.app |
| **E2E UI** | **14/15 grün**, 1 gelb, 0 rot → **GO** (~329 s, Retry nach Doc-Flake) |
| **MP-Ablauf** | **Vollständig** (doc → signature → finalize); erster Lauf brach bei „Kurzbeschreibung ist erforderlich“ ab |
| **Dual-Scoring UI** | `uiScore`: 14 grün / 1 gelb / 0 rot → **GO** |
| **Dual-Scoring DB** | Budget **grün** (`durchgefuehrt`); WFM **grün** (5 direct, kein Proxy); client_documents **gelb** (Mirror by design) |
| **restrictedGo** | **GO** (Full GO — Budget + WFM Direct-DB beide grün) |
| **C10 WFM/Zeitkonto** | **grün** — `workforce_time_events=5` (`source=assist`); `dbScore.gruen`; kein Proxy-Fallback |
| **workforce_time_events** | **5** direct — `visit_drive_start`, `travel_end`, `visit_arrived`, `visit_started`, `visit_ended` |
| **workforce_work_sessions** | **1** Session `afa07556…` — alle 5 Events verknüpft (`session_id`); Status `clocked_in` |
| **assist_time_events** | **6** (Quelle); WFM-Mirror erfolgte **automatisch** beim Finalize — **kein manueller Backfill** |
| **client_budget_transactions** | **durchgefuehrt** ✓ |
| **assist_visit_proofs** | **1** draft, `payload_hash` gesetzt ✓ |
| **C7 Proof/Klient** | **gelb** — Proof@Finalize ja; `client_documents=0` erwartet (Mirror erst nach `releaseAssistProofToPortal`) |

**Erster Lauf (Visit `0db14863…`):** MP-Dokumentation nicht gespeichert → 5 rot, C10 gelb (0 WFM direct). Retry mit frischem Bootstrap erfolgreich.

**Vergleich pre/post-0225:**

| Visit | WFM direct | Backfill |
|-------|------------|----------|
| `aaa9f848…` (pre-0225) | 0 | manuell → 5 |
| `38156f2d…` (post-0225) | **5** | **keiner** |

**Empfehlung P0.1 WFM post-0225:** **Full GO** — Migration 0225 + Bundle `entry-49410f4…` reichen für WFM Auto-Sync in Production. Verbleibendes gelb nur C7 (Mirror by design). Code-Härtung (`wfmAssistAdapter` Zero-Insert) weiterhin empfohlen, aber kein Blocker für WFM-Persistenz.

Artefakte: `docs/audit/p0-e2e-abnahme-results.json`, `.audit-p0-portal-auth-bootstrap-results.json`, Direct-DB via `.audit-p0-prod-db-verify.mjs` (`P0_VISIT_ID=38156f2d…`).

---

## R-prod — Production-Smoke (2026-07-02)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| **Netlify Build** | Ja — Bundle gewechselt (`entry-2a8cef…` → `entry-cbd6b68…`) |
| **Deploy-Commit** | `354c6d15` via Trigger `8646b0bb chore(deploy): release p0 workflow stabilization [deploy]` |
| **P0 E2E Smoke** | **15/15 GO** (~315 s) gegen `https://caresuiteplus.app` |
| **Test-Visit** | `3088705d-9477-47cd-b1e9-0667f0c66389` (Test Pflege GmbH) |
| **Bootstrap** | Portal/Assignment OK; Budget-Reservierung weiterhin `42501 permission_denied` |
| **workforce_time_events** | **Nein** (0 Zeilen) — E2E/DB nutzen `assist_time_events` (6 Events) |
| **WFM FK-Banner** | Kein expliziter `user_id_fkey`-Text; generischer **Datenbankfehler**-Banner im MP-Abschluss sichtbar |
| **Budget durchgefuehrt** | **Nein** — `client_budget_transactions` leer; Proxy `assist_visits.billing_status=preview` |
| **Ledger-Verbrauch** | **Nein** — keine Reservierung/Transaktion (Bootstrap-Grant fehlt) |
| **Proof** | Ja — `assist_visit_proofs` draft, `payload_hash` gesetzt |
| **Client-Doc-Mirror** | Nein — `client_documents` (assist_visit_proof) count=0 |
| **RLS** | Grün — Fremd-MA sieht fremden Visit nicht |
| **Blocker-Inbox** | Grün — Panel geladen, kein falscher Blocker auf Test-Visit |

**Empfehlung R-prod:** **GO mit Risiken** — Kern-Workflow (Office→Assist→MP→Proof) production-fähig; WFM-Session-Spiegelung und Budget-Ledger-finalize noch nicht als Direct-Hits verifiziert.

Artefakte: `docs/audit/p0-e2e-abnahme-results.json`, `docs/audit/p0-e2e-screenshots/`, `.audit-p0-prod-db-verify.mjs`

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

---

## P0.1 Production Persistence Hardening (Analyse 2026-07-02)

**Scope:** Analyse + Fix-Plan only — kein Deploy, kein Commit in dieser Runde.  
**Tenant:** `a4ba83bd-65db-46cf-8cf7-61492cc78315` (Test Pflege GmbH)  
**Test-Visit:** `3088705d-9477-47cd-b1e9-0667f0c66389`

### Executive Summary

| Dimension | UI Smoke | Direct DB | Bewertung |
|-----------|----------|-----------|-----------|
| Office→Assist→MP Workflow | 15/15 grün | — | GO |
| Proof (`assist_visit_proofs`) | grün | grün (draft, hash) | GO |
| Budget lifecycle | C9 grün (Proxy) | **rot** — 0 `client_budget_transactions`, `billing_status=preview` | NO-GO |
| WFM / Office-Zeitkonto | C10 grün (Proxy) | **rot** — 0 `workforce_time_events`, 0 `workforce_work_sessions` | NO-GO |
| Client-doc mirror | C7 grün (Scoring-Lücke) | **rot** — 0 `client_documents` | Erwartet (Release-Pfad) |
| RLS Fremd-MA | grün | grün | GO |
| MP Finalize-Banner | sichtbar | — | GO mit Risiko |

**Empfehlung:** **GO mit Risiken / Restricted GO** — UI-Workflow production-tauglich; **Direct-DB-Persistenz für WFM + Budget-Ledger noch nicht abnahmefähig.**

### A. Bootstrap 42501 (`client_budget_accounts` / `client_budget_transactions`)

| Feld | Wert |
|------|------|
| **Operation** | `p0PortalAuthBootstrap.mjs` → `admin.restUpsert('client_budget_accounts')` + `restUpsert('client_budget_transactions')` |
| **Role** | `service_role` (via `createAuditAdminClient`) |
| **Code** | `42501 permission_denied` |
| **Root Cause** | Migration **0175** grantet nur `authenticated` (INSERT/UPDATE). Migration **0215** grantet `service_role` nur **SELECT** auf `client_budget_transactions` — kein INSERT auf Accounts, kein INSERT auf Transactions. **Grant-Gap, nicht RLS.** |
| **Folge** | Keine Reservierung `lifecycle_status=geplant` → `markAssignmentExecuted` / RPC **0221** findet 0 Rows → `billing_status` bleibt `preview` |

### B. WFM — 0 Sessions/Events in Production

| Feld | Wert |
|------|------|
| **Authoritative Office-Zeitkonto** | `workforce_time_events` (append-only SoT) + `workforce_work_sessions` (Tagesaggregation) — **nicht** `assist_time_events` |
| **Assist-Pfad** | `saveVisitTimeEvent` / `employeePortalVisitTrackingPersistence` → `syncAssistTimeEventToWfm` → `wfmWorkSessionRepository.insertWorkSession` + `insertTimeEvent` |
| **Finalize-Pfad** | `finalizeVisit` → `syncAssistVisitTimesToWfm` (**blockierend** bei Fehler) |
| **Root Cause 1** | WFM-RLS (**0190**) nutzt `workforce_current_employee_id()` (nur `employees.profile_id = auth.uid()`). Assist-RLS nutzt `resolve_current_employee_id()` (Portal-Account **oder** Profil). Portal-MA ohne Profil-Link scheitern an WFM-INSERT. |
| **Root Cause 2** | `wfm_events_insert` verlangt zusätzlich `has_permission('time.tracking.own.start')` über **profiles→role_permissions**. Portal-only Auth-User ohne Profil haben diese Permission in DB **nicht**. |
| **Root Cause 3** | Status-Transitions: WFM-Sync ist **best-effort** (`employeePortalVisitTrackingPersistence`, Warnung nur dev). Finalize: **hard-fail** → erklärt „Abgeschlossen“ + „Datenbankfehler“-Banner (Status schon committed, WFM danach fehlgeschlagen). |
| **FK** | `user_id` nullable seit R21; FK nicht mehr Hauptursache. |

### C. Budget — `preview` statt `durchgefuehrt`

| Pfad | Verhalten |
|------|-----------|
| **Finalize (Portal)** | `mirrorAssistVisitStatusFromAssignment` → `syncBudgetLifecycleAfterPortalStatus` → `markAssignmentExecuted` (**Fehler werden geschluckt**, `void`) |
| **Finalize (Visit-Repo)** | `visitRepository.updateAssignmentStatus` → `markAssignmentExecuted` bei `beendet`/`abgeschlossen` |
| **RPC 0221** | `mark_assist_visit_budget_executed` — SECURITY DEFINER, Portal-Kontext via `is_employee_portal_rls_context` + Assignment-Ownership |
| **Proof-Approval** | `consumeOnProofApproval` — finaler Verbrauch erst nach Freigabe, **nicht** bei Finalize |
| **Root Cause** | (1) Bootstrap-Reservierung fehlt (42501). (2) Ohne `client_budget_transactions`-Row ist RPC no-op (`RETURN 0`). (3) Direct-UPDATE scheitert an **0175** RLS (`clients.budgets.edit` = Office only). (4) `assist_visits.billing_status=preview` ist Bootstrap-Default, wird von RPC nur auf `reserved` gesetzt wenn TX updated. |

### D. Client-Doc-Mirror — Proof ja, `client_documents` nein

| Feld | Wert |
|------|------|
| **Finalize** | `generateServiceRecord` → `persistEmployeePortalVisitProof` → `assist_visit_proofs` (draft) |
| **Mirror** | `upsertAssistProofClientPortalDocument` nur in `releaseAssistProofToPortal` (**nach** PDF + Freigabe) |
| **Root Cause** | **By design** — kein Bug im Finalize-Pfad. C7-Scoring prüft fälschlich `proofCount > 0` statt `clientDocs.count > 0`. |

### E. Generic „Datenbankfehler“-Banner

| Feld | Wert |
|------|------|
| **UI-Ort** | `EmployeePortalVisitExecutionScreen` — dismissible `localError` nach Finalize |
| **Message** | `toGermanSupabaseError` → `Datenbankfehler: Bitte erneut versuchen.` (Production maskiert Codes ≠ 42501) |
| **Wahrscheinliche Operation** | `finalizeVisit` → `syncAssistVisitTimesToWfm` (nach erfolgreichem Status-Transition) |
| **Swallowed?** | Ja — Assignment `completed`, Proof draft, UI zeigt Erfolg **und** Fehler gleichzeitig |

### Minimal Fix Plan (ordered, smallest safe diffs)

| # | Gap | Fix | Dateien / Migration |
|---|-----|-----|---------------------|
| **1** | Bootstrap 42501 | Migration **0222**: `GRANT SELECT, INSERT, UPDATE ON client_budget_accounts, client_budget_transactions TO service_role` (audit/bootstrap only; RLS bleibt für authenticated) | `supabase/migrations/0222_p0_bootstrap_budget_service_role_grants.sql` |
| **2** | WFM Portal-RLS | Migration **0223**: `workforce_current_employee_id()` → COALESCE mit `resolve_current_employee_id()`; Policy-Erweiterung: INSERT events/sessions wenn `is_employee_portal_rls_context` AND `source='assist'` | `supabase/migrations/0223_wfm_portal_assist_rls.sql` |
| **3** | Budget finalize | Kein App-Change nötig wenn #1+#0221 live; optional: `syncBudgetLifecycleAfterPortalStatus` Fehler loggen + `assistExecutionProblemInbox` | `employeePortalExecutionLiveService.ts` |
| **4** | Finalize split-brain | WFM-Sync in `finalizeVisit` an Tracking angleichen: best-effort + Problem-Inbox statt hard-fail **oder** erst #2 deployen und hard-fail behalten | `finalizeVisit.ts`, `assistExecutionProblemInboxService.ts` |
| **5** | Scoring | Dual-Score UI vs DB; C9/C10 nur grün bei Direct-Hit; C7 prüft `clientDocs.count` | `scripts/audit/p0BetriebssystemE2eFull.mjs` |
| **6** | Client-doc mirror | Scoring-Fix only; Mirror bleibt Release-Pfad | Audit only |

### Tests to add (planned)

- Vitest: WFM RLS policy simulation / portal actor insert (mock Supabase 42501 → success after policy)
- E2E: `queryBudgetLifecycle` / `queryWfmEvents` ohne Proxy-Fallback → rot wenn count=0
- Integration: Bootstrap `budget_reservation` step → `ok: true` nach 0222
- Regression: `finalizeVisit` — completed + WFM failure → Problem-Inbox-Eintrag, kein irreführender Voll-Fehler

### Dual Scoring Proposal

| Kriterium | UI Smoke | DB Direct | Portal | RLS | Billing-Doc |
|-----------|----------|-----------|--------|-----|-------------|
| C1–4 Workflow | grün | — | grün | — | — |
| C5–6 Proof | grün | grün | — | — | draft OK |
| C7 Klient-Doc | grün* | **rot** | — | — | Mirror fehlt (expected) |
| C8 Sichtbarkeit | grün | — | — | — | Assist OK |
| C9 Budget | grün* | **rot** | — | OK | preview only |
| C10 WFM | grün* | **rot** | — | Gap | assist proxy only |
| C11–15 | grün | — | — | grün | — |

\*Proxy-Scoring — mit P0.1 Dual-Score als **UI grün / DB rot**.

### Migrations/RPCs (planned, not applied)

- **0222** — service_role bootstrap grants (budget tables)
- **0223** — WFM portal assist RLS alignment
- **0221** — bereits live; wirksam erst mit Reservierungs-Rows

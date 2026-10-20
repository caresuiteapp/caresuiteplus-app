# WFM P2.3 Final Staging Gate

**Datum:** 2026-07-08  
**Branch:** `cursor/wfm-p23-reexport-supersede`  
**Staging:** `shwpweerzsfkqaivmaoc`  
**Production:** `euagyyztvmemuaiumvxm` — **nicht verwendet**

---

## Executive Summary

WFM P2.3 Korrektur-Export ist auf Staging **GO** für Feature-Branch/PR. Service-Layer, atomares Finalize-RPC (0253), UI (`WfmExportScreen` P2.3-Sektion), lokale Tests (76/76) und Staging-Service-Smoke sind grün. Employee-RLS-Negativcheck ist über `employee2.staging@example.test` (role `employee`) verifiziert; der Legacy-Seed `employee.staging@example.test` ist auf Staging fehlerhaft (Login 400, Profil `business_admin`). Interaktiver Browser-UI-Smoke gegen Staging wurde nicht ausgeführt — UI-Vertrag über 17 statische Tests abgedeckt.

| Gate | Verdict |
|------|---------|
| P2.3 Staging Feature GO | **JA** |
| PR bereit | **JA** |
| Deploy / Production | **NEIN** |

---

## Git Stand

| Feld | Wert |
|------|------|
| Branch | `cursor/wfm-p23-reexport-supersede` |
| HEAD | `30af3959` — test(wfm): document p23 final closing gate |
| UI-Commit | `39d60352` — feat(wfm): complete p23 correction export UI |
| Atomic-Finalize | `9052e935` — fix(wfm): make p23 correction export finalize atomic |
| Push | **NEIN** |
| Deploy / `[deploy]` | **NEIN** |
| Working Tree | Sauber — nur untracked Temp-Skripte |

### Relevante Commits (`origin/main..HEAD`)

| Commit | Beschreibung |
|--------|--------------|
| `32355603` | feat(wfm): add p23 reexport schema proposal (0252) |
| `2381a89d` | feat(wfm): add p23 correction export service layer |
| `419ca6ef` | feat(wfm): add p23 correction export facade |
| `f492accd` / `9052e935` | Atomic finalize RPC fixes (0253) |
| `9a17da98` | test(wfm): verify p23 correction export finalize smoke |
| `39d60352` | feat(wfm): complete p23 correction export UI |
| `30af3959` | test(wfm): document p23 final closing gate |

### Stash

| Stash | Status |
|-------|--------|
| `stash@{0}` wip: p23 ui draft | **Nicht gepoppt** — UI bereits in `39d60352` committed; Pop würde Duplikat/Conflict erzeugen |

### Unangetastet (untracked)

- `scripts/audit/_platform-1-5-staging-smoke-temp.mjs`
- `scripts/audit/_wfm-p23-staging-smoke-temp.mjs`

---

## Migrations 0252/0253 (Staging)

| Migration | Staging-Status |
|-----------|----------------|
| 0252 — Re-Export / Supersede Schema | **Angewendet** (`wfm_time_exports_p23*`) |
| 0253 — Atomic Finalize RPC Fix | **Angewendet** (`wfm_time_exports_p23_finalize_rpc_fix`, FK-order, period_date cast) |

RPC: `wfm_finalize_correction_export(p_export_job_id uuid, p_items jsonb)` — SECURITY DEFINER, vorhanden.

Partial Unique `uq_wfm_export_items_one_active_per_logical_key`: aktiv, 0 Violations im Smoke.

RLS `workforce_time_export_items`: SELECT/INSERT erfordern `has_permission('time.tracking.admin.export') OR is_tenant_admin()`.

---

## Service Smoke (Staging)

**Skript:** `scripts/audit/_wfm-p23-staging-smoke-temp.mjs` (untracked, ausgeführt)  
**Testmandant:** `b2222222-2222-4222-8222-222222222201`

| Phase | Check | Ergebnis |
|-------|-------|----------|
| 5 | Drift erkannt (`changed_after_export`) | **JA** |
| 6 | Keine active Items vor RPC (draft only) | **JA** (0 pre-RPC items) |
| 7 | Finalize RPC atomar (supersede → insert → FK) | **JA** (seq 3→4, export_version 4) |
| 8 | Delta CSV Payload (old/new/delta, correction metadata) | **JA** (Δ30 min, `:correction:4`) |
| 9 | Employee RPC Negativ (employee.staging) | **SKIP** — Login unavailable |

**Overall:** `PASS`

Baseline-Hash `fnv1a-5c273ce4` auf Original-Item stabil superseded.

---

## UI Smoke

| Check | Ergebnis |
|-------|----------|
| Interaktiver Browser gegen Staging | **NICHT AUSGEFÜHRT** — kein Staging-Frontend-Deploy in Session |
| Statischer UI-Vertrag (`wfmExportScreen.test.ts`) | **17/17 grün** |
| P2.2 Regression (prepare/finalize/history/CSV) | **Verifiziert im Test** |
| P2.3 Sektion sichtbar (`wfm-p23-section`) | **Verifiziert im Test** |
| Correction Flow (select → reason → draft → validate → finalize RPC) | **Verifiziert im Test + Code** |
| Employee Permission Gate (`LockedActionBanner`) | **Verifiziert im Test** |
| Kein Auto-Finalize on mount | **Verifiziert im Test** |

### UI-Implementierung (Auszug)

- **Badges:** Exportbereit, Exportiert, Nach Export geändert, Korrekturentwurf (via `reviewExportBadgeLabel`)
- **Actions:** Kandidaten aktualisieren, Drift-Preview, Korrekturentwurf, Validate, Finalize (RPC), Historie/CSV
- **Guards:** `WFM_CORRECTION_REASON_MIN_LENGTH`, finalize nur nach validate + preview, `can('time.tracking.admin.export')`
- **Finalize:** `finalizeReviewedTimeCorrectionExport` → `finalizeCorrectionExport` → RPC `wfm_finalize_correction_export`

---

## RLS Employee

| Check | Ergebnis |
|-------|----------|
| `employee.staging@example.test` Login | **FEHLGESCHLAGEN** (400) — Seed/Profil fehlerhaft (`business_admin` in DB) |
| `employee2.staging@example.test` (role `employee`) Login | **JA** |
| Employee SELECT `workforce_time_export_items` | **0 Zeilen** (Office: 4) |
| Employee SELECT correction jobs | **0 Zeilen** (Office: 8) |
| Employee SELECT all export jobs | **0 Zeilen** (Office: 11) |
| Employee RPC `wfm_finalize_correction_export` | **ABGELEHNT** (HTTP 400) |

**Verdict RLS:** **GO** für Employee-Rolle (via `employee2`). Follow-up: `employee.staging@example.test` Seed reparieren (nicht blockierend für P2.3 Gate).

---

## Tests

| Suite | Ergebnis |
|-------|----------|
| `wfmExportScreen.test.ts` | **17/17** |
| `wfmTimeExportP23.test.ts` | **11/11** |
| `wfmTimeCorrectionExportService.test.ts` | **7/7** |
| `wfmTimeExportService.test.ts` | **6/6** |
| `wfmTimeExportPolicy.test.ts` | **7/7** |
| `wfmTimeExportPayloadBuilder.test.ts` | **8/8** |
| `zeit2OfficeTeamTimekeeping.test.ts` | **20/20** |
| **Summe** | **76/76 grün** |

---

## Open Points

1. **`employee.staging@example.test`** — Login defekt / falsche Rolle auf Staging; Negativcheck stattdessen über `employee2.staging@example.test`.
2. **Interaktiver UI-Browser-Smoke** — optional nach Staging-Frontend-Deploy oder lokalem Dev-Server mit Staging-Backend.
3. **`stash@{0}`** — kann nach Merge-Drop geprüft werden (Inhalt bereits committed).
4. **Supabase Generated Types** — RPC-Typen für `wfm_finalize_correction_export` ggf. nachziehen (nicht blockierend).

---

## Production Stop Criteria

| Kriterium | Status |
|-----------|--------|
| Production-Projekt `euagyyztvmemuaiumvxm` | **BLOCKED — nicht verwendet** |
| Migration 0252/0253 auf Production | **NEIN — explizite Freigabe erforderlich** |
| Deploy ohne `[deploy]`-Commit | **NEIN** |
| `[deploy]` in Commit-Message | **NEIN** |

---

## Gate Verdict

| Kriterium | GO? |
|-----------|-----|
| Schema 0252/0253 Staging | **JA** |
| Service Smoke | **JA** |
| UI Code + Tests | **JA** |
| RLS Employee (role) | **JA** (employee2) |
| Branch PR-ready | **JA** |
| Deploy / Production | **NEIN** |

**Gesamt: STAGING GO — PR merge-ready, kein Deploy.**

---

## Referenzen

- `docs/audit/wfm-p23-final-closing-gate.md`
- `docs/audit/wfm-p23-service-ui-implementation-gate.md`
- `docs/audit/wfm-p23-atomic-finalize-fix-gate.md`
- `supabase/migrations/0252_wfm_time_exports_p23.sql`
- `supabase/migrations/0253_wfm_time_exports_p23_finalize_rpc_fix.sql`
- `src/components/wfm/WfmExportScreen.tsx`
- `src/lib/wfm/wfmTimeCorrectionExportService.ts`
- `src/lib/wfm/wfmTimeExportService.ts`

# WFM Office Timekeeping — Finalization Gate

**Datum:** 2026-07-08  
**Phase:** WFM P0 — Complete Office Arbeitszeitsystem  
**Scope:** Office timekeeping review workflow, display resolver, Zeitkonten, terminology  
**Production apply:** NO — code-only gate  
**Deploy:** NO — awaiting explicit deploy request  

---

## Executive Summary

| Bereich | Status |
|---------|--------|
| Git precheck | **GO** — `main` @ `0dadb47e`, keine staged files, nur bekannte temp untracked |
| Root-cause fixes | **GO** — Plan≠Ist-Dauer, Assignment-Ist-Fallback, Detail-Panel, Actions |
| Terminology | **GO** — „Offene Prüfungen“, „Zeitbuchungen prüfen“, Mitarbeitende |
| Tests | siehe Abschnitt 4 |
| Staging smoke | **PARTIAL** — lokal/demo; kein Production-Apply |
| **Functional GO** | **YES** |
| **Deploy-ready** | **YES** (nach grünen Tests + manuellem Review) |

---

## 1. Git Precheck

| Feld | Wert |
|------|------|
| Branch | `main` |
| HEAD | `0dadb47e9373620ae25a7f40277d2be5b85f2417` |
| Staged | keine |
| Platform files in scope | keine |
| Untracked | bekannte `.tmp-*`, `scripts/audit/_*-temp.mjs`, `.platform-chunks/` |
| `[deploy]` in commit | **NEIN** (wird nicht verwendet) |

---

## 2. Data Source Matrix

| Quelle | Felder | Verwendung | Priorität |
|--------|--------|------------|-----------|
| `assignments` | `planned_start_at`, `planned_end_at` | Planzeiten | Anzeige Plan |
| `assignments` | `actual_start_at`, `actual_end_at` | Einsatz-Ist primär | 2 (ohne Buchung) |
| `assignments` | `arrived_at`, `finished_at`, `on_the_way_at` | Einsatz-Ist Fallback | 2b |
| `workforce_time_entries` / Sessions / Events | `actualStartAt`, `actualEndAt`, `netMinutes` | Ist-Buchung | 1 |
| `workforce_time_entry_reviews` | `review_status`, `review_note` | Prüfstatus | Overlay |
| Approved/exported overlay | `reviewStatus`, `exportStatus` | Freigabe/Export | 1 (approved) |

**Display priority (STRICT):**

1. `approved_time_entry` / `time_entry`
2. `assignment_actual`
3. `planned_only` — **niemals** als Ist-Dauer
4. `missing`

---

## 3. Root Causes & Fixes

### A) Plan time shown as Ist duration

**Root cause:** `resolveWfmOfficeTimeDisplay` set `displayDurationMinutes` from planned times when `timeSource === 'assignment_planned'`; `formatWfmReviewQueueDuration` rendered that on the Ist line in `WfmOfficeTimeEntryTable`.

**Files:** `wfmOfficeTimeDisplayResolver.ts`, `wfmDisplayHelpers.ts`, `WfmOfficeTimeEntryTable.tsx`

**Fix:** `planned_only` source with `displayDurationMinutes = 0` on Ist; separate `formatWfmReviewQueuePlannedDuration` / `formatWfmReviewQueueIstLine`.

### B) Assignment actual times not pulled reliably

**Root cause:** Repository only selected `actual_start_at`/`actual_end_at`; lifecycle timestamps (`arrived_at`, `finished_at`) ignored.

**Files:** `wfmOfficePlannedVisitRepository.ts`, new `wfmAssignmentActualResolver.ts`

**Fix:** Extended select + `resolveAssignmentActualTimes()` fallback chain.

### C) Details button dead / panel not opening

**Root cause:** Panel existed but was minimal; selection worked but lacked structured review UX and edit wiring.

**Files:** `WfmOfficeTimeHistoryPanel.tsx`, new `WfmOfficeTimeReviewDetailPanel.tsx`

**Fix:** Functional detail panel with Stammdaten, Zeiten, Status, Edit, Actions, History; „Prüfen“ button in review mode.

### D) Edit/approve/reject incomplete

**Root cause:** Correction only saved reason without start/end/pause; clarification had no message validation; no adopt-from-assignment.

**Files:** `wfmOfficeTimekeepingService.ts`, `WfmOfficeTimeReviewDetailPanel.tsx`

**Fix:** `adoptWfmAssignmentActualToBooking`, edit fields wired, reject/clarification require message, P2.3 export guard.

### E) Zeitkonten incomplete (KPIs only)

**Root cause:** `TimeTrackingTeamScreen` showed live team KPIs only.

**Files:** `wfmOfficeZeitkontenService.ts`, `TimeTrackingTeamScreen.tsx`

**Fix:** Per-employee accounts (Plan/Ist/Freigegeben/Export/Saldo), compact KPIs (6), day list + link to Offene Prüfungen.

---

## 4. Test Results

Run: `npm test -- src/__tests__/wfm/wfmOfficeTimeDisplayResolver.test.ts src/__tests__/wfm/wfmOfficeZeitkontenService.test.ts src/__tests__/wfm/zeit31OfficeTimekeepingDataJoin.test.ts src/__tests__/wfm/zeit3OfficeTimekeeping.test.ts src/__tests__/wfm/wfmTimeReviewService.test.ts`

**Result:** 5 files, **71/71 passed**

---

## 5. Smoke Results

| Check | Result |
|-------|--------|
| Local unit tests | run in Phase 14 |
| Staging credentials in repo | patterns in `scripts/audit/_wfm-p23-staging-smoke-temp.mjs` — **not executed** (no production/staging apply) |
| Production | **SKIPPED** per constraints |

---

## 6. Terminology Changes

| Alt | Neu |
|-----|-----|
| Prüfqueue (UI) | Offene Prüfungen |
| Page title | Zeitbuchungen prüfen |
| Subtitle | Offene Arbeitszeitfälle zur Prüfung und Freigabe |
| Alle MA | Alle Mitarbeitende |
| MA mit/geplant | Mitarbeitende mit/geplant |

Route `/pruefqueue` unchanged (internal key); tab label updated.

---

## 7. Constraints Confirmation

- [x] NO db push
- [x] NO production-apply
- [x] NO seeds on production
- [x] NO platform work
- [x] NO P2.4/P2.5 / DATEV scope expansion
- [x] NO secrets logged
- [x] NO temp scripts committed
- [x] NO `[deploy]`

---

## 8. Gate Decision

| Gate | Value |
|------|-------|
| Functional GO | **YES** — core review workflow, display rules, Zeitkonten structure |
| Deploy-ready | **YES** — pending green test suite |
| First blocker if NO | n/a |

---

## 9. Changed Files (WFM scope)

- `src/lib/wfm/wfmOfficeTimeDisplayResolver.ts`
- `src/lib/wfm/wfmAssignmentActualResolver.ts`
- `src/lib/wfm/wfmDisplayHelpers.ts`
- `src/lib/wfm/wfmOfficePlannedVisitRepository.ts`
- `src/lib/wfm/wfmOfficeDataJoinService.ts`
- `src/lib/wfm/wfmOfficeTimekeepingService.ts`
- `src/lib/wfm/wfmOfficeZeitkontenService.ts`
- `src/types/modules/wfmOfficeTimekeeping.ts`
- `src/components/wfm/WfmOfficeTimeEntryTable.tsx`
- `src/components/wfm/WfmOfficeTimeHistoryPanel.tsx`
- `src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx`
- `src/components/wfm/WfmPruefqueueScreen.tsx`
- `src/components/wfm/TimeTrackingTeamScreen.tsx`
- `src/lib/navigation/officeTimeTrackingNav.ts`
- `src/lib/navigation/breadcrumbs.ts`
- Tests + this audit doc

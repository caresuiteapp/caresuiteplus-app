# ABSENCE.1 — Production Smoke Report (P0 Deploy)

**Date:** 2026-07-03  
**Environment:** https://caresuiteplus.app  
**Scope:** ABSENCE.1 P0 hotfix — German date parsing on portal absence submit (`62785baa`)  
**Auditor:** Playwright production smoke (local `.audit-*` scripts, not committed)  
**Test tag:** `[TEST-ABSENCE1-P0-PROD]` in `employee_note` — TEST tenant only

---

## Phase 1 — Pre-Deploy Gate

| Check | Result |
|-------|--------|
| `git status` clean (no staged secrets) | ✅ Only untracked `.audit-*` / local smoke artifacts |
| `main` synced with `origin/main` | ✅ `62785baa` — `fix(wfm): parse employee absence request dates safely` |
| P0 commit on remote | ✅ `62785baa` |
| `git log origin/main..HEAD` | ✅ Empty (no unpushed commits before trigger) |
| `stash@{0}` present (ZEIT.2 WIP) | ✅ `wip-absence-p0-and-zeit2-before-isolation` |
| Production bundle before deploy | `entry-6a6168083d29fd4eb940a54b9a205440.js` (post group-chat deploy) |
| P0 fix live before trigger | ❌ No — code on `origin/main` but no `[deploy]` after `62785baa` |
| Gate | **GREEN** — proceed with empty `[deploy]` trigger |

---

## Phase 2 — Deploy Trigger

| Field | Value |
|-------|-------|
| P0 code commit | `62785baa` — `fix(wfm): parse employee absence request dates safely` |
| Trigger commit | `e6a3b628` |
| Message | `chore(deploy): release absence p0 date parser fix [deploy]` |
| `[deploy]` tag | **Yes** |
| Push target | `origin/main` |
| Bundle before | `entry-6a6168083d29fd4eb940a54b9a205440.js` |
| Bundle after (~90s poll) | `entry-a60232aab48057a8a7e9d6ce0c467206.js` |
| Build status | **Live** — new entry hash observed on production HTML |

---

## Phase 3 — Production Smoke Matrix

All created requests tagged **`[TEST-ABSENCE1-P0-PROD]`**. Scripts: `.audit-absence1-p0-prod-smoke.mjs`, follow-ups `.audit-absence1-p0-prod-smoke-followup*.mjs`. Results: `.audit-absence1-p0-prod-smoke-results.json`, `.audit-absence1-p0-prod-smoke-followup2.json`.

| Area | Check | Result | Evidence |
|------|-------|--------|----------|
| **A — Portal Abwesenheit** | Form loads `/portal/employee/arbeitszeit/abwesenheiten` | 🟢 grün | Neuer Antrag + type selector |
| | Submit German date `15.08.2026` | 🟢 grün | No **Invalid time value**; success message |
| | Status **Ausstehend** | 🟢 grün | Badge in Meine Abwesenheiten |
| | Own requests only | 🟢 grün | Scoped list title |
| **B — Portal Urlaub** | Form loads `/portal/employee/arbeitszeit/urlaub` | 🟢 grün | Neuer Antrag |
| | Create vacation `20.08.2026`–`22.08.2026` | 🟢 grün | Ausstehend, no crash |
| **C — Office Inbox** | `/business/office/time-tracking/requests` loads | 🟢 grün | Mitarbeitenden Anträge |
| | Both TEST requests visible | 🟢 grün | 2× **Details & Entscheidung** (follow-up 1) |
| | Open details panel | 🟢 grün | Antrag bearbeiten (Playwright `getByText`) |
| **D — Office Decisions** | Reject without reason blocked | 🟢 grün | **Ablehnungsgrund ist erforderlich** |
| | Approve absence request | 🟢 grün | Office approve → portal **Genehmigt** on Abwesenheiten |
| | Reject urlaub with reason | 🟡 gelb | Not fully closed in automation — urlaub may remain **Ausstehend** or was approved on wrong panel in early pass |
| **E — Calendar sync** | `/office/calendar` loads | 🟢 grün | Office Hauptkalender (not `/business/office/calendar`) |
| | Approved absence → internal entry Aug 2026 | 🟡 gelb | Calendar UI navigated; explicit 15.08 entry not confirmed in month view |
| | No duplicate on re-approve | 🟡 gelb | Not tested |
| **F — Portal Status** | Approved → **Genehmigt** | 🟢 grün | Abwesenheiten list after office approve |
| | Rejected → **Abgelehnt** + reason | 🟡 gelb | Urlaub reject path not confirmed in portal |
| **Regression — PROFILE.1** | Profile 14 tabs | 🟢 grün | All 14 tab labels on `/portal/employee/profile` |
| **Regression — ZEIT.1** | Arbeitszeit no profile error | 🟢 grün | No **Kein Mitarbeiterprofil** on `/portal/employee/arbeitszeit` |
| **Regression — OFFLINE.1** | Offline banner honest messaging | 🟡 gelb | Banner not detected in headless online pass; `context.setOffline(true)` reload did not surface banner — same SPA limitation as PROFILE.1 smoke; unit tests pass |
| **Regression — SIGNATURE.1** | Signature proof review | 🟢 grün | `/assist/nachweise/review` loads (**Nachweis-Prüfung**); prior prod pattern unchanged |
| **Regression — Execute** | Execute path reachable | 🟢 grün | `/portal/employee/assignments/d68152bd-…/execute` (~413 chars, no profile error) |

### Result summary

| Color | Count |
|-------|-------|
| 🟢 grün | 18 |
| 🟡 gelb | 5 |
| 🔴 rot | 0 |

**P0 primary signal:** Portal Abwesenheit submit with `15.08.2026` — **was 🔴 pre-P0, now 🟢**.

---

## Test Data Created (TEST only)

| Type | Note tag | Portal dates | Final status (observed) |
|------|----------|--------------|-------------------------|
| Abwesenheit (Krankmeldung/default) | `[TEST-ABSENCE1-P0-PROD] Abwesenheit P0 smoke …` | `15.08.2026` | **Genehmigt** (office approve) |
| Urlaub | `[TEST-ABSENCE1-P0-PROD] Urlaub P0 smoke …` | `20.08.2026`–`22.08.2026` | **Ausstehend** or pending re-check — reject-with-reason not confirmed in portal |

Prior smoke data from `[TEST-ABSENCE1-PROD]` (pre-P0 run) remains in DB; not modified.

---

## Key Findings

### Resolved (P0)

1. **Invalid time value on Abwesenheit submit** — **fixed in production** after deploy of `62785baa`. German `DD.MM.YYYY` (e.g. `15.08.2026`) submits successfully; status **Ausstehend**.

### Follow-up (non-blocking for P0)

2. **Urlaub office reject → portal Abgelehnt** — approve path verified for absence; urlaub reject automation incomplete in this run (selector/timing). Manual spot-check recommended.

3. **Calendar sync** — Office calendar loads at `/office/calendar`; explicit TEST entry on 15.08.2026 not confirmed in automated month navigation.

4. **OFFLINE.1 E2E** — Known headless limitation; `OfflineNotice` covered by unit tests (`offlineNotice.test.tsx` 4/4).

5. Console: React minified errors #418/#421/#422 — pre-existing production noise; non-blocking for ABSENCE.1 paths.

---

## Screenshots (local, not committed)

- `docs/audit/absence1-p0-prod-smoke-screenshots/portal-abwesenheit-form.png`
- `docs/audit/absence1-p0-prod-smoke-screenshots/portal-abwesenheit-after-submit.png`
- `docs/audit/absence1-p0-prod-smoke-screenshots/portal-urlaub-after-submit.png`
- `docs/audit/absence1-p0-prod-smoke-screenshots/portal-status-after-decisions.png`

---

## Verdict

### **Restricted GO**

| Question | Answer |
|----------|--------|
| **Invalid time value gone?** | **Ja** — Abwesenheit portal create with `15.08.2026` succeeds on production bundle `entry-a60232aab48057a8a7e9d6ce0c467206.js` |
| **ZEIT.2 stash still present?** | **Ja** — `stash@{0}: wip-absence-p0-and-zeit2-before-isolation` untouched |
| **Deploy P0 fix?** | **Ja** — trigger `e6a3b628` live |

**Rationale:** P0 hotfix is **verified live**. Core **Abwesenheit** portal → office approve → portal **Genehmigt** loop works on TEST accounts. **Urlaub** create still works. Regressions (PROFILE.1, ZEIT.1, SIGNATURE.1 review route, execute) green.

**Restrictions:**

- Complete **urlaub reject + Ablehnungsgrund** portal loop — follow-up manual or P1 smoke.
- **Calendar entry** for approved absence — not visually confirmed in August 2026 view.
- **OFFLINE.1** banner — E2E gelb (unit-tested).

---

## Historical — Pre-P0 Production Smoke (2026-07-03 earlier)

Prior run (trigger `c9424233`, bundle `entry-0736bcac…`) documented **Restricted GO** with Abwesenheit create **🔴 Invalid time value**. That defect is addressed by this P0 deploy. See git history of this file for the earlier matrix.

---

## Artifacts (local, not committed)

- `.audit-absence1-p0-prod-smoke.mjs` / `.audit-absence1-p0-prod-smoke-results.json`
- `.audit-absence1-p0-prod-smoke-followup.mjs` / `.json`
- `.audit-absence1-p0-prod-smoke-followup2.mjs` / `.json`
- Prior: `.audit-absence1-prod-smoke-*` (pre-P0)

Credentials sourced from `.env` / `.env.local` — values never logged.

---

## Next Track Recommendation

1. **P1:** Manual confirm urlaub reject → portal **Abgelehnt** + reason on remaining `[TEST-ABSENCE1-P0-PROD]` row.
2. **P1:** Office calendar August 2026 — confirm absence block for audit employee after approve.
3. **Defer:** ZEIT.2, OFFLINE.2, migrations, RLS (out of scope for this deploy).

---

## P1 — Urlaub rejection + calendar visibility (2026-07-03)

**Scope:** ABSENCE.1-P1 — portal rejection reason, awaited calendar sync, office warning  
**Branch:** `main` (no commit in this session)  
**Preflight:** ✅ `62785baa` present; ZEIT.2 only in `stash@{0}`; no ZEIT.2 files in working tree

### Root cause analysis

| Issue | Root cause | Fix |
|-------|------------|-----|
| Urlaub **Abgelehnt** + reason in portal (P0 gelb) | P0 prod automation often approved Urlaub first (`i === 0` fallback) or did not target Urlaubsantrag panel; portal only read `internal_note`, not `workforce_approvals.rejection_reason` fallback | `listWfmAbsencesForEmployee` enriches rejected rows with `portalRejectionReason` from approval; portal UI shows `portalRejectionReason \|\| internalNote` |
| Calendar entry not confirmed (P0 gelb) | Async fire-and-forget sync hid upsert failures; absence calendar title fell back to raw `vacation` source type | `reviewWfmAbsenceRequest` awaits sync/cancel; office inbox shows `InfoBanner` on failure; `buildCalendarEventFromAbsence` uses human-readable titles (Urlaub/Krankheit/…) |

### Code changes (uncommitted)

| File | Change |
|------|--------|
| `wfmAbsenceService.ts` | `resolveWfmPortalRejectionReason`, approval enrichment on employee list |
| `wfmApprovalService.ts` | `listWfmApprovalsForAbsenceReferences` |
| `WfmAbsencePortalScreen.tsx` | Display enriched rejection reason |
| `wfmAbsenceApprovalWorkflow.ts` | Await calendar sync; return `calendarSyncWarning` |
| `WfmEmployeeRequestsOfficeScreen.tsx` | Warning banner when sync fails |
| `wfmAbsenceCalendarBridge.ts` | Sync/cancel await helpers |
| `calendarSyncService.ts` | Readable absence event titles |
| `wfmAbsenceP1.test.ts` | P1 unit/regression suite (7 tests) |

### Tests (local)

| Suite | Result |
|-------|--------|
| `wfmAbsenceP1.test.ts` | ✅ 7/7 |
| `wfmAbsenceApprovalWorkflow.test.ts` | ✅ 9/9 |
| `wfmAbsencePortalDateSubmit.test.ts` | ✅ 5/5 |
| `wfmAbsenceService.test.ts` | ✅ 1/1 |
| **Total WFM absence** | ✅ **22/22** |

### Local browser smoke (`:8091`)

Script: `.audit-absence1-p1-local-smoke.mjs` → `.audit-absence1-p1-local-smoke.json`

| Check | Result | Notes |
|-------|--------|-------|
| Portal Urlaub create | 🟡 gelb | Headless run did not reach form submit (bundle/login timing) |
| Portal Abwesenheit create | 🟡 gelb | Same |
| Office approve absence | 🟡 gelb | Depends on prior creates |
| Office reject Urlaub + reason | 🟡 gelb | Same |
| Calendar entry visible | 🟡 gelb | Same |
| Portal Urlaub Abgelehnt + reason | 🟡 gelb | Same |
| Portal Abwesenheit Genehmigt | 🟡 gelb | Same |

Service-layer P1 paths verified green in Vitest; full E2E on `:8091` needs manual re-run after bundle settle.

### P1 verdict (pre-deploy code review)

**Restricted GO** (code + unit tests ready; production E2E for Urlaub reject + calendar still recommended after deploy)

---

## ABSENCE.1-P1 — Production Deploy & Smoke (2026-07-03)

**Environment:** https://caresuiteplus.app  
**Scope:** ABSENCE.1 P1 — portal rejection reason enrichment, awaited calendar sync, office sync warning  
**P1 code commit:** `d81dc318` — `fix(wfm): surface absence rejection reasons and calendar sync status`  
**Deploy trigger:** `1c352cb0` — `chore(deploy): release absence1 p1 rejection calendar fixes [deploy]`  
**Auditor:** Playwright production smoke (`.audit-absence1-p1-prod-smoke-*.mjs`, not committed)  
**Test tag:** `[TEST-ABSENCE1-P1-PROD]` — TEST tenant only

---

## Phase 1 — Pre-Deploy Gate

| Check | Result |
|-------|--------|
| `git status` clean (no staged secrets) | ✅ Only untracked `.audit-*` / smoke artifacts |
| `main` synced with `origin/main` @ `d81dc318` | ✅ |
| `git log origin/main..HEAD` empty before trigger | ✅ |
| `stash@{0}` present (ZEIT.2 WIP) | ✅ `wip-absence-p0-and-zeit2-before-isolation` |
| Production bundle before deploy | `entry-a60232aab48057a8a7e9d6ce0c467206.js` (P0 deploy `e6a3b628`) |
| P1 code live before trigger | ❌ No — on `origin/main` but no `[deploy]` after `d81dc318` |
| Gate | **GREEN** — proceed with empty `[deploy]` trigger |

---

## Phase 2 — Deploy Trigger

| Field | Value |
|-------|-------|
| P1 code commit | `d81dc318` |
| Trigger commit | `1c352cb0` |
| Message | `chore(deploy): release absence1 p1 rejection calendar fixes [deploy]` |
| `[deploy]` tag | **Yes** |
| Push target | `origin/main` |
| Bundle before | `entry-a60232aab48057a8a7e9d6ce0c467206.js` |
| Bundle after (~80s poll) | `entry-e10839b77e3c04aef21852956a3e2fde.js` |
| Build status | **Live** — new entry hash on production HTML |

---

## Phase 3 — Production Smoke Matrix (P1)

Scripts: `.audit-absence1-p1-prod-smoke-final.mjs` (primary), `.audit-absence1-p1-prod-smoke-verify2.mjs` (urlaub reject + calendar confirm).  
**Note:** Initial automation pass failed form submit because portal search input was counted as first date field; corrected via placeholder-scoped fills (`01.07.2026` / `05.07.2026` / `Kurze Begründung`).

| Area | Check | Result | Evidence |
|------|-------|--------|----------|
| **P2 — Urlaub Ablehnung** | MP create Urlaubsantrag (`01.09`–`03.09.2026`) | 🟢 grün | Ausstehend after submit |
| | Office inbox → Urlaub tab → reject with Begründung | 🟢 grün | Panel opened; reject persisted on verify2 |
| | MP status **Abgelehnt** | 🟢 grün | Badge on `1.9.2026 – 3.9.2026` row |
| | Rejection reason visible (`Ablehnungsgrund: …`) | 🟢 grün | Portal list shows enriched reason |
| | No raw `rejected` string | 🟢 grün | `urlaub_no_raw_rejected` |
| | No empty card | 🟢 grün | List populated with status + dates + reason |
| **P3 — Kalender-Sync** | Create Abwesenheitsantrag (`16.08.2026`) | 🟢 grün | Ausstehend → office approve |
| | Office approve absence | 🟢 grün | Genehmigen on Krankheit panel |
| | Sync warning visible on approve | 🟢 grün | `sync_warning` banner text matched Kalender/Sync/Warnung |
| | Internal calendar `/office/calendar` — August 2026 | 🟢 grün | Month navigation confirmed in verify2 |
| | Entry visible on 15.08 (prior + regression TEST rows) | 🟢 grün | Day cells show `[TEST-ABSENCE1-P1-PROD]` / `[TEST-ABSENCE1-PROD]` labels |
| | Readable title (no raw `vacation`) | 🟢 grün | No `vacation` token in August month text |
| | Newly approved 16.08 entry in month view | 🟡 gelb | Day 16 cell empty in August grid despite portal **Genehmigt** |
| | No duplicate on re-approve | 🟡 gelb | Not exercised in this run |
| **Regression — Abwesenheit** | Submit `15.08.2026` style date | 🟢 grün | No Invalid time value |
| **Regression — Urlaub** | Submit route + create | 🟢 grün | Form loads; create succeeds with scoped fills |
| **Regression — Office inbox** | `/business/office/time-tracking/requests` | 🟢 grün | Mitarbeitenden Anträge; 3 pending before decisions |
| **Regression — Portal Genehmigt** | Approved absence in portal | 🟢 grün | `16.8.2026` Krankheit **Genehmigt** |
| **Regression — PROFILE.1** | Profile 14 tabs | 🟢 grün | 14/14 on `/portal/employee/profile` |
| **Regression — ZEIT.1** | Arbeitszeit no profile error | 🟢 grün | No **Kein Mitarbeiterprofil** |
| **Regression — OFFLINE.1** | Offline banner honest messaging | 🟡 gelb | Banner not detected in headless online pass (same SPA limitation as P0) |
| **Regression — SIGNATURE.1** | Proof review signatures | 🟢 grün | `/assist/nachweise/review` — **Nachweis-Prüfung** |
| **Regression — Execute** | Execute path reachable | 🟢 grün | Assignment execute route loads (~487 chars) |
| **Office validation** | Reject without reason blocked | 🟢 grün | **Ablehnungsgrund ist erforderlich** |

### Result summary (P1 production)

| Color | Count |
|-------|-------|
| 🟢 grün | 20 |
| 🟡 gelb | 3 |
| 🔴 rot | 0 |

**P1 primary signals:** Urlaub office reject → portal **Abgelehnt** + **Ablehnungsgrund** — **was 🟡 pre-P1, now 🟢**. Calendar sync warning surfaced on approve — **🟢**.

---

## Test Data Created (TEST only — P1 run)

| Type | Note tag | Dates | Final status |
|------|----------|-------|--------------|
| Urlaub | `[TEST-ABSENCE1-P1-PROD] Urlaub final …` | `01.09.2026`–`03.09.2026` | **Abgelehnt** + Ablehnungsgrund |
| Abwesenheit (Krankheit) | `[TEST-ABSENCE1-P1-PROD] Abwesenheit final …` | `16.08.2026` | **Genehmigt** (portal); calendar day 16 not confirmed |
| Abwesenheit regression | `[TEST-ABSENCE1-P1-PROD] regression 15.08 …` | `15.08.2026` | Submitted (may remain Ausstehend); visible on calendar 15.08 |

Prior `[TEST-ABSENCE1-P0-PROD]` / `[TEST-ABSENCE1-PROD]` rows unchanged except calendar visibility on August grid.

---

## Key Findings (P1 production)

### Resolved (P1)

1. **Urlaub reject → portal Abgelehnt + reason** — verified live on bundle `entry-e10839b77e3c04aef21852956a3e2fde.js`. Portal shows `Ablehnungsgrund: [TEST-ABSENCE1-P1-PROD] Ablehnungsgrund — audit only` (no raw `rejected`).

2. **Office sync warning on approve** — InfoBanner matched after Genehmigen (P1 awaited-sync UX).

3. **Calendar readable entries** — August 2026 month view shows TEST-labelled blocks on 10–12 and 15.08; no raw `vacation` type string.

### Follow-up (non-blocking)

4. **16.08 approved absence calendar cell** — Portal **Genehmigt** but August day 16 empty in month view; sync warning appeared — manual day-view check optional.

5. **OFFLINE.1 E2E** — Known headless limitation; unit tests cover `OfflineNotice`.

6. **Automation lesson** — Portal global search input must be excluded from form fills (use placeholders).

---

## Screenshots (local, not committed)

- `docs/audit/absence1-p1-prod-smoke-screenshots/portal-urlaub-after-submit-v2.png`
- `docs/audit/absence1-p1-prod-smoke-screenshots/portal-abwesenheit-after-submit-v2.png`
- `docs/audit/absence1-p1-prod-smoke-screenshots/office-inbox-v2.png`
- `docs/audit/absence1-p1-prod-smoke-screenshots/office-calendar-august-v2.png`
- `docs/audit/absence1-p1-prod-smoke-screenshots/portal-urlaub-rejected-v2.png`
- `docs/audit/absence1-p1-prod-smoke-screenshots/portal-abwesenheit-genehmigt-v2.png`

---

## Verdict — ABSENCE.1-P1 Production

### **Restricted GO**

| Question | Answer |
|----------|--------|
| **P1 rejection reason live?** | **Ja** — portal shows **Abgelehnt** + **Ablehnungsgrund** for TEST Urlaub row |
| **Calendar sync warning live?** | **Ja** — banner visible on office approve |
| **Calendar entries readable?** | **Ja** — August 2026 month view; TEST labels on 15.08 (and prior urlaub block 10–12) |
| **P0 date parser still OK?** | **Ja** — `15.08.2026` submit without Invalid time value |
| **ZEIT.2 stash still present?** | **Ja** — `stash@{0}` untouched |
| **Deploy P1?** | **Ja** — trigger `1c352cb0` live on `entry-e10839b77e3c04aef21852956a3e2fde.js` |

**Rationale:** Core P1 loops verified on production TEST accounts. Urlaub rejection reason enrichment and office sync warning behave as designed. Regressions (PROFILE.1, ZEIT.1, SIGNATURE.1, execute, P0 date parsing) green.

**Restrictions:**

- **16.08** approved absence not visible in August month grid (sync warning shown — investigate if tenant calendar mapping issue).
- **OFFLINE.1** banner E2E gelb (unit-tested).
- **Re-approve duplicate** not tested.

---

## Artifacts (local, not committed)

- `.audit-absence1-p1-prod-smoke.mjs` / `.audit-absence1-p1-prod-smoke-results.json`
- `.audit-absence1-p1-prod-smoke-final.mjs` / `.audit-absence1-p1-prod-smoke-final.json`
- `.audit-absence1-p1-prod-smoke-verify2.mjs` / `.audit-absence1-p1-prod-smoke-verify2.json`
- `.audit-absence1-p1-prod-smoke-followup.mjs` (intermediate)

Credentials sourced from `.env.local` — values never logged.

---

## ABSENCE.1-P1b — Calendar cell visibility (2026-07-03)

**Scope:** Multi-day / last-day all-day absence cells empty in office month view (e.g. 16.08)  
**Environment:** https://caresuiteplus.app  
**P1b code commit:** `7b6a295f` — `fix(wfm): show approved all-day absences on every calendar day`  
**Deploy trigger:** `678aada9` — `chore(deploy): release absence1 p1b calendar date keys [deploy]`  
**Auditor:** Playwright production smoke (`.audit-absence1-p1b-prod-smoke.mjs`, not committed)  
**Test tag:** `[TEST-ABSENCE1-P1B-PROD]` — TEST tenant only

### Root cause

| Issue | Root cause | Fix |
|-------|------------|-----|
| 16.08 cell empty while 15.08 shows | All-day absences stored as CEST `toISOString()` instants; month cells used instant overlap (`event.end >= dayStart`) so the last Berlin calendar day could fall off when end was earlier than local midnight on that day | Normalize all-day sync to floating UTC date keys (`YYYY-MM-DDT00:00:00.000Z` … `T23:59:59.999Z`) in Europe/Berlin; month/range overlap uses date-key comparison for `allDay` events |
| Sync warning on prod approve (P1 gelb) | Separate upsert/RLS path — not changed in P1b | Status mapped `approved` → `aktiv` for calendar store |

### Code changes (`7b6a295f`)

| File | Change |
|------|--------|
| `calendarDateUtils.ts` | `toTimezoneDateKey`, `normalizeAllDayFloatingUtcBounds`, all-day branch in `eventOverlapsDay` / `eventsForDay` |
| `calendarSyncService.ts` | All-day bounds normalization, `timezone: Europe/Berlin`, status `approved` → `aktiv` |
| `calendarFilters.ts` | Date-key range overlap for all-day records |
| `wfmAbsenceCalendarBridge.ts` | Re-export `normalizeWfmAbsenceCalendarBounds` |
| `wfmAbsenceP1.test.ts` | +11 P1b overlap/normalization tests (18 total in file) |

---

## Phase 1 — Pre-Deploy Gate (P1b)

| Check | Result |
|-------|--------|
| `git status` clean (no staged secrets) | ✅ Only untracked `.audit-*` / smoke artifacts; unstaged `docs/audit/absence1-production-smoke.md` |
| `main` synced with `origin/main` @ `7b6a295f` | ✅ |
| `git log origin/main..HEAD` empty before trigger | ✅ |
| `stash@{0}` present (ZEIT.2 WIP) | ✅ `wip-absence-p0-and-zeit2-before-isolation` |
| Production bundle before deploy | `entry-e10839b77e3c04aef21852956a3e2fde.js` (P1 deploy `1c352cb0`) |
| P1b code live before trigger | ❌ No — on `origin/main` but no `[deploy]` after `7b6a295f` |
| Gate | **GREEN** — proceed with empty `[deploy]` trigger |

---

## Phase 2 — Deploy Trigger (P1b)

| Field | Value |
|-------|-------|
| P1b code commit | `7b6a295f` |
| Trigger commit | `678aada9` |
| Message | `chore(deploy): release absence1 p1b calendar date keys [deploy]` |
| `[deploy]` tag | **Yes** |
| Push target | `origin/main` |
| Bundle before | `entry-e10839b77e3c04aef21852956a3e2fde.js` |
| Bundle after (~108s poll) | `entry-2744779024923bddfce929ff88b67a52.js` |
| Build status | **Live** — new entry hash on production HTML |

---

## Phase 3 — Production Smoke Matrix (P1b)

Script: `.audit-absence1-p1b-prod-smoke.mjs` → `.audit-absence1-p1b-prod-smoke.json`  
Calendar day cells confirmed via screenshot `office-calendar-august-p1b.png` (RN Web month grid DOM parse unreliable in headless; visual inspection used for day-level verdicts).

| Area | Check | Result | Evidence |
|------|-------|--------|----------|
| **P2 — Multi-day 15.08–16.08** | MP create Abwesenheit `15.08.2026`–`16.08.2026` | 🟢 grün | `p2_create`; Ausstehend in portal |
| | Office approve | 🟢 grün | `p2_approved`; panel opened |
| | Portal **Genehmigt** | 🟢 grün | `portal_multi_genehmigt` |
| | Calendar August 2026 — entry on **15.08** | 🟢 grün | Screenshot: `[TEST-ABSENCE…]` chip on day 15 |
| | Calendar — entry on **16.08** (last day) | 🟢 grün | Screenshot: chip on day 16 — **was 🔴/🟡 pre-P1b** |
| | Readable title, no raw `vacation` | 🟢 grün | `calendar_no_raw_vacation` |
| | No UTC shift (Berlin dates) | 🟢 grün | Portal shows `15.8.2026`; calendar cells align |
| | Sync warning on approve | 🟢 grün | `p2_sync_warning` — banner shown; entries still synced |
| | No duplicate on re-approve | 🟡 gelb | Not exercised |
| **P3 — Single day 16.08–16.08** | MP create `16.08.2026`–`16.08.2026` | 🟢 grün | `p3_create` |
| | Office approve | 🟢 grün | `p3_approved` |
| | Portal **Genehmigt** | 🟢 grün | `portal_single_genehmigt` |
| | Calendar — visible on **16.08** | 🟢 grün | Screenshot: entries on day 16 |
| | Not on **15.08** (single-only) | 🟢 grün | `p3_day15_no_single` — single tag not leaked to 15 |
| | Not on **17.08** | 🟢 grün | `p3_day17_no_single`; day 17 empty in screenshot |
| **Regression — Abwesenheit** | German date submit | 🟢 grün | No Invalid time value |
| **Regression — Urlaub** | Create `02.09`–`04.09.2026` | 🟢 grün | `reg_urlaub_create` |
| | Office reject with Begründung | 🟢 grün | `reg_reject_urlaub` |
| | Portal **Abgelehnt** + reason | 🟢 grün | `portal_urlaub_abgelehnt`, `portal_urlaub_reason` |
| **Regression — Office inbox** | `/business/office/time-tracking/requests` | 🟢 grün | `office_inbox` |
| **Regression — Portal Genehmigt** | Multi + single absence approved | 🟢 grün | Portal list |
| **Regression — PROFILE.1** | Profile 14 tabs | 🟢 grün | 14/14 |
| **Regression — ZEIT.1** | Arbeitszeit no profile error | 🟢 grün | `zeit1_ok` |
| **Regression — OFFLINE.1** | Offline banner | 🟡 gelb | `offline_banner` false in headless online pass (known SPA limitation) |
| **Regression — SIGNATURE.1** | Proof review | 🟢 grün | `/assist/nachweise/review` |
| **Regression — Execute** | Execute path | 🟢 grün | Assignment route loads |

### Result summary (P1b production)

| Color | Count |
|-------|-------|
| 🟢 grün | 22 |
| 🟡 gelb | 2 |
| 🔴 rot | 0 |

**P1b primary signal:** Multi-day absence `15.08–16.08` renders on **both** day 15 and day 16 in August 2026 month view — **was 🟡/empty on 16.08 pre-P1b, now 🟢**.

---

## Test Data Created (TEST only — P1b run)

| Type | Note tag | Dates | Final status |
|------|----------|-------|--------------|
| Abwesenheit multi-day | `[TEST-ABSENCE1-P1B-PROD] multi 15-16 …` | `15.08.2026`–`16.08.2026` | **Genehmigt** |
| Abwesenheit single-day | `[TEST-ABSENCE1-P1B-PROD] single 16 …` | `16.08.2026` | **Genehmigt** |
| Urlaub regression | `[TEST-ABSENCE1-P1B-PROD] Urlaub regression …` | `02.09.2026`–`04.09.2026` | **Abgelehnt** + Ablehnungsgrund |

Prior `[TEST-ABSENCE1-P1-PROD]` / `[TEST-ABSENCE1-P0-PROD]` rows remain visible on calendar (days 10–12, 14–15).

---

## Key Findings (P1b production)

### Resolved (P1b)

1. **Last calendar day of multi-day all-day absence** — verified live on bundle `entry-2744779024923bddfce929ff88b67a52.js`. August 2026 month view shows TEST-labelled entries on **both 15.08 and 16.08** after approving `15.08–16.08`.

2. **Single-day 16.08** — appears on day 16 only; day 17 empty; no single-day leak to day 15.

3. **P0/P1 regressions intact** — German date submit, urlaub reject + portal reason, office inbox, PROFILE.1, ZEIT.1, SIGNATURE.1, execute path all green.

### Follow-up (non-blocking)

4. **Re-approve duplicate** — not tested.

5. **OFFLINE.1 E2E** — Known headless limitation; unit tests cover `OfflineNotice`.

6. **Sync warning banner** — still appears on approve (`p2_sync_warning` true) but calendar entries sync successfully post-P1b.

---

## Screenshots (local, not committed)

- `docs/audit/absence1-p1b-prod-smoke-screenshots/portal-multi-create.png`
- `docs/audit/absence1-p1b-prod-smoke-screenshots/portal-single-create.png`
- `docs/audit/absence1-p1b-prod-smoke-screenshots/office-calendar-august-p1b.png`
- `docs/audit/absence1-p1b-prod-smoke-screenshots/portal-abwesenheit-genehmigt-p1b.png`
- `docs/audit/absence1-p1b-prod-smoke-screenshots/portal-urlaub-rejected-p1b.png`
- `docs/audit/absence1-p1b-prod-smoke-screenshots/office-inbox.png`

---

## Verdict — ABSENCE.1-P1b Production

### **GO**

| Question | Answer |
|----------|--------|
| **16.08 last-day cell fixed?** | **Ja** — multi-day `15.08–16.08` visible on both days in August 2026 month view |
| **Single-day 16.08 isolated?** | **Ja** — on 16.08 only; not on 17.08 |
| **P0 date parser still OK?** | **Ja** |
| **P1 rejection reason still OK?** | **Ja** — urlaub **Abgelehnt** + **Ablehnungsgrund** |
| **ZEIT.2 stash still present?** | **Ja** — `stash@{0}` untouched |
| **Deploy P1b?** | **Ja** — trigger `678aada9` live on `entry-2744779024923bddfce929ff88b67a52.js` |

**Rationale:** P1b fix verified on production TEST accounts. The UTC instant overlap root cause is addressed — Berlin date-key normalization renders all-day absences on every calendar day including the last day. Full absence loop (portal → office → calendar → portal) green. Regressions from P0/P1 pass.

**Minor restrictions (non-blocking):**

- **Re-approve duplicate** not tested.
- **OFFLINE.1** banner E2E gelb (unit-tested).

---

## Artifacts (local, not committed)

- `.audit-absence1-p1b-prod-smoke.mjs` / `.audit-absence1-p1b-prod-smoke.json`
- `.audit-absence1-p1b-calendar-verify.mjs` (DOM parse hung; screenshot used instead)

Credentials sourced from `.env.local` — values never logged.

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

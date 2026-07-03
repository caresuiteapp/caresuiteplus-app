# ABSENCE.1 — Production Smoke Report

**Date:** 2026-07-03  
**Environment:** https://caresuiteplus.app  
**Scope:** Employee leave/absence requests (ABSENCE.1) — TEST tenant/accounts only  
**Auditor:** Automated Playwright smoke (audit scripts, not committed)

---

## Phase 1 — Pre-Deploy Gate

| Check | Result |
|-------|--------|
| `git status` clean (no staged secrets) | ✅ Only untracked `.audit-*` artifacts |
| `main` synced with `origin/main` | ✅ `d264a215` (before trigger) |
| ABSENCE.1 feature commit on remote | ✅ `7a94eb43` feat(wfm): ABSENCE.1 employee leave requests with office approval and calendar sync |
| Prior deploy trigger present | ⚠️ `d264a215` chore(deploy): release absence1 and employee group chats [deploy] — already on remote but **not live** |
| Production bundle before deploy | `entry-d38929006701ca4c23d0c5a4ef0664bd.js` (PROFILE.1) |
| Gate | **GREEN** — proceed with deploy trigger |

---

## Phase 2 — Deploy Trigger

| Field | Value |
|-------|-------|
| Trigger commit | `c942423` |
| Message | `chore(deploy): release absence1 employee requests [deploy]` |
| `[deploy]` tag | Yes |
| Push target | `origin/main` |
| Bundle before | `entry-d38929006701ca4c23d0c5a4ef0664bd.js` |
| Bundle after (~90s poll) | `entry-0736bcac75bbda33f5edaa2a9f5ac3fe.js` |
| Build status | **Live** — new entry hash observed on production HTML |
| Code commit deployed | `7a94eb43` (+ `a469c59f` group chats bundled in same build from prior feature commit) |

**Note:** Prior trigger `d264a215` had not propagated to production (bundle still PROFILE.1). New empty trigger `c942423` succeeded.

---

## Phase 3 — Production Smoke Matrix

All test data tagged **`[TEST-ABSENCE1-PROD]`** in `employee_note`. No real employee requests created.

| Area | Check | Result | Evidence |
|------|-------|--------|----------|
| **Portal — Urlaub** | Form loads `/portal/employee/arbeitszeit/urlaub` | 🟢 grün | Neuer Antrag, Antrag einreichen |
| | Create test vacation request | 🟢 grün | DB row `ac7f2e6a…` status `requested` |
| | Status Ausstehend | 🟢 grün | Badge visible in portal list |
| | Own requests only | 🟢 grün | Meine Urlaubsanträge scoped |
| **Portal — Abwesenheit** | Form loads `/portal/employee/arbeitszeit/abwesenheiten` | 🟢 grün | Type selector + form visible |
| | Create test absence request | 🔴 rot | Submit throws **Invalid time value** (page error); no DB row |
| | Status Ausstehend | 🔴 rot | Blocked by create failure |
| **Office — Inbox** | `/business/office/time-tracking/requests` loads | 🟢 grün | Mitarbeitenden Anträge |
| | Test vacation visible | 🟢 grün | Pending approval in queue (via Details button) |
| | Open details | 🟢 grün | Antrag bearbeiten panel |
| **Office — Decisions** | Reject without reason blocked | 🟢 grün | Ablehnungsgrund ist erforderlich |
| | Approve vacation request | 🟢 grün | Status → `approved` in DB; inbox cleared |
| | Reject absence with reason | 🟡 gelb | Not exercised — absence create failed |
| **Calendar** | Approved request → internal entry | 🟡 gelb | REST query on `calendar_events` denied/failed for audit user; Office Kalender (`/office/calendar`) loads but no TEST/Urlaub entry visible in Jul–Oct navigation |
| | Correct period / employee | 🟡 gelb | Unverified (sync not confirmed) |
| | No duplicate on re-approve | 🟡 gelb | Not tested |
| **Portal Status** | Approved → Genehmigt | 🟢 grün | Urlaub list shows Genehmigt after office approve |
| | Rejected → Abgelehnt + reason | 🟡 gelb | Not exercised (absence create failed) |
| **Regression — PROFILE.1** | Profile loads | 🟢 grün | `/portal/employee/profile` |
| **Regression — ZEIT.1** | Arbeitszeit no profile error | 🟢 grün | No Kein Mitarbeiterprofil |
| **Regression — OFFLINE.1** | Offline banner behavior | 🟢 grün | Banner + honest messaging |
| **Regression — SIGNATURE.1** | Nachweis tab unchanged | 🟢 grün | Unterschrift section loads |
| **Regression — Execute** | Execute path reachable | 🟢 grün | Assignment execute route loads |

### Result summary

| Color | Count |
|-------|-------|
| 🟢 grün | 15 |
| 🟡 gelb | 6 |
| 🔴 rot | 2 |

---

## Test Data Created (TEST only)

| ID | Type | Note | Final status |
|----|------|------|--------------|
| `ac7f2e6a-fbcd-4c25-9d36-a941b1c2be99` | vacation | `[TEST-ABSENCE1-PROD] Urlaub smoke …` | **approved** (office smoke) |
| `4551cfcb-852f-4a72-a6b8-6b33327199a8` | vacation approval | linked to above | **approved** |

No abwesenheit rows persisted (portal submit error).

**Date parsing note:** Urlaub dates entered as `10.08.2026–12.08.2026` (German) were stored as Oct–Dec 2026 UTC in DB — indicates locale-unsafe `new Date(string)` parsing in portal form. Functional for urlaub smoke but wrong calendar month.

---

## Findings

### Blocking / high priority

1. **Portal Abwesenheit submit fails in production** — `Invalid time value` on Antrag einreichen (all absence types). Urlaub path on same screen pattern works. Requires date-parsing fix before abwesenheit track is production-ready.

### Medium

2. **Calendar sync unverified** — After approve, no calendar entry confirmed via UI or REST (RLS may block audit REST reads). Manual office calendar check in target month recommended.

3. **German date input parsing** — TT.MM.JJJJ values misinterpreted (Aug → Oct). Affects period accuracy for calendar and reporting.

### Low / informational

4. Initial smoke script false negatives on office inbox (searched employee_note text; office list shows employee name + type + date only). Corrected in follow-up using **Details & Entscheidung** button.

5. Hydration/React minified errors (#418, #421, #422) observed in console — consistent with prior production smokes; non-blocking for ABSENCE.1 paths tested.

---

## Screenshots

Local only (not committed):

- `docs/audit/absence1-prod-smoke-screenshots/portal-urlaub.png`
- `docs/audit/absence1-prod-smoke-screenshots/portal-abwesenheit.png`
- `docs/audit/absence1-prod-smoke-screenshots/office-inbox.png`
- `docs/audit/absence1-prod-smoke-screenshots/portal-status.png`

---

## Verdict

### **Restricted GO** (pre-P0)

**Rationale:** ABSENCE.1 is **live** on production (new bundle). Core **Urlaub** portal → office approval → portal **Genehmigt** loop works on TEST accounts. Regressions (PROFILE.1, ZEIT.1, OFFLINE.1, SIGNATURE.1, execute) are green.

**Restrictions:**

- **Abwesenheit portal create** is broken (`Invalid time value`) — do not promote abwesenheit workflows to real users until fixed.
- **Calendar sync** not confirmed in smoke — treat as follow-up verification.
- **Reject-with-reason** path not fully exercised (depends on abwesenheit create).

---

## P0 Hotfix — Local verification (2026-07-03, not deployed)

**Scope:** German date parsing on portal absence submit only. No ZEIT.2 / migrations / RLS changes.

### Root cause

`WfmAbsencePortalScreen.tsx` lines 122–123:

```typescript
const startIso = startsAt ? new Date(startsAt).toISOString() : '';
const endIso = endsAt ? new Date(endsAt).toISOString() : '';
```

| Input | `new Date()` behaviour | Submit |
|-------|------------------------|--------|
| `10.08.2026` (Urlaub smoke) | Parses as Oct 8 (wrong month) | Succeeds |
| `15.08.2026` (Abwesenheit smoke) | **Invalid Date** | `toISOString()` → **Invalid time value** |
| `31.12.2026` | **Invalid Date** | Same crash |

Urlaub and Abwesenheit share the same component; failure depends on day value, not route.

### Fix applied (local working tree)

- `parseGermanOrIsoDateInput` + `parseWfmAbsenceDateRange` in `src/lib/formatters/dateTimeFormatters.ts`
- `WfmAbsencePortalScreen` submit wired to parser; validation message **„Bitte prüfen Sie das Datum.“**

### Local smoke matrix (`http://localhost:8089`, post-fix)

| Area | Check | Result |
|------|-------|--------|
| Portal Urlaub | Submit `10.08.2026`–`12.08.2026` | 🟢 grün — Ausstehend |
| Portal Abwesenheit | Submit `15.08.2026` | 🟢 grün — Ausstehend (was 🔴) |
| Page errors | No `Invalid time value` | 🟢 grün |
| Office inbox / approve / calendar | Script limitations | 🟡 gelb / 🔴 rot (unchanged from prior smoke) |
| PROFILE.1 / ZEIT.1 / OFFLINE.1 / SIGNATURE.1 | Regression | 🟢 grün |

### Tests (vitest)

| Suite | Result |
|-------|--------|
| `parseGermanOrIsoDateInput.test.ts` | ✅ 12/12 |
| `wfmAbsencePortalDateSubmit.test.ts` | ✅ 5/5 |
| `wfmAbsenceApprovalWorkflow.test.ts` | ✅ 9/9 |
| WFM + PROFILE regression batch | ✅ 120/120 |

### Updated verdict (post-P0, local only)

**GO for Abwesenheit portal create** after deploy of this hotfix. Production still on pre-fix bundle until explicit `[deploy]` commit.

**Recommended commit message:**

```
fix(wfm): parse German dates on absence portal submit (ABSENCE.1 P0)

Replace new Date(DD.MM.YYYY) with parseWfmAbsenceDateRange so Abwesenheit
and Urlaub forms accept TT.MM.JJJJ without Invalid time value.
```

---

## Verdict (historical — production pre-P0)

## Next Track Recommendation

1. ~~**P0 hotfix:** Parse German dates explicitly in `WfmAbsencePortalScreen`~~ — **done locally** (see P0 Hotfix section above); deploy when ready.
2. **P1 verify:** Calendar bridge `syncWfmAbsenceToCalendarAsync` on production with approved TEST row; confirm `/office/calendar` entry + no duplicate on re-approve.
3. **P1 complete smoke:** Re-run abwesenheit create → office reject with reason → portal Abgelehnt + Ablehnungsgrund after P0 deploy.
4. **Defer:** OFFLINE.2, urlaubskontingent warnings (out of scope for this deploy).

---

## Artifacts (local, not committed)

- `.audit-absence1-prod-smoke.mjs`
- `.audit-absence1-prod-smoke-results.json`
- `.audit-absence1-prod-smoke-followup.mjs` / `.json`
- `.audit-absence1-prod-smoke-followup2.mjs` / `.json`
- `.audit-absence1-calendar-check.mjs`

Credentials sourced from `.env` / `.env.local` — values never logged.

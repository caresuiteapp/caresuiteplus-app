# ABSENCE.1 — Employee Leave/Absence Request Workflow

**Date:** 2026-07-03  
**Scope:** Mitarbeitendenportal Urlaub/Abwesenheiten + Office Genehmigung + interner Kalender-Sync  
**Status:** Implementation complete (no migration required)

---

## Phase 1 — Preflight

| Check | Result |
|-------|--------|
| Branch | `main` |
| Sync with `origin/main` | ✅ `4a0911ed` (in sync) |
| Untracked `.audit-*` | ✅ Present (audit artifacts only, not committed) |
| Uncommitted PROFILE.1 docs | ⚠️ `docs/audit/profile1-*` and portal profile code still uncommitted — **not touched by ABSENCE.1** |
| Blocker from unrelated changes | ❌ None — PROFILE work is isolated; ABSENCE.1 proceeded |

---

## Phase 2 — Existing Structures Audit

### Tables (production verified via Supabase MCP)

| Table | Exists | Used by ABSENCE.1 |
|-------|--------|-------------------|
| `workforce_absences` | ✅ | Canonical WFM absence store |
| `workforce_approvals` | ✅ | Unified approval queue |
| `employee_absences` | ✅ | Legacy (sync Phase 2; not duplicated) |
| `calendar_events` | ✅ | Internal calendar sync target |

**Migration 0190** applied on production. **Migration 0223** (RLS alignment) not confirmed in migration history — existing 0190 RLS used; no RLS changes made.

### Portal routes (pre-existing, enhanced)

| Route | Component | Notes |
|-------|-----------|-------|
| `/portal/employee/arbeitszeit/urlaub` | `WfmAbsencePortalScreen` | Urlaub-only list + form |
| `/portal/employee/arbeitszeit/abwesenheiten` | `WfmAbsencePortalScreen` | Non-vacation types |

### Office approval surface

| Surface | Path | Notes |
|---------|------|-------|
| Team-Arbeitszeit (quick actions) | `/business/office/time-tracking/team` | KPI + quick approve/reject |
| **Mitarbeitenden Anträge** (new) | `/business/office/time-tracking/requests` | Filters, details, mandatory rejection reason, conflict hints |
| Legacy demo absence service | `src/lib/office/absenceService.ts` | In-memory demo; **not modified** |

### Services reused

- `wfmAbsenceService.ts` — CRUD on `workforce_absences`
- `wfmApprovalService.ts` — approval queue on `workforce_approvals`
- `calendarSyncService.ts` — idempotent upsert via `source_id` = absence id
- `absenceConflictService.ts` — assignment overlap patterns

---

## Phase 3–9 — Implementation Summary

### Portal workflow ✅

- Create vacation/absence requests via existing WFM service
- `usePortalActor().employeeId` scoping preserved
- Status badges: Ausstehend / Genehmigt / Abgelehnt / Zurückgezogen
- Rejection reason visible when `internal_note` set on reject
- Withdraw (`cancelled`) for pending requests
- Urlaub vs Abwesenheit filtered lists
- Abwesenheit types: Krankmeldung, Blockierte Zeit (Arzttermin), Fortbildung, Sonderurlaub, Sonstige
- No calendar block until approved (sync only on approve)

### Office "Mitarbeitenden Anträge" ✅

- New screen `WfmEmployeeRequestsOfficeScreen`
- Filter: Alle / Urlaub / Abwesenheit
- Approve with optional comment
- Reject with **mandatory** rejection reason
- Conflict warnings (overlap, assignments) — warnings only, no auto-reject

### Calendar sync on approval ✅

- `wfmAbsenceCalendarBridge.ts` maps `WfmAbsence` → `EmployeeAbsence` for `calendarSyncService`
- Idempotent upsert by `source_id` = absence id
- Cancel on reject/withdraw

### New / modified files

| File | Change |
|------|--------|
| `src/lib/wfm/wfmAbsenceApprovalWorkflow.ts` | Unified review + office inbox |
| `src/lib/wfm/wfmAbsenceCalendarBridge.ts` | Calendar bridge |
| `src/lib/wfm/wfmAbsenceConflictService.ts` | WFM conflict detection |
| `src/lib/wfm/wfmAbsenceService.ts` | withdraw, getById, rejection validation |
| `src/components/wfm/WfmAbsencePortalScreen.tsx` | Portal UX enhancements |
| `src/components/wfm/WfmEmployeeRequestsOfficeScreen.tsx` | Office inbox |
| `app/business/office/time-tracking/requests.tsx` | Route |
| `src/lib/navigation/modulenav/officenav.ts` | Nav entry |

---

## Phase 10 — Tests

| Suite | Result |
|-------|--------|
| `wfmAbsenceService.test.ts` | ✅ 1/1 |
| `wfmAbsenceApprovalWorkflow.test.ts` | ✅ 9/9 |
| `parseGermanOrIsoDateInput.test.ts` | ✅ 12/12 |
| `wfmAbsencePortalDateSubmit.test.ts` | ✅ 5/5 |
| PROFILE regression (`employeePortalProfileLive.test.ts`) | ✅ 24/24 |
| ZEIT regression (`zeit1EmployeeResolverScreens.test.ts`) | ✅ 4/4 |

---

## P0 Hotfix — German date parsing (2026-07-03)

### Problem

Production smoke: Abwesenheit submit on `/portal/employee/arbeitszeit/abwesenheiten` threw **`Invalid time value`** when users entered `DD.MM.YYYY` (e.g. `15.08.2026`). Root cause: `WfmAbsencePortalScreen.handleSubmit` called `new Date(startsAt).toISOString()` on German-formatted strings. Days > 12 fail in locale-dependent `Date` parsing; Urlaub partially worked only when dates happened to parse (wrong month).

### Fix

| File | Change |
|------|--------|
| `src/lib/formatters/dateTimeFormatters.ts` | Added `parseGermanOrIsoDateInput`, `parseGermanOrIsoDateInputToIso`, `parseWfmAbsenceDateRange` with calendar validation |
| `src/components/wfm/WfmAbsencePortalScreen.tsx` | Submit uses `parseWfmAbsenceDateRange`; user-facing error **„Bitte prüfen Sie das Datum.“** |

Accepted inputs: `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, `DD.MM.YYYY`, `DD.MM.YYYY HH:mm`, `DD.MM.YYYY, HH:mm`, `Date`. All-day requests use local day start/end (00:00 / 23:59:59.999).

### Local verification (`:8089`)

| Check | Status |
|-------|--------|
| Abwesenheit submit `15.08.2026` | 🟢 — Ausstehend, no page error |
| Urlaub submit `10.08.2026–12.08.2026` | 🟢 — correct August dates in DB |
| PROFILE / ZEIT.1 / OFFLINE.1 / SIGNATURE regressions | 🟢 |

**Recommended commit message:**

```
fix(wfm): parse German dates on absence portal submit (ABSENCE.1 P0)

Replace new Date(DD.MM.YYYY) with parseWfmAbsenceDateRange so Abwesenheit
and Urlaub forms accept TT.MM.JJJJ without Invalid time value.
```

---

## Phase 11 — Browser Smoke (local `:8089`)

| Check | Status |
|-------|--------|
| MP login | 🟢 |
| MP Urlaub form | 🟢 |
| MP Abwesenheit form | 🟢 |
| MP profile regression | 🟢 |
| Office login | 🟢 |
| Office Mitarbeitenden Anträge page | 🟢 |

**Summary:** 🟢 6 / 🟡 0 / 🔴 0

Screenshots: `docs/audit/absence1-smoke-screenshots/`

---

## Constraints Compliance

| Constraint | Status |
|------------|--------|
| No commit/push/deploy | ✅ |
| No new migrations | ✅ Tables exist |
| No RLS changes | ✅ |
| No ZEIT/WFM clock damage | ✅ Absence path only |
| No PROFILE/Execute/Signature changes | ✅ Regression green |
| Internal calendar only | ✅ |
| No auto-approval | ✅ Manual Office decision |
| No service role in client | ✅ |

---

## Commit Readiness

**Ready:** Yes — ABSENCE.1 changes are self-contained (WFM + office requests + tests + audit doc).

**Recommended commit message:**

```
feat(wfm): ABSENCE.1 employee leave requests with office approval and calendar sync

Wire portal Urlaub/Abwesenheit flows to workforce_absences/approvals, add Office
Mitarbeitenden Anträge inbox with conflict warnings, and sync approved absences
to the internal calendar.
```

**Note:** PROFILE.1 uncommitted work should be committed separately.

---

## Known Gaps / Follow-ups

1. **Vacation balance warning** — conflict service supports it but live balance lookup not wired (no blocking).
2. **Migration 0223** — portal RLS alignment may improve employee self-insert; not applied without approval.
3. **Notifications** — no new notification channel; status visible in portal lists only.
4. **Full E2E create→approve→calendar** — smoke verifies screens; live approve/calendar E2E not run in this session (demo mode tests cover service layer).

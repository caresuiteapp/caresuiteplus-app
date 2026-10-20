# ASSIST.PERMISSIONS.1 — Preflight Audit

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Production:** https://caresuiteplus.app

## Production bug — root cause

**Symptom:** Employee portal „Anfahrt läuft — Angekommen“ shows  
`Standortberechtigung nicht erteilt — bitte in den Geräteeinstellungen freigeben.`  
even though `en_route` is active and internal DB consent was granted.

**Exact error source chain:**

| Step | File | Line | Behaviour |
|------|------|------|-----------|
| 1 | `EmployeePortalVisitExecutionScreen.tsx` | `handleArrived` → `markArrived()` | User taps primary button |
| 2 | `useEmployeePortalVisitExecution.ts` | `handleMarkArrived` | Calls `captureEmployeePortalForegroundPosition` **before** workflow transition |
| 3 | `employeePortalVisitTrackingService.ts` | `captureEmployeePortalForegroundPosition` | Returns error when browser permission ≠ `granted` |
| 4 | `useEmployeePortalVisitExecution.ts` | `if (!pos.ok && localConsent?.granted) return { ok: false, error: pos.error }` | **Blocks** `markArrived` when internal consent exists but browser GPS denied |

**Root cause:** Conflation of **internal consent (DB)** with **browser permission (OS)**.  
The hook treats „consent granted + GPS capture failed“ as a hard error instead of allowing `markArrived` with `arrived_without_gps` fallback.

**Secondary UX gap:** Location permission is re-requested per workflow step; no central onboarding bundle for location, notifications, camera, microphone, signature.

## Separation model (ASSIST.PERMISSIONS.1)

| Layer | Storage | Blocks markArrived? |
|-------|---------|---------------------|
| Internal consent | `employee_location_consents` (0205) | No — only affects tracking start messaging |
| Browser permission | OS / `Permissions API` | No — yellow warning only |
| Workflow status | `assignments.status` / assist visits | Independent |
| GPS proof | `assist_location_points`, geofence events | Optional — `arrived_without_gps` / `arrived_manual` audit events |

## Existing infrastructure (reused)

| Area | Existing | Notes |
|------|----------|-------|
| Permanent consent | Migration **0205** `employee_location_consent_persist` | Do not recreate |
| markArrived | `src/features/assistWorkflow/markArrived.ts` | AWF.1 — needs fallback |
| GPS watch | `useSingleGeolocationWatch`, `useEmployeeGpsTracking` | PERF.1 singleton — keep |
| Consent save | `saveEmployeeLocationConsent.ts` | LT.GMAPS.5 |
| Time events | `assist_time_events` (0156) | Extend with `arrived_without_gps`, `arrived_manual` |

## Migration 0206 (new)

- `employee_permission_states` — browser permission snapshots per kind
- `employee_consent_bundle` — onboarding completion marker
- `assist_time_events` CHECK — add `arrived_without_gps`, `arrived_manual`
- Portal employee RLS; Assist/Office read-only

## Regression scope

- LT.GMAPS.3/4/5 tracking path unchanged
- PERF.1 single GPS watch unchanged
- AWF.1 workflow transitions unchanged except arrive fallback
- 0205 permanent consent untouched

## Kevin iPhone test context

- Employee: Kevin Reinhardt  
- Client: Heinz-Peter Reinhardt  
- Service: Hauswirtschaftliche Unterstützung  
- Scenario: Start en-route with consent, deny/limit Safari location, tap Angekommen → must succeed with yellow warning

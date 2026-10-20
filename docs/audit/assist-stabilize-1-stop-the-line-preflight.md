# ASSIST.STABILIZE.1 — Stop-the-Line Preflight

**Date:** 2026-06-29  
**Tenant:** Helferhasen (`56180c22-b894-4fab-b55e-a563c94dd6e7`)  
**Broken visit (prod):** `2a499c72-30f9-46bd-bfda-6a679ac85c73` (Kevin → Heinz-Peter Reinhardt)

## Production symptoms

| Symptom | Observed |
|---------|----------|
| Anfahrt 1:43, Einsatz „Noch nicht gestartet“ | `arrive` event exists, no `service_start`; DB status ahead of timestamps |
| „Einsatzstatus ist inkonsistent — bitte Schritte in Reihenfolge ausführen.“ | `startService` checked raw `assignmentStatus` instead of `derivedStatus` |
| „Einsatzstatus ohne Zeitstempel — bitte Einsatz starten bestätigen.“ | Warning banner from `resolveEffectiveWorkflowStatus` — dead-end UX |

## Conflicting status sources (pre-fix)

| Source | Role | Problem |
|--------|------|---------|
| `assignments.status` | DB canonical | Could be `beendet`/`gestartet` without `service_start` event |
| `assist_time_events` | Timer truth | Has `drive_start` + `arrive`, missing `service_start` |
| `resolveEffectiveWorkflowStatus` | UI overlay | Derived `angekommen` but services still used raw status |
| `resolveAllowedActions` | Buttons | Showed `start_service` via effective status |
| `startService` | Action | Rejected non-`angekommen` raw status → `WORKFLOW_INVALID_STATE` |
| `EmployeePortalVisitExecutionScreen` | UX | Scary warning banners blocked flow |

## Migrations 0200–0211 on prod (via MCP)

| Migration | Applied | Purpose |
|-----------|---------|---------|
| 0200 | ✓ | LT.GMAPS.2 employee tracking repair |
| 0201 | ✓ | LT.GMAPS.3 production DB repair |
| 0202 | ✓ | Consent route repair |
| 0203 | ✓ | Visit execution workflow tables |
| 0204 | ✓ | Live monitoring RLS |
| 0205 | ✓ | Location consent persist |
| 0206 | ✓ | Permission onboarding |
| 0207 | ✓ | Consent repair |
| 0208 | ✓ | Dual-role portal RLS |
| 0209 | ✓ | markArrived RLS |
| 0210 | ✓ | Time proof columns |
| 0211 | ✓ | Task batch index |

## STABILIZE.1 single source design

```
assist_time_events + assignments.status
        ↓
detectWorkflowInconsistencies
        ↓
deriveWorkflowStatus → derivedStatus, consistencyStatus, repairOptions
        ↓
resolveAssistExecutionContext (+ optional auto-repair via repairWorkflowState)
        ↓
allowedActions (buttons) + nextActionHint (soft info, not error)
```

## Migration 0212 (new)

- `repair_assist_visit_workflow_status` RPC — backward status reset when timestamps unambiguous
- `workflow_consistency_status`, `last_auto_repair_at`, `last_repair_reason` on execution state

## Regression scope

- LT.GMAPS — `startEnRoute` unchanged
- PERMISSIONS 0205–0209 — RLS additive only
- PERF / AWF3 — task batch + live timers unchanged

## Expected Kevin workflow (post-fix)

1. Open visit → derivedStatus `angekommen`, info hint „Einsatz starten“
2. Tap **Einsatz starten** → auto-repair status if needed + `service_start` event
3. Normal flow: beenden → Dokumentation → Unterschrift → Abschluss

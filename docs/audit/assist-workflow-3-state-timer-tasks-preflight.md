# ASSIST.WORKFLOW.3 — State, Timers & Tasks Preflight

**Date:** 2026-06-29  
**Baseline:** ASSIST.WORKFLOW.2 (`c1c4e6be`), migrations through 0210

## Production bugs (Kevin visit)

| Symptom | Root cause |
|---------|------------|
| „Einsatz beenden“ sichtbar, Klick scheitert | UI nutzte `gestartet`-Status ohne `service_start` Event — `endService` korrekt blockiert, Button nicht aus `allowedActions` |
| Anfahrt 1:43, Einsatz 0:00 — Button/State desync | `effectiveStatus` ≠ Zeit-Events; Timer ohne Live-Tick |
| Timer nicht live pro Sekunde | `dbTimers` statisch — kein `calculateVisitTimes(now)` im UI-Tick |
| Task-Checkboxen langsam | Jeder Klick → `runWorkflow` + voller Context-Reload |

## ASSIST.WORKFLOW.3 scope

| Phase | Deliverable |
|-------|-------------|
| Single source | `resolveAssistExecutionContext` + `allowedActions` + `diagnostics` |
| Buttons | Nur `allowedActions` — `end_service` nur wenn `serviceStartedAt && !serviceEndedAt` |
| Live timers | `useLiveVisitTimers` — 1s Tick, keine DB-Schreibvorgänge |
| Tasks | `useTaskResultDrafts` + `saveTaskResultsBatch` (debounced) |
| Migration 0211 | Index `assignment_tasks(tenant_id, assignment_id)` |
| UI | Safe area, dismissible error box |
| Audit | `scripts/audit-assist-workflow-3.ts` |

## Regression scope

- WORKFLOW.2 time guards (`endService`, `markArrived` backfill)
- LT.GMAPS / PERMISSIONS / PERF hooks unchanged

## Expected Kevin workflow (post-fix)

1. Consent → Anfahrt → Angekommen (Anfahrt-Timer stoppt, live mm:ss)
2. **Einsatz starten** (nur wenn `angekommen` in `allowedActions`)
3. Einsatz-Timer live; **Einsatz beenden** nur nach `service_start`
4. Tasks: sofortiges UI, Batch-Save im Hintergrund
5. Dokumentation → Unterschrift → Abschluss

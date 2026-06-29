# ASSIST.WORKFLOW.3 — Abnahmebericht

**Date:** 2026-06-29  
**Commit:** (see git log)  
**Audit:** `npx tsx scripts/audit-assist-workflow-3.ts`

## Root causes (confirmed)

1. **Button desync** — Primary CTA derived from assignment status string (`gestartet`) while `endService` correctly required `service_start` time event.
2. **Timer desync** — Static `dbTimers` snapshot without per-second `calculateVisitTimes(now)` for active drive/service/pause.
3. **Task latency** — Each checkbox invoked full `runWorkflow` + `resolveAssistExecutionContext` round-trip.

## Fixes delivered

| Area | Change |
|------|--------|
| Single source | `resolveAssistExecutionContext` returns `allowedActions`, `diagnostics`, `timeEvents` |
| Buttons | Screen uses `primaryAllowedAction(allowedActions)` — no `end_service` without `canEndService` |
| Live timers | `useLiveVisitTimers` — 1s UI tick, no DB writes |
| Tasks | `useTaskResultDrafts` + `saveTaskResultsBatch` (450ms debounce) |
| Repair | `gestartet`/`pausiert` without `service_start` → effective `angekommen` |
| Migration 0211 | Index on `assignment_tasks(tenant_id, assignment_id)` |
| UX | Safe area padding, dismissible error banner |

## Kevin verification checklist

- [ ] Angekommen → Button zeigt „Einsatz starten“, nicht „Einsatz beenden“
- [ ] Nach Einsatz starten: Einsatz-Timer läuft live (mm:ss oder hh:mm:ss)
- [ ] Anfahrt-Timer stoppt bei Ankunft, bleibt fix
- [ ] Einsatz beenden funktioniert nur nach Start
- [ ] Task-Checkboxen reagieren sofort
- [ ] Dokumentation → Unterschrift → Abschluss unverändert

## Regression

- ASSIST.WORKFLOW.2 guards (`endService`, travel stop at arrive) preserved
- Audit AWF2 baseline file present

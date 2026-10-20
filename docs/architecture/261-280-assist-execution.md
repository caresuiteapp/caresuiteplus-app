# CareSuite+ — Assist Einsatzdurchführung (WP 261–280)

## Status: Abgeschlossen

## Umsetzung

| Feature | Route / Screen |
|---------|----------------|
| Aktive Einsätze (Tab) | `/assist/durchfuehrung` → `ActiveExecutionsScreen` |
| Check-in / Start / Check-out | `/assist/assignments/[id]/execute` |
| Zeiterfassung | `AssignmentExecution` Demo-Store |
| Link von Einsatzdetail | Button „Einsatz durchführen“ |

## Workflow

1. **Check-in** — `phase: checked_in`, setzt `actualStartAt`
2. **Einsatz starten** — `phase: in_progress`
3. **Check-out** — `phase: completed`, berechnet `durationMinutes`, setzt Assignment auf `abgeschlossen`

## Services

- `executionService.ts` — `checkInAssignment`, `startAssignmentWork`, `checkOutAssignment`
- Demo: `assignmentExecutions.ts`

## Berechtigungen

- `assist.execution.view` — alle Assist-Rollen
- `assist.execution.manage` — Admin, Manager, Dispatch, Nurse, Caregiver

# WP 241 — Architektur (assistPlanning)

## Bezug

- Abschnittsdoku: `261-280-assist-execution.md`
- Modul: **Assignment**
- Route: `/assist`
- Berechtigung: `assist.assignments.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/assist/assistDashboardService.ts` |
| Repository | `src/lib/services/repositories/assignmentRepository.supabase.ts` |
| Demo | `src/data/demo/domains/assistPlanningDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

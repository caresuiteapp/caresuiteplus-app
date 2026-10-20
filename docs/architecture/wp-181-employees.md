# WP 181 — Architektur (employees)

## Bezug

- Abschnittsdoku: `181-200-office-employees.md`
- Modul: **Employee**
- Route: `/office/employees`
- Berechtigung: `office.employees.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/office/employeeListService.ts` |
| Repository | `src/lib/services/repositories/employeeRepository.supabase.ts` |
| Demo | `src/data/demo/domains/employeesDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

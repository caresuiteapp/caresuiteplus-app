# WP 329 — Berechtigungen (employeePortal)

## Bezug

- Abschnittsdoku: `321-340-mitarbeiterportal.md`
- Modul: **EmployeePortal**
- Route: `/portal/employee`
- Berechtigung: `portal.employee.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/portal/employeePortalService.ts` |
| Repository | `src/lib/services/repositories/employeePortalRepository.supabase.ts` |
| Demo | `src/data/demo/domains/employeePortalDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

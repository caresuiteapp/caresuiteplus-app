# WP 149 — Berechtigungen (office)

## Bezug

- Abschnittsdoku: `141-160-office-core.md`
- Modul: **Office**
- Route: `/office`
- Berechtigung: `office.access`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/office/officeDashboardService.ts` |
| Repository | `src/lib/services/repositories/officeRepository.supabase.ts` |
| Demo | `src/data/demo/domains/officeDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

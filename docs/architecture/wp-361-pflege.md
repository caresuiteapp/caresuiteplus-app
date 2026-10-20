# WP 361 — Architektur (pflege)

## Bezug

- Abschnittsdoku: `361-380-pflege.md`
- Modul: **CarePlan**
- Route: `/pflege`
- Berechtigung: `pflege.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/pflege/pflegeDashboardService.ts` |
| Repository | `src/lib/services/repositories/pflegeRepository.supabase.ts` |
| Demo | `src/data/demo/domains/pflegeDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

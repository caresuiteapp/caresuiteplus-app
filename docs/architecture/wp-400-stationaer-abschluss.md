# WP 400 — Abschluss (stationaer)

## Bezug

- Abschnittsdoku: `381-400-stationaer.md`
- Modul: **Resident**
- Route: `/stationaer`
- Berechtigung: `stationaer.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/stationaer/stationaerDashboardService.ts` |
| Repository | `src/lib/services/repositories/stationaerRepository.supabase.ts` |
| Demo | `src/data/demo/domains/stationaerDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

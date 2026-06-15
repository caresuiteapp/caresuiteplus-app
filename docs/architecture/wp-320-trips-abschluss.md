# WP 320 — Abschluss (trips)

## Bezug

- Abschnittsdoku: `301-320-fahrtenbuch-tracking.md`
- Modul: **Trip**
- Route: `/assist/fahrten`
- Berechtigung: `assist.trips.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/assist/tripLogService.ts` |
| Repository | `src/lib/services/repositories/tripRepository.supabase.ts` |
| Demo | `src/data/demo/domains/tripsDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

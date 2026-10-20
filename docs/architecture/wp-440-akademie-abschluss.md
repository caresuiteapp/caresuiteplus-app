# WP 440 — Abschluss (akademie)

## Bezug

- Abschnittsdoku: `421-440-akademie.md`
- Modul: **Course**
- Route: `/akademie`
- Berechtigung: `akademie.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/akademie/akademieDashboardService.ts` |
| Repository | `src/lib/services/repositories/akademieRepository.supabase.ts` |
| Demo | `src/data/demo/domains/akademieDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

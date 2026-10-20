# WP 420 — Abschluss (beratung)

## Bezug

- Abschnittsdoku: `401-420-beratung.md`
- Modul: **Case**
- Route: `/beratung`
- Berechtigung: `beratung.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/beratung/beratungDashboardService.ts` |
| Repository | `src/lib/services/repositories/beratungRepository.supabase.ts` |
| Demo | `src/data/demo/domains/beratungDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

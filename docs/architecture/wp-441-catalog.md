# WP 441 — Architektur (catalog)

## Bezug

- Abschnittsdoku: `441-460-kataloge.md`
- Modul: **Catalog**
- Route: `/office/catalogs`
- Berechtigung: `office.catalogs.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/catalog/catalogService.ts` |
| Repository | `src/lib/services/repositories/catalogRepository.supabase.ts` |
| Demo | `src/data/demo/domains/catalogDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

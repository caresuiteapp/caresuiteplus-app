# WP 480 — Abschluss (platform)

## Bezug

- Abschnittsdoku: `461-480-ai-ocr.md`
- Modul: **Platform**
- Route: `/business/platform`
- Berechtigung: `business.platform.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/platform/platformHubService.ts` |
| Repository | `src/lib/services/repositories/platformRepository.supabase.ts` |
| Demo | `src/data/demo/domains/platformDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

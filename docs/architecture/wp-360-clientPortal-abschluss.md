# WP 360 — Abschluss (clientPortal)

## Bezug

- Abschnittsdoku: `341-360-klientenportal.md`
- Modul: **ClientPortal**
- Route: `/portal/client`
- Berechtigung: `portal.client.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/portal/clientPortalService.ts` |
| Repository | `src/lib/services/repositories/clientPortalRepository.supabase.ts` |
| Demo | `src/data/demo/domains/clientPortalDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

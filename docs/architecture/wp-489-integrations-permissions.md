# WP 489 — Berechtigungen (integrations)

## Bezug

- Abschnittsdoku: `481-500-integrationen.md`
- Modul: **Integration**
- Route: `/business/integrations`
- Berechtigung: `business.integrations.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/integrations/integrationHubService.ts` |
| Repository | `src/lib/services/repositories/integrationRepository.supabase.ts` |
| Demo | `src/data/demo/domains/integrationsDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

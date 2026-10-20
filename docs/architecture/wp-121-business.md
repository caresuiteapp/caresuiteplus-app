# WP 121 — Architektur (business)

## Bezug

- Abschnittsdoku: `121-140-business-subscription.md`
- Modul: **Business**
- Route: `/business`
- Berechtigung: `dashboard.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/business/businessDashboardService.ts` |
| Repository | `src/lib/services/repositories/businessRepository.supabase.ts` |
| Demo | `src/data/demo/domains/businessDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

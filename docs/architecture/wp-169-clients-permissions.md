# WP 169 — Berechtigungen (clients)

## Bezug

- Abschnittsdoku: `181-200-office-employees.md`
- Modul: **Client**
- Route: `/office/clients`
- Berechtigung: `office.clients.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/office/clientListService.ts` |
| Repository | `src/lib/services/repositories/clientRepository.supabase.ts` |
| Demo | `src/data/demo/domains/clientsDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

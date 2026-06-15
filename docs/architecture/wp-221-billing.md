# WP 221 — Architektur (billing)

## Bezug

- Abschnittsdoku: `221-240-office-billing.md`
- Modul: **Invoice**
- Route: `/office/invoices`
- Berechtigung: `office.invoices.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/office/invoiceListService.ts` |
| Repository | `src/lib/services/repositories/invoiceRepository.supabase.ts` |
| Demo | `src/data/demo/domains/billingDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

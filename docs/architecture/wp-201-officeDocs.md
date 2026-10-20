# WP 201 — Architektur (officeDocs)

## Bezug

- Abschnittsdoku: `221-240-office-billing.md`
- Modul: **Document**
- Route: `/office/documents`
- Berechtigung: `office.documents.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/office/officeDocumentsService.ts` |
| Repository | `src/lib/services/repositories/officeRepository.supabase.ts` |
| Demo | `src/data/demo/domains/officeDocsDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

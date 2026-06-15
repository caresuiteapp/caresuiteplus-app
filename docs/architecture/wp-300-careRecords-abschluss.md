# WP 300 — Abschluss (careRecords)

## Bezug

- Abschnittsdoku: `281-300-assist-records-pdf.md`
- Modul: **CareRecord**
- Route: `/assist/nachweise`
- Berechtigung: `assist.care_records.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/assist/careRecordService.ts` |
| Repository | `src/lib/services/repositories/careRecordRepository.supabase.ts` |
| Demo | `src/data/demo/domains/careRecordsDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

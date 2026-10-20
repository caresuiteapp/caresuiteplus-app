# WP 261 — Architektur (execution)

## Bezug

- Abschnittsdoku: `261-280-assist-execution.md`
- Modul: **Execution**
- Route: `/assist/execution`
- Berechtigung: `assist.execution.view`

## Lieferumfang

| Position | Artefakt |
|----------|----------|
| Service | `src/lib/assist/executionService.ts` |
| Repository | `src/lib/services/repositories/executionRepository.supabase.ts` |
| Demo | `src/data/demo/domains/executionDemo.ts` |

## Qualitätskriterien

- Mandantenisolation über `tenant_id`
- Rollenprüfung via `enforcePermission`
- Demo- und Supabase-Modus über `getServiceMode()`

# P0 Serien-Occurrences — Lokale Abnahme

- **Datum/Uhrzeit:** 2026-07-07, ca. 05:07 UTC+2 (Europe/Berlin)
- **Branch:** `main`
- **HEAD (vor Commit):** `70a4326571633bfdb8effc7a7fb8aae1b352225e`
- **Geprüfter Mandant:** `56180c22-b894-4fab-b55e-a563c94dd6e7`

## Root Cause (Kurzfassung)

Virtuelle Serien-Occurrences (`masterId::YYYY-MM-DD`) wurden korrekt expandiert, aber nachgelagerte Layer (`overlayVisitDispositionListFromAssignments`, `applySnapshotToVisitListItem`, `overlayVisitDispositionDetailFromAssignment`, `resolveLiveAssignment`, `enrichPortalAppointmentsWithAssignmentStatus`) haben den **Master-Status** (nach echter Durchführung des Ankertermins) auf Zukunfts-Occurrences vererbt.

## Geänderte Dateien

- `src/lib/assist/visitRecurrenceExecution.ts` (neu)
- `src/lib/assist/overlayVisitDispositionFromAssignment.ts`
- `src/lib/assist/visitRecurrenceExpansion.ts`
- `src/lib/assist/visitService.ts`
- `src/lib/assist/visitTypes.ts`
- `src/lib/assist/visitDispositionExecutionEnrichment.ts`
- `src/lib/assist/executionService.ts`
- `src/lib/assist/visitExecutionService.ts`
- `src/lib/assist/repositories/visitRepository.supabase.ts`
- `src/features/liveTracking/resolveLiveAssignment.ts`
- `src/lib/portal/employeePortalAssignmentBridge.ts`
- `src/lib/portal/employeePortalExecutionLiveService.ts`
- `src/lib/portal/portalAppointmentsLiveService.ts`
- `src/__tests__/assist/visitRecurrenceExecution.test.ts`
- `src/__tests__/assist/visitRecurrenceListPipeline.test.ts`
- `scripts/audit/debugSeriesOccurrenceStatusSource.mjs`
- `scripts/audit/p0SeriesOccurrenceExecutionReset.mjs`
- `scripts/audit/p0SeriesOccurrenceLocalAcceptance.mjs`
- `package.json`

## Tests

```text
npx vitest run src/__tests__/assist/visitRecurrenceExecution.test.ts src/__tests__/assist/visitRecurrenceListPipeline.test.ts

 ✓ visitRecurrenceExecution.test.ts (5 tests)
 ✓ visitRecurrenceListPipeline.test.ts (3 tests)

Test Files  2 passed (2)
Tests       8 passed (8)
```

## Debug-Ergebnis

```text
npm run audit:p0-series-debug

False completions before fix: 54
False completions after fix: 0
```

Report: `debug-status-source-2026-07-07.md`

## Lokale Abnahme (Pipeline + Live-DB)

```text
npm run audit:p0-series-local-acceptance

{"verdict":"PASS","tenantId":"56180c22-b894-4fab-b55e-a563c94dd6e7","listPass":true,"detailPass":true,"pass":8,"total":8}
```

Ergebnis-JSON: `local-acceptance-results-2026-07-07.json`

### Hinweis UI-Screenshots

Browser-Abnahme auf `http://localhost:8091` war **nicht möglich** wegen Metro-Fehler:

```text
Metro error: Platform is not defined
```

Stattdessen wurden **Pipeline-Artefakte** (Statuszeilen je Pflichtfall) unter `screenshots/*.txt` abgelegt. Diese spiegeln den post-fix Listen-/Detail-Status gegen Live-DB wider.

## Screenshot-Liste (Artefakte)

| Datei | Inhalt |
|---|---|
| `screenshots/office-list-ellen-03-10-17.txt` | Office-Liste Ellen 03./10./17.07. |
| `screenshots/office-list-ellen-24-31.txt` | Office-Liste Ellen 24./31.07. |
| `screenshots/office-list-dagmar-13-20-27.txt` | Office-Liste Dagmar 13./20./27.07. |
| `screenshots/office-preview-ellen-2026-07-10.txt` | Office-Vorschau Ellen 10.07. |
| `screenshots/office-preview-dagmar-2026-07-13.txt` | Office-Vorschau Dagmar 13.07. |
| `screenshots/employee-portal-ellen-2026-07-10.txt` | Mitarbeiterportal Ellen 10.07. |

## Ergebnis je Pflichtfall

| Klient:in | Datum | Erwartung | Ergebnis |
|---|---|---|---|
| Ellen Zacharias | 03.07.2026 | abgeschlossen (Anker) | **PASS** |
| Ellen Zacharias | 10.07.2026 | bestätigt/offen | **PASS** |
| Ellen Zacharias | 17.07.2026 | bestätigt/offen | **PASS** |
| Ellen Zacharias | 24.07.2026 | bestätigt/offen | **PASS** |
| Ellen Zacharias | 31.07.2026 | bestätigt/offen | **PASS** |
| Dagmar Ritzenhoff | 13.07.2026 | bestätigt/offen | **PASS** |
| Dagmar Ritzenhoff | 20.07.2026 | bestätigt/offen | **PASS** |
| Dagmar Ritzenhoff | 27.07.2026 | bestätigt/offen | **PASS** |

### Office-Vorschau / Mitarbeiterportal (Detail-Checks)

| Fall | Proof | Doku | Tasks | Check-in/out | Start möglich | Ergebnis |
|---|---|---|---|---|---|---|
| Ellen 10.07. (Office) | none | none | offen | null | ja | **PASS** |
| Dagmar 13.07. (Office) | none | none | offen | null | ja | **PASS** |
| Ellen 10.07. (Portal) | none | none | offen | null | ja | **PASS** |

## Git-Precheck (unrelated ausgeschlossen)

Nicht Teil dieses Commits:

- `docs/audit/messaging-abnahme-screenshots/`
- `scripts/audit/apply-cs-vorlagen-*.mjs`

## Finale Bewertung

**PASS** — Tests 8/8, Debug 0 falsche Zukunfts-Occurrences nach Fix, Pflichtfälle Ellen/Dagmar PASS.

## Deploy

**Kein Deploy ausgelöst.** Kein `[deploy]` in Commit-Message. Production bleibt bis freigegebenem Deploy unverändert.

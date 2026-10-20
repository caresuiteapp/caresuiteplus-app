# WFM P2.3 Service/UI Implementation Gate

**Datum:** 2026-07-08  
**Branch:** `cursor/wfm-p23-reexport-supersede`  
**Staging:** `shwpweerzsfkqaivmaoc` (read-only smoke)  
**Production:** `euagyyztvmemuaiumvxm` — **nicht verwendet**

---

## A) Git

| Feld | Wert |
|------|------|
| Branch | `cursor/wfm-p23-reexport-supersede` |
| HEAD vorher (Service-Layer) | `2d3a2a1f` — feat(wfm): implement p23 reviewed time correction exports |
| HEAD nachher (UI-Completion) | *(nach Commit unten)* |
| Push | **Nein** |
| Deploy | **Nein** |
| `[deploy]` | **Nein** |

### Geänderte Dateien (UI-Completion)

- `src/components/wfm/WfmExportScreen.tsx` — **P2.3 UI-Sektion committed**
- `src/__tests__/wfm/wfmExportScreen.test.ts` — P2.2 + P2.3 UI-Vertrag (17 Tests)
- `src/__tests__/wfm/zeit2OfficeTeamTimekeeping.test.ts` — `listReviewedTimeExports` Regression
- `src/lib/wfm/wfmTimeCorrectionExportService.ts` — Type-/Import-Fixes (`permissionDenied`, `appendReviewAction`, RPC cast)
- `docs/audit/wfm-p23-service-ui-implementation-gate.md` — widerspruchsfrei aktualisiert

### Service-Layer (bereits committed, unverändert in Scope)

- `src/lib/wfm/wfmTimeExportService.ts`
- `src/lib/wfm/wfmTimeExportPolicy.ts`
- `src/lib/wfm/wfmTimeExportPayloadBuilder.ts`
- `src/lib/wfm/wfmTimeReviewService.ts`
- Tests: `wfmTimeExportP23.test.ts`, `wfmTimeCorrectionExportService.test.ts`, …

### Untracked Gate-Artefakte unangetastet

| Artefakt | Unangetastet |
|----------|--------------|
| `scripts/audit/_platform-1-5-staging-smoke-temp.mjs` | Ja |
| `.gate-0252-*` | Ja |
| `.gate-apply-args.json` / `.gate-sql.b64` | Ja (falls vorhanden) |

---

## B) Implementation

| Bereich | Status |
|---------|--------|
| Service-Layer | **Ja** — committed (`2d3a2a1f` + Vorgänger) |
| UI (`WfmExportScreen.tsx`) | **Ja** — P2.3 Sektion committed |
| `WfmTimeExportItem` Import | **Ja** — aus `wfmTimeExportService`, nicht Facade |
| Correction Flow UI | **Ja** — Select → Reason → Draft → Preview → Validate → Finalize (RPC) |
| Correction-Facade | **Ja** — `draftReviewedTimeCorrectionExport`, `validateCorrectionExportDraft`, `finalizeReviewedTimeCorrectionExport` |
| Role-Gating | **Ja** — gesamter Screen via `time.tracking.admin.export`; Employee sieht `LockedActionBanner` |
| Payload-Schutz | **Ja** — Read/Preview beim Laden; Supersede nur via RPC |
| Auto-Finalize beim Laden | **Nein** — nur `loadHistory` + `loadCorrectionCandidates` |

### P2.3 UI-Inhalt (Auszug)

- Korrekturkandidaten mit Badge / `export_version`
- Review-Detail: `changed_after_export`, `latest_export_item_id`, `pending_reexport_job_id`, `logical_reference_key`, `export_sequence`, `item_status`, Payload-Hashes
- Drift-Preview, Item-Timeline, Action-Historie
- Reason required (`WFM_CORRECTION_REASON_MIN_LENGTH`)
- Finalize disabled ohne Validate + Preview

---

## C) Tests

| Suite | Ergebnis |
|-------|----------|
| `wfmExportScreen.test.ts` (17) | **Grün** |
| `wfmTimeExportP23.test.ts` (9) | **Grün** |
| `wfmTimeCorrectionExportService.test.ts` (7) | **Grün** |
| `wfmTimeExportService.test.ts` (6) | **Grün** |
| `wfmTimeExportPolicy.test.ts` (7) | **Grün** |
| `wfmTimeExportPayloadBuilder.test.ts` (8) | **Grün** |
| `zeit2OfficeTeamTimekeeping.test.ts` (20) | **Grün** |
| **Gesamt P2.3-Kernsuites** | **74 Tests grün** |

### Typecheck

| Bereich | Ergebnis |
|---------|----------|
| `WfmExportScreen.tsx` | **0 Fehler** (gefiltert) |
| `wfmTimeCorrectionExportService.ts` | **0 Fehler** (gefiltert) |
| Gesamt-`tsc` | Exit 2 — **Altlasten außerhalb P2.3** (Assist-Adapter, Office-Typography, ServiceResult-Narrowing in älteren Tests, `wfmTimeExportService` permission returns) |

### Expo Export

```bash
EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform web
```

**Ergebnis: OK** — `Exported: dist`, keine P2.3-Importfehler im Build.

---

## D) Staging Read-Smoke (ohne Mutation)

**Project:** `shwpweerzsfkqaivmaoc`

| Check | Vorher | Nachher |
|-------|--------|---------|
| Jobs | 3 | 3 |
| Items | 1 | 1 |
| Reviews | 9 | 9 |
| Correction Jobs | 0 | 0 |
| `payload_hash` | `fnv1a-5c273ce4` | `fnv1a-5c273ce4` |
| `logical_reference_key` | gesetzt | `review:b2222222-…` |
| `item_status` | active | active |
| `export_version` | 1 | 1 |
| Finalize ausgeführt | Nein | Nein |
| Mutation durch Laden/SQL-Read | — | **Nein** |

**RLS-Negativcheck:** nicht geprüft wegen Mutationsschutz.

---

## E) Gate-Entscheid

| Gate | Status |
|------|--------|
| P2.3 Service/UI lokal | **GO** |
| UI committed | **GO** |
| Staging Read-Smoke | **GO** |
| Expo Export DEMO=false | **GO** |
| Echter Re-Export-Finalize-Smoke | **NO-GO bis separate Freigabe** |
| Push | **NO-GO** |
| Deploy | **NO-GO** |
| Production Apply | **NO-GO** |

### Offene Risiken (unverändert)

1. Registry-Split Staging — nur dokumentiert, nicht repariert.
2. Employee-/RPC-Negativ-Smoke — offen (harmlos ohne Mutation nicht abgeschlossen).
3. Gesamt-Typecheck-Altlasten — außerhalb P2.3, getrennt dokumentiert.

---

## Commit (geplant)

```
feat(wfm): complete p23 correction export UI
```

Kein `[deploy]`. Kein Push.

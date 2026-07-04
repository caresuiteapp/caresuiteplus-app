# ABSENCE.2 — Edge-Case Review (Urlaub / Abwesenheit)

**Datum:** 2026-07-04  
**Basis-HEAD:** `7b47c82b`  
**Scope:** Duplikat-Check, Genehmigung/Ablehnung, Mehr-Tage, Kalender — Re-Approval nach ABSENCE.1  
**Keine Änderungen:** Migrationen, RLS, Deploy

---

## Executive Summary

ABSENCE.1-Workflow bleibt **stabil**. S1 Re-Review der Edge Cases + Vitest-Lauf **33/33 grün** (Absence-Suites). **Kein Code-Fix** nötig — Verhalten dokumentiert.

| Edge Case | Erwartung | Test / Code | S1 |
|-----------|-----------|-------------|-----|
| Überlappende Anträge | Warning, kein Auto-Reject | `detectWfmAbsenceOverlapConflicts` | ✅ |
| Ablehnung mit Pflichtgrund | `rejection_reason` persistiert | `reviewWfmAbsenceRequest` | ✅ |
| Mehr-Tage / CEST-Grenzen | Kalender-Zellen korrekt | `wfmAbsenceP1` Test 9 | ✅ |
| Kalender-Dedup bei Re-Approve | Gleiche `source_id` | `wfmAbsenceP1` Test 7 | ✅ |
| Portal Duplikat-Submit | **Kein serverseitiger Hard-Block** | `requestWfmAbsence` insert | ⚠️ Gelb |

---

## Test-Lauf (S1)

```
npx vitest run \
  src/__tests__/wfm/wfmAbsenceP1.test.ts \
  src/__tests__/wfm/wfmAbsenceApprovalWorkflow.test.ts \
  src/__tests__/wfm/wfmAbsencePortalDateSubmit.test.ts \
  src/__tests__/wfm/wfmAbsenceService.test.ts
→ 33/33 passed
```

---

## 1 — Duplikat-Check (Re-Approval)

**Kalender-Sync (`buildCalendarPayloadFromWfmAbsence`):**

- `sourceId` = Absence-ID → idempotenter Upsert, **kein Duplikat-Event** bei erneuter Freigabe (Test 7)
- `calendarSyncService` upsert via `source_id`

**Portal-Submit (`requestWfmAbsence`):**

- Jeder Submit erzeugt **neue UUID** + Insert
- **Kein** clientseitiger Duplicate-Guard vor Insert
- Office sieht **Overlap-Warnings** via `detectWfmAbsenceOverlapConflicts` bei Genehmigung

| Layer | Duplikat-Schutz | Ampel |
|-------|-----------------|-------|
| Kalender-Events | ✅ idempotent | Grün |
| Office Review | ✅ Overlap-Warnings | Grün |
| Portal Submit | ❌ kein Hard-Block | **Gelb** |

**Follow-up ABSENCE.3:** Optional client/server guard für identische pending ranges (kein S1-Fix — Risiko gering, Office fängt ab).

---

## 2 — Genehmigung / Ablehnung

| Flow | Verhalten | Test |
|------|-----------|------|
| Approve | Status → approved, Kalender-Sync, optional Kommentar | `wfmAbsenceApprovalWorkflow` |
| Reject | **Pflicht** `rejectionReason`, sichtbar im MP | ABSENCE.1 + workflow tests |
| Withdraw | Nur `requested` → `cancelled` | `withdrawWfmAbsenceRequest` |
| Schnellgenehmigung Team-Screen | **Entfernt** in ZEIT.2 → Link zu Requests-Tab | `zeit2OfficeTeamTimekeeping` |

**`portalRejectionReason`:** Erhalten in Bridge (`mapWfmAbsenceToEmployeeAbsence`) — Regression Test in ZEIT.2-Suite.

---

## 3 — Mehr-Tage / Zeitzonen

| Case | Handling |
|------|----------|
| All-day Urlaub | `all_day: true`, `Europe/Berlin` timezone in calendar payload |
| CEST 15.–16.08. | Test 9 — Zellen-Overlap ohne Off-by-one |
| Date-Submit Portal | `parseWfmAbsenceDateRange` + `wfmAbsencePortalDateSubmit` (5 Tests) |

Keine S1-Regression.

---

## 4 — Kalender (intern)

| Aspekt | Status |
|--------|--------|
| Sync nur bei Approve | ✅ By design |
| Block vor Approve im MP | ✅ Kein Kalender-Eintrag |
| `filterCalendarRecordsByRange` Mehr-Tage | ✅ Test 6 |
| Live-Kalender-Widget Office | ❌ Nicht in Scope (ZEIT.2 Gap) |

---

## 5 — Assignment-Konflikte

`detectWfmAssignmentConflicts` — **Warnings only**, Severity `warning`, kein Auto-Reject.

Messages: „Einsatz am … benötigt ggf. Vertretung.“

---

## Risiko-Matrix

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| Doppel-Submit pending im MP | Niedrig | Office Overlap-Warning |
| Fehlender Hard-Dedup Server | Niedrig | ABSENCE.3 Backlog |
| Reject ohne Grund | — | UI + Server validation ✅ |
| Kalender-Duplikat | — | source_id ✅ |

---

## S1-Entscheidung

**Kein Code-Fix** — Verhalten absichtlich (Warnings statt Hard-Block). Dokumentation only.

---

## Referenzen

- `docs/audit/absence1-employee-request-workflow.md`
- `docs/audit/absence1-production-smoke.md`
- `src/lib/wfm/wfmAbsenceConflictService.ts`
- `src/lib/wfm/wfmAbsenceApprovalWorkflow.ts`

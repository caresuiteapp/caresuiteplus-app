# WFM Office Arbeitszeit — Offene Prüfungen Table Hotfix Report

**Date:** 2026-07-09  
**Scope:** P0 layout hotfix PASS 2 — header truncation, horizontal scroll, Status/Aktion separation  
**Environment:** Staging (`office.staging@example.test`) / local static export `http://localhost:8083`

---

## A) Precheck

| Item | Value |
|------|-------|
| Branch | `cursor/platform-2-0b-operator-ui` (WFM-only diff; no platform code touched) |
| HEAD | `00b1589fcd0c28a03e23242c35a9dc27f37a0f0c` |
| Scope guard | WFM table layout + audit artifacts only |

**Pass 1 blockers (from `hotfix-after/01-offene-pruefungen.png`):**

| # | Blocker | Evidence |
|---|---------|----------|
| 1 | Right table half clipped | Only DATUM–PLAN visible at ~1075px |
| 2 | No table-container scroll | EINSATZ-IST / BUCHUNG / STATUS / AKTION unreachable |
| 3 | Headers risk truncation | Pass 1 noted "DAUER EINSAT…" pattern |
| 4 | Plan cell single-line | Duration merged into Plan line |

---

## B) Hotfix PASS 2 Implementation

### Column grid (review queue, fixed layout — 1264px total)

| Column | Width |
|--------|-------|
| Datum | 112px |
| Mitarbeiter | 150px |
| Klient | 170px |
| Plan | 155px |
| Einsatz-Ist | 190px |
| Buchung | 175px |
| Status | 180px |
| Aktion | 132px |

### Key changes

- **`WfmOfficeTimeEntryTable.tsx`**: Fixed widths (no flex shrink), stacked Plan lines (range + duration), `overflow-x: auto` table surface, compact Prüfen button retained.
- **`PremiumDataTable.tsx`**: Explicit table width for `fixedLayout`, scroll wrapper `testID=table-scroll-container`, web `overflow-x: auto`.
- **`WfmOfficeTimeHistoryPanel.tsx`**: Removed duplicate table wrapper (single scroll surface in entry table).
- **`OfficeTimeTrackingShell.tsx`**: `overflow-x: hidden` on content shell to forbid page-level horizontal scroll.
- **`_wfm-timekeeping-hotfix-screenshots-temp.mjs`**: PASS 2 shot list, staging session injection, `Letzte 7 Tage` data filter, DOM gate checks.

---

## C) Tests

**Skipped per PASS 2 constraint** — screenshot gate only.

---

## D) Screenshot Gate (PASS 2)

**After folder:** `docs/audit/wfm-timekeeping-ui-redesign/hotfix-after/`

| Shot | Status |
|------|--------|
| 01-offene-pruefungen.png | **PASS** |
| 02-offene-pruefungen-horizontal-scroll.png | **PASS** |
| 03-pruefen-panel.png | **PASS** |
| 04-zeitkonten.png | **PASS** |
| 05-export-p23.png | **PASS** |
| 06-mobile-card-layout.png | **PASS** |

### Automated gate (`screenshot-gate-results.json`)

```json
{
  "ok": true,
  "overlap": false,
  "truncatedStatus": false,
  "truncatedDauer": false,
  "truncatedHeader": false,
  "missingHeaders": [],
  "actionReachable": true,
  "tableScrollOk": true,
  "pageScrollX": false,
  "badgeCount": 4,
  "buttonCount": 1
}
```

| Criterion | Result |
|-----------|--------|
| No status/button overlap | **PASS** |
| Headers not truncated, no "DAUER EINSAT…" | **PASS** |
| Action column reachable via table scroll | **PASS** |
| Status badge + Prüfen visible | **PASS** |
| Table container scrolls cleanly | **PASS** |
| No page-level horizontal scroll | **PASS** |
| Mobile card layout route loads | **PASS** (screenshot) |
| Prüfen panel / Zeitkonten / Export | **PASS** (screenshots) |

---

## E) Commit

**Executed** — gate `ok: true`.

Message: `fix(wfm): fix timekeeping review table layout` (no `[deploy]`).

---

## F) Verdict

### **GO** (screenshot gate PASS 2)

Fixed-width 1264px review table with container-level horizontal scroll; headers show DATUM … AKTION without truncation; Status and Aktion columns separated; page shell blocks horizontal overflow.

---

## G) Files changed (PASS 2 commit scope)

- `src/components/wfm/WfmOfficeTimeEntryTable.tsx`
- `src/components/wfm/WfmOfficeTimeHistoryPanel.tsx`
- `src/components/wfm/OfficeTimeTrackingShell.tsx`
- `src/components/ui/PremiumDataTable.tsx`
- `docs/audit/wfm-timekeeping-ui-redesign/hotfix-after/*`
- `docs/audit/wfm-timekeeping-ui-redesign/hotfix-report.md`
- `scripts/audit/_wfm-timekeeping-hotfix-screenshots-temp.mjs`

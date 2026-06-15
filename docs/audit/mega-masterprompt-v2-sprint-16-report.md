# MEGA Masterprompt v2 — Sprint 16 Report

**Datum:** 2026-06-13  
**Scope:** PremiumDataTable Spalten-Sortierung per Header-Klick (Klient:innen + Mitarbeitende)  
**Verdict:** Reusable desktop table sort — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 16 ergänzte **klickbare Tabellen-Header** in `PremiumDataTable` — wiederverwendbar für Office-Desktop-Tabellen. Sortierung synchronisiert mit bestehenden Chip-Sort-Optionen via `useTableColumnSort`.

---

## 2. Implementiert

| Komponente | Änderung |
|------------|----------|
| `PremiumDataTable` | `sortable`, `sortColumnKey`, `sortDirection`, `onSortColumn`, ▲/▼ Indikator |
| `ClientsListTable` | Sortierbare Spalten Name, Ort |
| `EmployeesListTable` | Sortierbare Spalten Name, Rolle |
| `ClientsListView` / `EmployeesListView` | `useTableColumnSort` Hook-Integration |

**Neue Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/lib/table/tableColumnSort.ts` | Toggle-Logik + `useTableColumnSort` |
| `src/__tests__/core/premiumDataTableSort.test.ts` | 4 Unit-Tests |

**UX:** Desktop-Tabellen zeigen aktive Sort-Spalte in Orange; Klick toggelt asc/desc (Name) oder setzt Spalten-Sort (Ort, Rolle). Chip-Sortierung bleibt synchron.

---

## 3. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **459** passed (+6) |
| `npm run smoke` | ✅ 252 routes |

---

## 4. Deferred to Sprint 17+

| Priorität | Item |
|-----------|------|
| P1 | Stationär Bewohner Premium-Slice |
| P2 | View-Toggle Karten/Tabelle auf Desktop |
| P2 | Desktop-Tabelle Durchführung + Fahrten |
| P2 | Live-Supabase Trip-Repo + volle Feld-Mappings |

---

## 5. Verdict

Desktop-Verwaltungstabellen haben jetzt **echte Header-Sortierung** — kein Store-Release. Weitere Module und View-Toggles folgen.

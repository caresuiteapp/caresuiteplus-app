# Global Right Sidebar Today Layout Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Globale rechte Sidebar — HEUTE-Sektion vs. Schnellaktionen (alle Module)  
**Commit-Message:** `fix(shell): prevent right sidebar today section overlap`

---

## 1. Problem

Die HEUTE-Sektion in der globalen rechten Sidebar (`RightContextPanel`) hatte `maxHeight: 120` auf der Task-Liste. Bei Stationär (6 Einträge: Neuaufnahmen, Entlassungen, Offene Übergaben, Freie Plätze, Offene Bewohnerplanung, Zimmerkonflikte) wuchs der Inhalt über den Container und überlappte den Schnellaktionen-Header und die erste Schaltfläche. Betroffen: Zentrale, Office, Assist, Pflege, Stationär, Beratung, Akademie.

## 2. Root Cause

`taskList` in `rightcontextpanel.tsx` nutzte `maxHeight: 120` ohne `overflow`-Handling. Zusätzlich fehlten am Root-Container `flexDirection: 'column'`, `overflow: 'hidden'` und konsistente Row-Styles (`minWidth: 0` / `flexShrink: 0`) für Label/Badge-Zeilen.

## 3. Umsetzung

| Bereich | Änderung |
|---------|----------|
| **Root-Container** | `flex: 1`, `flexDirection: 'column'`, `overflow: 'hidden'`, `minHeight: 0` |
| **ScrollArea** | `flex: 1`, `minHeight: 0`; `paddingBottom` erhöht (`spacing.lg`) |
| **HEUTE-Sektion** | Wrapper `todaySection`; `maxHeight` entfernt — dynamisches Wachstum |
| **Task-Rows** | `minHeight: 32`, Label `flex: 1` + `minWidth: 0`, Badge `flexShrink: 0` |
| **DOM-Reihenfolge** | Heute vor Schnellaktionen (unverändert, verifiziert) |
| **Support** | Footer außerhalb `ScrollView`, `flexShrink: 0` |
| **Mobile** | `minWidth: 0`, `flexShrink: 0`, `minHeight: 32` auf HEUTE-Rows (Konsistenz) |

### Geänderte Dateien

- `src/components/layout/platform/rightcontextpanel.tsx`
- `src/components/layout/platform/mobileplatformcontextpanel.tsx`
- `src/__tests__/layout/rightSidebarTodayLayout.test.ts` (neu)
- `docs/audit/global-right-sidebar-today-layout-fix-abnahmebericht.md`
- `docs/audit/right-sidebar-today-layout-screenshots/README.md`

### Nicht geändert (Out of Scope)

- Dashboard-Fachlogik pro Modul
- K.6, Rechnungen, Deploy, DB-Push, Migrationen
- `.env`, breites Git-Staging

---

## 4. Tests

| Log | Ergebnis |
|-----|----------|
| `.audit-test-global-right-sidebar-today-layout-fix.log` | ✅ 18/18 (`rightSidebarTodayLayout.test.ts`) |
| `.audit-typecheck-global-right-sidebar-today-layout-fix.log` | ⚠️ Repo-weite vorbestehende TS-Fehler; geänderte Sidebar-Dateien ohne neue Fehler |

---

## 5. Browser

**Status:** BLOCKED — `localhost:8082` in dieser Session nicht erreichbar.

Empfohlene Checks nach Dev-Server-Start: `/stationaer`, `/assist`, `/office`, `/pflege`, `/beratung`, `/akademie` — HEUTE vollständig sichtbar, Schnellaktionen darunter, Sidebar scrollbar.

---

## 6. Checkliste (18 Punkte)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Root-Container: flex column, height 100%, minHeight 0, overflow hidden | ✅ |
| 2 | ScrollArea: flex 1, minHeight 0, overflowY auto (ScrollView) | ✅ |
| 3 | Kein `maxHeight` / feste Höhe auf HEUTE-Task-Liste | ✅ |
| 4 | HEUTE wächst dynamisch mit beliebiger Item-Zahl | ✅ |
| 5 | Schnellaktionen ohne absolute `top`-Positionierung | ✅ |
| 6 | DOM: HEUTE vor Schnellaktionen | ✅ |
| 7 | Task-Rows: flex row, space-between, gap, minHeight 32 | ✅ |
| 8 | Label: flex 1, minWidth 0, ellipsis (`numberOfLines={1}`) | ✅ |
| 9 | Badge: flexShrink 0, kein Überlappen | ✅ |
| 10 | Support-Footer außerhalb Scroll, flexShrink 0 | ✅ |
| 11 | Stationär: 6 Heute-Einträge inkl. Offene Bewohnerplanung | ✅ |
| 12 | Assist-Modul Sidebar-Variante | ✅ |
| 13 | Office-Modul Sidebar-Variante | ✅ |
| 14 | Pflege-Modul Sidebar-Variante | ✅ |
| 15 | Beratung-Modul Sidebar-Variante | ✅ |
| 16 | Akademie-Modul Sidebar-Variante | ✅ |
| 17 | Tests 18/18 grün, kein Item entfernt zum Bug verstecken | ✅ |
| 18 | Kein `[deploy]`, kein K.6, kein DB-Push | ✅ |

**Gesamt:** ✅ Code-Abnahme — Browser manuell nach Dev-Server-Start empfohlen.

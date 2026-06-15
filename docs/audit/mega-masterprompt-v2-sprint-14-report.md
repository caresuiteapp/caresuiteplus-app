# MEGA Masterprompt v2 — Sprint 14 Report

**Datum:** 2026-06-13  
**Scope:** CareSuite+ Office Desktop-Tabellenansicht (Mitarbeitende)  
**Verdict:** Polished desktop table slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 14 setzte die **Desktop-Tabellenansicht für Mitarbeitende** um — analog Sprint 11 Klient:innen. Ab `desktop` breakpoint (≥1200px) ersetzt `EmployeesListTable` die Kartenliste; Phone/Tablet behalten Karten.

---

## 2. Implementiert

| Route | Änderung |
|-------|----------|
| `/office/employees` | Desktop: `EmployeesListTable` statt `EmployeeListCard` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/components/office/EmployeesListTable.tsx` | Spalten: Name, Status, Rolle, E-Mail, Aktionen |
| `src/components/office/EmployeesListView.tsx` | `useDeviceClass` + `isDesktopClass` → Tabellenlayout |
| `src/__tests__/office/officeEmployeesList.test.ts` | +2 Tests (Desktop-Tabelle) |

**UX:** Desktop-Tabelle mit Header-Zeile, Zebra-Rows, Orange-Selected-State, „Profil"-Aktion. Master-Detail auf Tablet+ unverändert; Desktop-Split-Pane nutzt kompakte Tabelle im Master-Pane.

---

## 3. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **443** passed (+2) |
| `npm run smoke` | ✅ 252 routes |

---

## 4. Deferred to Sprint 15+

| Priorität | Item |
|-----------|------|
| P2 | Spalten-Sortierung per Klick im Table-Header |
| P2 | View-Toggle Karten/Tabelle auf Desktop |
| P2 | Desktop-Tabelle Durchführung + Fahrten |
| P2 | Live-Supabase volle Feld-Mappings |

---

## 5. Verdict

Mitarbeitende-Liste hat jetzt eine **echte Desktop-Verwaltungstabelle** — kein Store-Release. Erweiterte Table-Features und weitere Desktop-Slices folgen in Sprint 15+.

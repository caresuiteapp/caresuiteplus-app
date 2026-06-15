# MEGA Masterprompt v2 — Sprint 11 Report

**Datum:** 2026-06-13  
**Scope:** CareSuite+ Office Desktop-Tabellenansicht (Klient:innen)  
**Verdict:** Polished desktop table slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 11 setzte die **Desktop-Tabellenansicht** für CareSuite+ Office Klient:innen um — gemäß `05_SCREEN_BLUEPRINTS` Desktop: Tabelle + Detail. Ab `desktop` breakpoint (≥1200px) ersetzt die Tabelle die Kartenliste; Phone/Tablet behalten Karten.

---

## 2. Implementiert

| Route | Änderung |
|-------|----------|
| `/office/clients` | Desktop: `ClientsListTable` statt `ClientListCard` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/components/ui/PremiumDataTable.tsx` | Wiederverwendbare Dark-Premium-Tabelle |
| `src/components/office/ClientsListTable.tsx` | Spalten: Name, Status, Ort, Pflegegrad, Aktionen |
| `src/components/office/ClientsListView.tsx` | `useDeviceClass` + `isDesktopClass` → Tabellenlayout |
| `src/theme/designTokens.ts` | `designTokens.table` — Row/Header/Selected-Tokens |
| `src/__tests__/office/officeClientsList.test.ts` | +3 Tests (Desktop-Tabelle) |

**UX:** Desktop-Tabelle mit Header-Zeile, Zebra-Rows, Orange-Selected-State, „Akte"-Aktion. Master-Detail auf Tablet+ unverändert; Desktop-Split-Pane nutzt kompakte Tabelle im Master-Pane.

---

## 3. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **423** passed (+3) |
| `npm run smoke` | ✅ 252 routes |

---

## 4. Deferred to Sprint 13+

| Priorität | Item |
|-----------|------|
| P1 | Desktop-Tabelle Mitarbeitende |
| P2 | Spalten-Sortierung per Klick im Table-Header |
| P2 | View-Toggle Karten/Tabelle auf Desktop |

---

## 5. Verdict

Klient:innen-Liste hat jetzt eine **echte Desktop-Verwaltungstabelle** — kein Store-Release. Mitarbeitende-Tabelle und erweiterte Table-Features folgen in Sprint 13+.

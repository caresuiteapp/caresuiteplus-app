# MEGA Masterprompt v2 — Sprint 43 Report

**Datum:** 2026-06-14  
**Scope:** Bewohner + Kurse DesktopListViewToggle + AsyncStorage-Persistenz  
**Verdict:** UX-Konsistenz Stationär/Akademie — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 43 schloss die **View-Toggle-Persistenz-Lücke** für Stationär Bewohner:innen und Akademie Kurse — analog Sprint 30/38/40 (Klient:innen, MA, Durchführung, Fahrten). Auf Desktop (≥1200px) bleibt Tabelle Standard; Nutzer:innen können per Toggle zur Kartenansicht wechseln, Präferenz überlebt App-Neustart.

---

## 2. Implementiert

| Modul | Route | Storage-Key |
|-------|-------|-------------|
| Bewohner:innen | `/stationaer/(tabs)/bewohner` | `stationaer.residents` |
| Kurse | `/akademie/(tabs)/courses` | `akademie.courses` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/components/stationaer/ResidentsListHero.tsx` | `DesktopListViewToggle` im Hero |
| `src/components/stationaer/ResidentsListView.tsx` | `useDesktopListViewPreference` + viewMode-Logik |
| `src/components/akademie/CoursesListHero.tsx` | `DesktopListViewToggle` im Hero |
| `src/components/akademie/CoursesListView.tsx` | `useDesktopListViewPreference` + viewMode-Logik |
| `src/__tests__/stationaer/stationaerResidentsViewToggle.test.ts` | 4 Wiring-Tests |
| `src/__tests__/akademie/akademieCoursesViewToggle.test.ts` | 4 Wiring-Tests |
| `src/__tests__/office/officeDesktopListViewPreference.test.ts` | +2 Persistenz-Wiring-Tests |

**UX:** Wiederverwendet `DesktopListViewToggle` aus Sprint 30. Embedded-Ansichten (Master-Detail) zeigen keinen Toggle. Alle **sechs** Desktop-Verwaltungstabellen haben jetzt Karten/Tabelle-Umschalter mit Persistenz.

---

## 3. Demo vs. Live

| Modus | Bewohner/Kurse View-Toggle |
|-------|---------------------------|
| **Demo** | AsyncStorage-Präferenz unverängert |
| **Live** | Kein Backend-Bezug — rein clientseitig |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ siehe Sprint 44 kumulativ |
| `npm run smoke` | ✅ 253 routes |

---

## 5. Deferred to Sprint 44+

| Priorität | Item |
|-----------|------|
| P2 | QM Lesebestätigungen Live-Repository → **Sprint 44** |
| P2 | Remote-Migrationen 0021–0030 anwenden + Live-Pilot-Seed |
| P3 | DSGVO DataRequest/AccountDeletion Screens |
| P3 | EAS project:init + Preview Builds |

---

## 6. Verdict

Bewohner:innen und Kurse folgen jetzt dem gleichen Desktop-View-Pattern wie Office und Assist — sechs Listen mit Toggle + AsyncStorage-Persistenz.

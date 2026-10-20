# MEGA Masterprompt v2 — Sprint 31 Report

**Datum:** 2026-06-14  
**Scope:** Desktop View-Toggle Karten/Tabelle — Office Mitarbeitende  
**Verdict:** UX-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 31 übertrug den **Desktop-Umschalter Karten/Tabelle** aus Sprint 30 (Klient:innen) auf Mitarbeitende. Auf Desktop (≥1200px) bleibt Tabelle Standard; Nutzer:innen können per Toggle zur Kartenansicht wechseln.

---

## 2. Implementiert

| Komponente | Änderung |
|------------|----------|
| `DesktopListViewToggle` | Wiederverwendet aus Sprint 30 (keine Änderung) |
| `EmployeesListHero` | Toggle im Hero-Frame bei `showViewToggle` |
| `EmployeesListView` | `viewMode`-State; Tabelle nur wenn Desktop + `viewMode === 'table'` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/components/office/EmployeesListHero.tsx` | Toggle-Integration im Hero |
| `src/components/office/EmployeesListView.tsx` | View-Mode-Steuerung |
| `src/__tests__/office/officeEmployeesViewToggle.test.ts` | Wiring-Tests |

---

## 3. Verhalten

| Viewport | Standard | Toggle sichtbar |
|----------|----------|-----------------|
| Mobile/Tablet | Karten | Nein |
| Desktop (≥1200px) | Tabelle | Ja (im Hero) |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **562** passed (+3 kumulativ zu Sprint 30) |
| `npm run smoke` | ✅ 253 routes |

---

## 5. Deferred to Sprint 32+

| Priorität | Item |
|-----------|------|
| P2 | Persistenz View-Präferenz (AsyncStorage) |
| P2 | Desktop-Tabelle Durchführung + Fahrten |
| P2 | Assist Tracking-Tab Premium |

---

## 6. Verdict

Mitarbeitende-Desktop hat jetzt denselben Karten/Tabelle-Umschalter wie Klient:innen — kein Store-Release.

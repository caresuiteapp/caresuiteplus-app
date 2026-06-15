# MEGA Masterprompt v2 — Sprint 30 Report

**Datum:** 2026-06-14  
**Scope:** Desktop View-Toggle Karten/Tabelle — Office Klient:innen  
**Verdict:** UX-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 30 ergänzte einen **Desktop-Umschalter Karten/Tabelle** im `PremiumListHeroFrame`-Bereich der Klient:innen-Liste. Auf Desktop (≥1200px) ist die Tabellenansicht weiterhin Standard, Nutzer:innen können aber per Toggle zur Kartenansicht wechseln.

---

## 2. Implementiert

| Komponente | Änderung |
|------------|----------|
| `DesktopListViewToggle` | Wiederverwendbarer SegmentedTabs-Umschalter (`cards` / `table`) |
| `ClientsListHero` | Toggle im Hero-Frame bei `showViewToggle` |
| `ClientsListView` | `viewMode`-State; Tabelle nur wenn Desktop + `viewMode === 'table'` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/components/ui/DesktopListViewToggle.tsx` | Karten/Tabelle-Toggle |
| `src/components/office/ClientsListHero.tsx` | Toggle-Integration im Hero |
| `src/components/office/ClientsListView.tsx` | View-Mode-Steuerung |
| `src/__tests__/office/officeClientsViewToggle.test.ts` | Wiring-Tests |

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
| `npm run test` | ✅ **559** passed (+3 kumulativ zu Sprint 29) |
| `npm run smoke` | ✅ |

---

## 5. Deferred to Sprint 31+

| Priorität | Item |
|-----------|------|
| P2 | View-Toggle auch Mitarbeitende |
| P2 | Persistenz View-Präferenz (AsyncStorage) |
| P2 | Desktop-Tabelle Durchführung + Fahrten |

---

## 6. Verdict

Klient:innen-Desktop hat jetzt expliziten Karten/Tabelle-Umschalter im Premium-Hero — kein Store-Release.

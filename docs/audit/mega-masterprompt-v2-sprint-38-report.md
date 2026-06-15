# MEGA Masterprompt v2 — Sprint 38 Report

**Datum:** 2026-06-14  
**Scope:** View-Präferenz AsyncStorage Persistenz — Klient:innen + Mitarbeitende  
**Verdict:** UX-Persistenz-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 38 wählte **View-Präferenz Persistenz** statt QM Live-Repository — QM-Handbuch-Live wäre vergleichbar groß (Mapper + Migration + Tree), View-Toggle-Persistenz schließt Sprint 30/31 UX-Lücke (Toggle ohne Session-Überleben) mit minimalem, fokussiertem Diff.

---

## 2. Implementiert

| Modul | Route | Änderung |
|-------|-------|----------|
| Klient:innen | `/office/clients` | `useDesktopListViewPreference('office.clients')` |
| Mitarbeitende | `/office/employees` | `useDesktopListViewPreference('office.employees')` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/lib/preferences/desktopListViewPreference.ts` | AsyncStorage load/save/clear |
| `src/hooks/useDesktopListViewPreference.ts` | React-Hook mit `ready`-State |
| `src/components/office/ClientsListView.tsx` | Persistierter View-Modus |
| `src/components/office/EmployeesListView.tsx` | Persistierter View-Modus |
| `src/__tests__/office/officeDesktopListViewPreference.test.ts` | Persistenz + Wiring Tests |

**UX:** Desktop-Umschalter Karten/Tabelle bleibt Standard `table`; gewählter Modus überlebt App-Neustart pro Modul-Key. Durchführung/Fahrten unverändert (nicht in Sprint-38-Scope).

---

## 3. Verhalten

| Aspekt | Detail |
|--------|--------|
| Storage-Key | `caresuite:desktop-list-view:{moduleKey}` |
| Default | `table` auf Desktop |
| AsyncStorage | `@react-native-async-storage/async-storage` (bestehendes Pattern) |
| Migrationen | Keine — UI-only |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **606** passed (+17 zu Sprint 36) |
| `npm run smoke` | ✅ 253 routes |

---

## 5. Deferred to Sprint 39+

| Priorität | Item |
|-----------|------|
| P2 | QM Live-Repository (Handbuch-Kapitel) |
| P2 | View-Präferenz Durchführung + Fahrten |
| P2 | Store/EAS-Audit |

---

## 6. Verdict

Office Desktop-Listen merken sich jetzt Karten/Tabelle-Präferenz — kleiner UX-Win ohne Store-Release. QM Live und Assist-View-Persistenz folgen.

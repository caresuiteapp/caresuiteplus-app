# MEGA Masterprompt v2 — Sprint 95 Report

**Datum:** 2026-06-14  
**Scope:** Office Dokumente / Rechnungen / Termine Desktop-Tabelle + View-Toggle  
**Verdict:** Premium desktop tables with AsyncStorage persist — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 95 schloss die letzte CareSuite+ Office Desktop-View-Toggle-Lücke:

- **Dokumente** — `DocumentsListTable` + Toggle auf `/office/documents`
- **Rechnungen** — `InvoicesListTable` + Toggle (inkl. embedded Billing-Tab)
- **Termine** — `AppointmentsListTable` + Toggle (inkl. embedded Master-Detail)

Pattern identisch zu Klient:innen/Mitarbeitende (Sprint 30–31): `PremiumDataTable`, `DesktopListViewToggle`, `useDesktopListViewPreference`.

Keine Pflege-Pfade bearbeitet.

---

## 2. Implementiert

| Artefakt | Änderung |
|----------|----------|
| `DocumentsListTable.tsx` | PremiumDataTable für Office-Dokumente |
| `InvoicesListTable.tsx` | PremiumDataTable für Rechnungen |
| `AppointmentsListTable.tsx` | PremiumDataTable für Termine |
| `DocumentsListHero.tsx` | View-Toggle-Props |
| `InvoicesListHero.tsx` | View-Toggle-Props |
| `AppointmentsListHero.tsx` | View-Toggle-Props |
| `DocumentsListView.tsx` | Desktop table/card switch + `office.documents` Persistenz |
| `InvoicesListView.tsx` | Desktop table/card switch + `office.invoices` Persistenz |
| `AppointmentsListView.tsx` | Desktop table/card switch + `office.appointments` Persistenz |

---

## 3. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **1014** passed |
| `npm run smoke` | ✅ 273 routes |
| `npm run platform:audit` | ✅ PASS |
| `npm run store:audit` | ✅ PASS (3 erwartete Warnungen) |
| `npm run design:audit` | ✅ PASS |
| `npm run responsive:audit` | ✅ PASS |

---

## 4. Verdict

**12 Module** mit Desktop View-Toggle (Office×5, Assist×3, Stationär, Akademie, Beratung, Reporting). CareSuite+ Office Listen vollständig tabellenfähig auf Desktop — weiterhin Demo-Prototyp, kein Store-Kandidat.

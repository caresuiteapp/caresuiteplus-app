# MEGA Masterprompt v2 — Sprint 26 Report

**Datum:** 2026-06-14  
**Scope:** Desktop-Tabellen Bewohner:innen + Kurse (`PremiumDataTable`)  
**Verdict:** Desktop-Verwaltungstabellen Stationär/Akademie — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 26 setzte die **Desktop-Tabellenansicht** für Stationär Bewohner:innen und Akademie Kurse um — analog Sprint 11/14 (Klient:innen/Mitarbeitende). Ab `desktop` breakpoint (≥1200px) ersetzt die Tabelle die Kartenliste; Phone/Tablet behalten Karten + Master-Detail.

---

## 2. Implementiert

| Route | Änderung |
|-------|----------|
| `/stationaer/(tabs)/bewohner` | Desktop: `ResidentsListTable` statt `ResidentListCard` |
| `/akademie/(tabs)/courses` | Desktop: `CoursesListTable` statt `CourseListCard` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/components/stationaer/ResidentsListTable.tsx` | Spalten: Name, Status, Zimmer, Bereich, PG, Aufnahme, Aktionen |
| `src/components/stationaer/ResidentsListView.tsx` | `useDeviceClass` + `isDesktopClass` → Tabellenlayout |
| `src/components/akademie/CoursesListTable.tsx` | Spalten: Titel, Status, Kategorie, Dauer, Teilnehmende, Start, Aktionen |
| `src/components/akademie/CoursesListView.tsx` | Desktop-Tabellenlayout + Header-Sort |
| `src/__tests__/stationaer/stationaerResidentsList.test.ts` | +4 Desktop-Tabelle Tests |
| `src/__tests__/akademie/akademieCoursesList.test.ts` | +4 Desktop-Tabelle Tests |

**UX:** Desktop-Tabellen mit Header-Sort (Name/Aufnahme bzw. Titel/Start), Zebra-Rows, Orange-Selected-State, „Akte"/„Kurs"-Aktion. Master-Detail auf Tablet+ unverändert.

---

## 3. Demo vs. Live

| Modul | Modus |
|-------|-------|
| **Stationär Bewohner** | Demo-Liste via `guardServiceTenant` — UI-only Sprint |
| **Akademie Kurse** | Demo-Liste via `guardServiceTenant` — UI-only Sprint |
| **service_role im Frontend** | ❌ Nicht verwendet |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **527** passed (+6 kumulativ zu Sprint 25) |
| `npm run smoke` | ✅ 253 routes |

---

## 5. Deferred to Sprint 27+

| Priorität | Item |
|-----------|------|
| P1 | Live-Supabase Stationär/Akademie List/Detail |
| P1 | Live-Supabase Reporting List/Detail |
| P1 | trips Live-Backfill / Seed für Pilot-Mandant |
| P2 | View-Toggle Karten/Tabelle auf Desktop |
| P2 | Desktop-Tabelle Durchführung + Fahrten |
| P2 | Assist Tracking-Tab Premium neben Fahrtenbuch |
| P2 | Live `completeTrip` + Tracking-Dashboard |

---

## 6. Verdict

Stationär und Akademie haben jetzt **echte Desktop-Verwaltungstabellen** im Premium-Pattern — kein Store-Release. Live-Supabase-Wiring für diese Module folgt in Sprint 27+.

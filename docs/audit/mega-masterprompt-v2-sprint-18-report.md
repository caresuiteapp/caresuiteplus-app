# MEGA Masterprompt v2 — Sprint 18 Report

**Datum:** 2026-06-13  
**Scope:** Akademie Kurse — Premium-Slice (Hero, Suche, Filter, Master-Detail, guardServiceTenant)  
**Verdict:** Sensational demo-quality Akademie slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 18 wählte **Akademie Kurse** statt QM-Handbuch Entry Polish — höherer Blueprint-P0-Impact: Kern-Tab des Akademie-Moduls mit bestehendem `courseListService` + `guardServiceTenant`, analog Sprint 15/17 Premium-Pattern. QM-Handbuch ist Tree-Navigation ohne List/Master-Detail-Bedarf.

---

## 2. Implementiert

| Route | Änderung |
|-------|----------|
| `/akademie/(tabs)/courses` | `CoursesAdaptiveScreen` → Premium-Liste + Summary Master-Detail |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/data/demo/courseListStats.ts` | KPI-Builder (Aktiv, Pflicht, Termine) |
| `src/components/akademie/CoursesListHero.tsx` | Dark-Premium Hero (AKADEMIE) |
| `src/components/akademie/CoursesListView.tsx` | Hauptansicht mit States |
| `src/components/akademie/CourseDetailSummaryPanel.tsx` | Dauer, Dozent, Einschreibungen, CTA |
| `src/components/akademie/CourseListCard.tsx` | `selected`-Zustand für Master-Detail |
| `src/screens/akademie/CoursesListScreen.tsx` | Dünne Shell |
| `src/screens/akademie/CoursesAdaptiveScreen.tsx` | Master-Detail-Layout |
| `src/hooks/useCourseList.ts` | `allItems` für KPIs |
| `src/__tests__/akademie/akademieCoursesList.test.ts` | 10 fokussierte Tests |

**UX:** Hero (Aktiv, Pflicht, Termine), Suche (Titel/Kategorie), Status-Chips, Sort (Titel, Starttermin), Master-Detail auf Tablet+, CTA zur Vollansicht unter `/akademie/courses/[id]`.

---

## 3. Demo vs. Live

| Modus | Kurse |
|-------|-------|
| **Demo** | `demoCourses` / `getDemoCourseListItems` |
| **Live (Supabase)** | Noch Demo-only in List-Service |
| **guardServiceTenant** | ✅ courseListService + courseDetailService |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **479** passed (+10) |
| `npm run smoke` | ✅ 252 routes |

---

## 5. Deferred to Sprint 19+

| Priorität | Item |
|-----------|------|
| P1 | Live-Supabase Trip-Repo + volle Feld-Mappings |
| P1 | Office-Nachrichten Compose/Antwort (echte Flows) |
| P2 | QM Handbuch Entry Polish (Hero, KPIs) |
| P2 | Desktop-Tabelle Bewohner:innen + Kurse |
| P2 | View-Toggle Karten/Tabelle auf Desktop |
| P2 | Store/EAS-Audit |

---

## 6. Verdict

Akademie Kurse jetzt auf gleichem Premium-Niveau wie Beratung/Stationär-Slices — **kein Store-Release**. QM-Handbuch-Polish und Live-Repos folgen.

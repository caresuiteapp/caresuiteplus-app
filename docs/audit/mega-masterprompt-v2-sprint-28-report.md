# MEGA Masterprompt v2 — Sprint 28 Report

**Datum:** 2026-06-14  
**Scope:** Live Supabase Akademie Kurse List + Detail Mapping  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 28 setzte **Live Supabase Akademie Kurse** um — analog Sprint 27 Stationär. `courseListService` und `courseDetailService` nutzen in Live-Modus `akademieSupabaseRepository` ohne Demo-Fallback. Reporting List/Detail bleibt für Sprint 29+.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchCourseList` | Live-Pfad via `getServiceMode() === 'supabase'` → `akademieSupabaseRepository.listMapped` |
| `fetchCourseDetail` | Live-Pfad → `akademieSupabaseRepository.getDetailMapped` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/0025_catalogs_live_list_fields.sql` | Live-Listen-Felder für Kurse |
| `supabase/migrations/0026_catalogs_live_detail_fields.sql` | Detail-Felder Beschreibung, Dozent:in, Abschlussquote |
| `src/lib/akademie/courseListMapper.ts` | Feld-Validierung + Mapping → `CourseListItem` |
| `src/lib/akademie/courseDetailMapper.ts` | Detail-Mapping → `CourseDetail` |
| `src/lib/services/repositories/akademieRepository.supabase.ts` | `listForCourses`, `listMapped`, `getDetailMapped` |
| `src/lib/akademie/courseListService.ts` | Repo-Switch ohne Demo-Fallback in Live |
| `src/lib/akademie/courseDetailService.ts` | Detail-Repo-Switch ohne Demo-Fallback |
| `src/__tests__/akademie/coursesLiveMigration.test.ts` | Migration 0025 Tests |
| `src/__tests__/akademie/coursesLiveDetail.test.ts` | Mapper + Detail-Wiring Tests |

**Live-Verhalten:**

- Leere `catalogs` mit `catalog_type = 'course'` → leere Liste (ok)
- Zeilen ohne Live-Felder → Fehler: `Live-Kursliste: Supabase-Schema unvollständig (…)`
- Vollständige Zeilen → korrektes `CourseListItem` / `CourseDetail`-Mapping
- Demo-Modus → unverändert Demo-Daten

---

## 3. Demo vs. Live

| Modus | Kurse |
|-------|-------|
| **Demo** | `getDemoCourseListItems()` / `getDemoCourseById()` |
| **Live (Supabase)** | `akademieSupabaseRepository` — kein Demo-Fallback |
| **Schema 0007** | Basis-Spalten; erweiterte Felder fehlen → ehrlicher Fehler |
| **guardServiceTenant** | ✅ unverändert |

---

## 4. Migration-Hinweis (Remote)

| Migration | Status |
|-----------|--------|
| `0021_trips_live_list_fields.sql` | **Remote noch nicht angewendet** |
| `0022_trips_live_detail_fields.sql` | **Remote noch nicht angewendet** |
| `0023_care_records_live_list_fields.sql` | **Remote noch nicht angewendet** |
| `0024_care_records_live_detail_fields.sql` | **Remote noch nicht angewendet** |
| `0025_catalogs_live_list_fields.sql` | **Neu Sprint 28 — Remote noch nicht angewendet** |
| `0026_catalogs_live_detail_fields.sql` | **Neu Sprint 28 — Remote noch nicht angewendet** |

Keine destruktiven DB-Ops in dieser Session.

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **545** passed (+9 kumulativ zu Sprint 27) |
| `npm run smoke` | ✅ 253 routes |

---

## 6. Deferred to Sprint 29+

| Priorität | Item |
|-----------|------|
| P1 | Live Supabase Reporting List/Detail |
| P1 | trips + Stationär + Akademie Live-Backfill / Seed für Pilot-Mandant |
| P2 | View-Toggle Karten/Tabelle auf Desktop |
| P2 | Desktop-Tabelle Durchführung + Fahrten |
| P2 | Live `completeTrip` + Tracking-Dashboard |

---

## 7. Verdict

Akademie Kurse haben jetzt ehrliches Live-List- und Detail-Wiring — Schema-Erweiterung 0025/0026 nötig bevor Live-Daten angezeigt werden. **Kein Store-Release.**

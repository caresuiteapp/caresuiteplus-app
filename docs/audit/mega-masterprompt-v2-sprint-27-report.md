# MEGA Masterprompt v2 — Sprint 27 Report

**Datum:** 2026-06-14  
**Scope:** Live Supabase Stationär Bewohner:innen List + Detail Mapping  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 27 setzte **Live Supabase Bewohner:innen** um — analog Sprint 22/25 Assist Fahrten. `residentListService` und `residentDetailService` nutzen in Live-Modus `stationaerSupabaseRepository` ohne Demo-Fallback; unvollständiges Schema liefert ehrliche deutsche Fehlermeldung.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchResidentList` | Live-Pfad via `getServiceMode() === 'supabase'` → `stationaerSupabaseRepository.listMapped` |
| `fetchResidentDetail` | Live-Pfad → `stationaerSupabaseRepository.getDetailMapped` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/0023_care_records_live_list_fields.sql` | Live-Listen-Felder + `record_type` |
| `supabase/migrations/0024_care_records_live_detail_fields.sql` | Detail-Felder `room_id`, `notes` |
| `src/lib/stationaer/residentListMapper.ts` | Feld-Validierung + Mapping → `ResidentListItem` |
| `src/lib/stationaer/residentDetailMapper.ts` | Detail-Mapping → `ResidentDetail` |
| `src/lib/services/repositories/stationaerRepository.supabase.ts` | `listForResidents`, `listMapped`, `getDetailMapped` |
| `src/lib/stationaer/residentListService.ts` | Repo-Switch ohne Demo-Fallback in Live |
| `src/lib/stationaer/residentDetailService.ts` | Detail-Repo-Switch ohne Demo-Fallback |
| `src/__tests__/stationaer/residentsLiveMigration.test.ts` | Migration 0023 Tests |
| `src/__tests__/stationaer/residentsLiveDetail.test.ts` | Mapper + Detail-Wiring Tests |

**Live-Verhalten:**

- Leere `care_records` mit `record_type = 'resident'` → leere Liste (ok)
- Zeilen ohne Live-Felder → Fehler: `Live-Bewohnerliste: Supabase-Schema unvollständig (…)`
- Vollständige Zeilen → korrektes `ResidentListItem` / `ResidentDetail`-Mapping
- Demo-Modus → unverändert Demo-Daten

---

## 3. Demo vs. Live

| Modus | Bewohner:innen |
|-------|----------------|
| **Demo** | `getDemoResidentListItems()` / `getDemoResidentById()` |
| **Live (Supabase)** | `stationaerSupabaseRepository` — kein Demo-Fallback |
| **Schema 0007** | Basis-Spalten; erweiterte Felder fehlen → ehrlicher Fehler |
| **guardServiceTenant** | ✅ unverändert |

---

## 4. Migration-Hinweis (Remote)

| Migration | Status |
|-----------|--------|
| `0021_trips_live_list_fields.sql` | **Remote noch nicht angewendet** — manuell pushen |
| `0022_trips_live_detail_fields.sql` | **Remote noch nicht angewendet** — manuell pushen |
| `0023_care_records_live_list_fields.sql` | **Neu Sprint 27 — Remote noch nicht angewendet** |
| `0024_care_records_live_detail_fields.sql` | **Neu Sprint 27 — Remote noch nicht angewendet** |

Keine destruktiven DB-Ops in dieser Session. Remote-Apply via `supabase db push` oder Dashboard SQL-Editor.

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **536** passed (+9 kumulativ zu Sprint 26) |
| `npm run smoke` | ✅ 253 routes |

---

## 6. Deferred to Sprint 28+

| Priorität | Item |
|-----------|------|
| P1 | Live Supabase Akademie Kurse List/Detail |
| P1 | Live Supabase Reporting List/Detail |
| P1 | trips Live-Backfill / Seed für Pilot-Mandant |
| P2 | View-Toggle Karten/Tabelle auf Desktop |

---

## 7. Verdict

Erster ehrlicher Live-Listen- und Detail-Slice für Stationär Bewohner:innen — Schema-Erweiterung 0023/0024 nötig bevor Live-Daten angezeigt werden. **Kein Store-Release.**

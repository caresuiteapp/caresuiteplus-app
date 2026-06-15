# MEGA Masterprompt v2 — Sprint 25 Report

**Datum:** 2026-06-14  
**Scope:** Live Trip-Detail-Mapping (`fetchTripDetail`)  
**Verdict:** Ehrlicher Live-Detail-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 25 schließt den offenen Detail-Blocker aus Sprint 22/23 ab: `fetchTripDetail` nutzt in Live-Modus `tripSupabaseRepository.getDetailMapped` ohne Demo-Fallback. Migration `0022` ergänzt Detail-Spalten; `tripDetailMapper` liefert ehrliche Fehler bei unvollständigem Schema oder fehlenden Pflichtwerten.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchTripDetail` | Live-Pfad via `getServiceMode() === 'supabase'` → `getDetailMapped` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/0022_trips_live_detail_fields.sql` | `start_address`, `end_address`, `notes` |
| `src/lib/assist/tripDetailMapper.ts` | `TRIP_DETAIL_SELECT_COLUMNS`, Schema-/Daten-Validierung |
| `src/lib/assist/tripListMapper.ts` | Export `mapCompleteTripRow`, `rowDataMissingFields` |
| `src/lib/services/repositories/tripRepository.supabase.ts` | `getByIdForTripLog`, `getDetailMapped` |
| `src/lib/assist/tripLogService.ts` | Repo-Switch für Detail ohne Demo-Fallback in Live |
| `src/__tests__/assist/tripsLiveDetail.test.ts` | Migration + Mapper + Wiring (+6) |

**Live-Verhalten nach Migration 0021 + 0022:**

- Zeile nicht gefunden → `Fahrt nicht gefunden.`
- Detail-Spalten fehlen im Schema → ehrlicher Fehler (`start_address` etc.)
- Listen-Pflichtfelder leer → ehrlicher Fehler
- `start_address` leer → ehrlicher Fehler
- Vollständige Zeile → `TripLogDetail` inkl. Route, Adressen, Notizen; `geofenceEvents: []`
- Demo-Modus → unverändert Demo-Daten inkl. Geofence-Events

---

## 3. Demo vs. Live

| Modus | Fahrtdetail |
|-------|-------------|
| **Demo** | `getDemoTripById` + Geofence-Events |
| **Live (Supabase)** | `tripSupabaseRepository.getDetailMapped` — kein Demo-Fallback |
| **Migration 0021** | Listen-Felder — **auf Remote anwenden falls noch nicht gepusht** |
| **Migration 0022** | Detail-Felder — **neu, Remote noch nicht angewendet** |
| **Destructive SQL** | ❌ Kein DROP/TRUNCATE |
| **service_role im Frontend** | ❌ Nicht verwendet |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **521** passed (+6) |
| `npm run smoke` | ✅ 253 routes |

---

## 5. Deferred to Sprint 26+

| Priorität | Item |
|-----------|------|
| P1 | Desktop-Tabelle Bewohner:innen + Kurse |
| P1 | Live-Supabase Stationär/Akademie List/Detail |
| P1 | Live-Supabase Reporting List/Detail |
| P1 | trips Live-Backfill / Seed für Pilot-Mandant |
| P2 | Live `completeTrip` + Tracking-Dashboard |
| P2 | View-Toggle Karten/Tabelle auf Desktop |

---

## 6. Verdict

Erster ehrlicher Live-Detail-Slice für Assist Fahrten — Migrationen 0021 + 0022 und Backfill nötig bevor Live-Details angezeigt werden. **Kein Store-Release.**

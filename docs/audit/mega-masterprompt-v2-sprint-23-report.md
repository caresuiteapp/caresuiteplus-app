# MEGA Masterprompt v2 — Sprint 23 Report

**Datum:** 2026-06-14  
**Scope:** Safe Supabase Migration trips Live-Felder + tripListMapper  
**Verdict:** Schema-Slice für Live-Fahrtenliste — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 23 schließt den offenen Schema-Blocker aus Sprint 22 ab: Migration `0021` ergänzt `trips` um Live-Listen-Felder (0018-Stil, nur `ADD COLUMN IF NOT EXISTS`). `tripListMapper` mappt vollständige Zeilen; unvollständige Daten werden übersprungen statt die gesamte Liste zu blockieren.

---

## 2. Implementiert

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/0021_trips_live_list_fields.sql` | `employee_name`, `vehicle_label`, `purpose`, `started_at`, `ended_at` + Index |
| `src/lib/assist/tripListMapper.ts` | `TRIP_LIVE_SELECT_COLUMNS`, Schema- vs. Daten-Validierung |
| `src/lib/services/repositories/tripRepository.supabase.ts` | SELECT auf Live-Spalten |
| `src/__tests__/assist/tripsLiveMigration.test.ts` | Migration + Mapper-Tests (2) |
| `src/__tests__/communication/communicationCenterList.test.ts` | Skip-Logik + Repo-SELECT (+2) |

**Live-Verhalten nach Migration:**

- Spalten fehlen im SELECT/Schema → ehrlicher Fehler
- Spalten vorhanden, Werte leer → Zeile übersprungen, restliche Zeilen gemappt
- Vollständige Zeilen → `TripLogListItem`

---

## 3. Demo vs. Live

| Modus | Fahrtenliste |
|-------|-------------|
| **Demo** | unverändert |
| **Live (Supabase)** | Repo SELECT mit Live-Spalten; Migration 0021 erforderlich |
| **Destructive SQL** | ❌ Kein DROP/TRUNCATE |
| **service_role im Frontend** | ❌ Nicht verwendet |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ (siehe kumulativ) |
| `npm run smoke` | ✅ |

---

## 5. Deferred to Sprint 24+

| Priorität | Item |
|-----------|------|
| P1 | Live Trip-Detail-Mapping |
| P1 | Office-Nachrichten Compose/Antwort |
| P1 | Live Stationär/Akademie List/Detail |

---

## 6. Verdict

Migration bereit für sicheres Anwenden auf Remote — Live-Fahrtenliste kann nach Backfill vollständige Zeilen anzeigen. **Kein Store-Release.**

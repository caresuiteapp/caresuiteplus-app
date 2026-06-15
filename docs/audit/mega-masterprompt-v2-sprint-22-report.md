# MEGA Masterprompt v2 — Sprint 22 Report

**Datum:** 2026-06-14  
**Scope:** Live Supabase Trip-Repo — Listen-Mapping ohne Demo-Fallback  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 22 wählte **Assist Fahrten (trips)** als High-Value-Repo — höherer Impact als Stationär/Reporting (bereits Premium-UI, aber List-Services noch Demo-only). Live-Modus nutzt `tripSupabaseRepository.listMapped` ohne Demo-Fallback; unvollständiges Schema liefert ehrliche deutsche Fehlermeldung.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchTripLogList` | Live-Pfad via `getServiceMode() === 'supabase'` → `tripSupabaseRepository.listMapped` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/lib/assist/tripListMapper.ts` | Feld-Validierung + Mapping `TripLiveRow` → `TripLogListItem` |
| `src/lib/services/repositories/tripRepository.supabase.ts` | `listForTripLog`, `listMapped`, `list` (Snapshot-Kompatibilität) |
| `src/lib/assist/tripLogService.ts` | Repo-Switch ohne Demo-Fallback in Live |
| `src/__tests__/communication/communicationCenterList.test.ts` | Live-Mapping-Tests (3) |
| `src/__tests__/assist/assistTripsList.test.ts` | Live-Pfad-Assertion |
| `src/__tests__/core/liveSupabaseWiring.test.ts` | `tripLogService` Live-Wiring |

**Live-Verhalten:**

- Leere `trips`-Tabelle → leere Liste (ok)
- Zeilen ohne `employee_name`, `vehicle_label`, `purpose`, `started_at` → Fehler: `Live-Fahrtenliste: Supabase-Schema unvollständig (…)`
- Vollständige Zeilen → korrektes `TripLogListItem`-Mapping
- Demo-Modus → unverändert `getDemoTripListItems()`

---

## 3. Demo vs. Live

| Modus | Fahrtenliste |
|-------|-------------|
| **Demo** | `getDemoTripListItems()` |
| **Live (Supabase)** | `tripSupabaseRepository` — kein Demo-Fallback |
| **Schema 0007** | Basis-Spalten vorhanden; erweiterte Felder fehlen → ehrlicher Fehler |
| **guardServiceTenant** | ✅ unverändert |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **506** passed |
| `npm run smoke` | ✅ 252 routes |

---

## 5. Deferred to Sprint 23+

| Priorität | Item |
|-----------|------|
| P1 | Migration trips: `employee_name`, `vehicle_label`, `purpose`, `started_at` |
| P1 | Live Trip-Detail-Mapping (`fetchTripDetail`) |
| P1 | Office-Nachrichten Compose/Antwort |
| P1 | Live Stationär/Akademie List/Detail |
| P2 | Desktop-Tabelle Bewohner:innen + Kurse |
| P2 | Store/EAS-Audit |

---

## 6. Verdict

Erster ehrlicher Live-Listen-Slice für Assist Fahrten — Schema-Erweiterung nötig bevor Live-Daten angezeigt werden. **Kein Store-Release.**

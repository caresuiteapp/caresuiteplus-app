# MEGA Masterprompt v2 — Sprint 37 Report

**Datum:** 2026-06-14  
**Scope:** Live completeTrip + Tracking-Dashboard Supabase Wiring  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 37 setzte **Live Supabase completeTrip + Tracking-Dashboard** um — `completeTrip` und `fetchTrackingDashboard` nutzen in Live-Modus Supabase-Repositories ohne Demo-Fallback. Tracking-Dashboard folgt dem PDL-Cockpit-Snapshot-Pattern (Migration 0030).

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `completeTrip` | Live-Pfad via `tripSupabaseRepository.completeTripMapped` (UPDATE auf `trips`) |
| `fetchTrackingDashboard` | Live-Pfad via `trackingSupabaseRepository.getDashboardMapped` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/0030_assist_tracking_dashboard_live.sql` | Tabelle `assist_tracking_dashboard` + RLS |
| `src/lib/assist/trackingDashboardMapper.ts` | Feld-Validierung + Mapping → `TrackingDashboard` |
| `src/lib/services/repositories/trackingRepository.supabase.ts` | `getDashboardForTenant`, `getDashboardMapped` |
| `src/lib/services/repositories/tripRepository.supabase.ts` | `completeTrip`, `completeTripMapped` |
| `src/lib/assist/tripLogService.ts` | Repo-Switch ohne Demo-Fallback in Live |
| `scripts/seed-live-pilot.mjs` | Seed-Zeile für `assist_tracking_dashboard` |
| `src/__tests__/assist/tripsCompleteAndTrackingLive.test.ts` | Migration + Mapper + Wiring Tests |

**Live-Verhalten:**

- Keine Tracking-Zeile → leerer Dashboard-Snapshot (KPIs 0, leere Arrays)
- Zeilen ohne Pflicht-JSON-Felder → Fehler: `Live-Tracking: Supabase-Schema unvollständig (…)`
- Vollständige Zeile → korrektes `TrackingDashboard`-Mapping
- `completeTrip` → UPDATE mit `end_address`, `distance_km`, `ended_at`, `status: abgeschlossen`
- Bereits abgeschlossene Fahrt → ehrlicher Fehler
- Demo-Modus → unverändert Demo-Pfade

---

## 3. Demo vs. Live

| Modus | completeTrip / Tracking |
|-------|-------------------------|
| **Demo** | `endDemoTrip` / `getDemoTrackingDashboard()` |
| **Live (Supabase)** | `trips` UPDATE + `assist_tracking_dashboard` — kein Demo-Fallback |
| **Migration 0030** | Tabelle nötig vor Live-Tracking-Daten |
| **guardServiceTenant** | ✅ |
| **service_role im Frontend** | ❌ Nicht verwendet |

---

## 4. Migration-Hinweis (Remote)

| Migration | Status |
|-----------|--------|
| `0021`–`0029` | **Remote noch nicht angewendet** |
| `0030_assist_tracking_dashboard_live.sql` | **Neu Sprint 37 — Remote noch nicht angewendet** |

Keine destruktiven DB-Ops. Backfill via `npm run seed:live-pilot` (nach Migration 0030).

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ (siehe Sprint 38 kumulativ) |
| `npm run smoke` | ✅ 253 routes |

---

## 6. Deferred to Sprint 38+

| Priorität | Item |
|-----------|------|
| P2 | QM Live-Repository |
| P2 | View-Präferenz Persistenz (AsyncStorage) |
| P2 | Store/EAS-Audit |

---

## 7. Verdict

Fahrtenbuch-Abschluss und Live-Tracking-Dashboard sind jetzt Live-fähig mit mandantenbezogenem Snapshot — ehrlicher Slice ohne Store-Release. GPS/expo-location bleibt offen.

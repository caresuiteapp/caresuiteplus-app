# MEGA Masterprompt v2 — Sprint 36 Report

**Datum:** 2026-06-14  
**Scope:** PDL-Cockpit Live Supabase Wiring  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 36 setzte **Live Supabase PDL-Cockpit** um — PDL-Cockpit existiert (`PdlCockpitScreen`, `/business/reporting`). `fetchPdlCockpit` nutzt in Live-Modus `reportingSupabaseRepository.getCockpitMapped` ohne Demo-Fallback. QM Live-Repository bleibt deferred.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchPdlCockpit` | Live-Pfad via `getServiceMode() === 'supabase'` → `getCockpitMapped` |
| `usePdlCockpit` | `useServiceTenantId` statt `REPORTING_DEMO_TENANT` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/0029_reporting_pdl_cockpit_live.sql` | Tabelle `reporting_pdl_cockpit` + RLS |
| `src/lib/reporting/pdlCockpitMapper.ts` | Feld-Validierung + Mapping → `PdlCockpitSnapshot` |
| `src/lib/services/repositories/reportingRepository.supabase.ts` | `getCockpitForTenant`, `getCockpitMapped` |
| `src/lib/reporting/reportingService.ts` | Repo-Switch ohne Demo-Fallback in Live |
| `src/hooks/usePdlCockpit.ts` | `useServiceTenantId` |
| `scripts/seed-live-pilot.mjs` | Seed-Zeile für `reporting_pdl_cockpit` |
| `src/__tests__/reporting/pdlCockpitLive.test.ts` | Migration + Mapper + Wiring Tests |

**Live-Verhalten:**

- Keine Cockpit-Zeile → leerer Snapshot (KPIs/Aufgaben/Risiken leer)
- Zeilen ohne Pflicht-JSON-Felder → Fehler: `Live-PDL-Cockpit: Supabase-Schema unvollständig (…)`
- Vollständige Zeile → korrektes `PdlCockpitSnapshot`-Mapping
- Demo-Modus → unverändert `getDemoPdlCockpit()`

---

## 3. Demo vs. Live

| Modus | PDL-Cockpit |
|-------|-------------|
| **Demo** | `getDemoPdlCockpit()` |
| **Live (Supabase)** | `reporting_pdl_cockpit` — kein Demo-Fallback |
| **Migration 0029** | Tabelle nötig vor Live-Daten |
| **guardServiceTenant** | ✅ |

---

## 4. Migration-Hinweis (Remote)

| Migration | Status |
|-----------|--------|
| `0021`–`0028` | **Remote noch nicht angewendet** |
| `0029_reporting_pdl_cockpit_live.sql` | **Neu Sprint 36 — Remote noch nicht angewendet** |

Keine destruktiven DB-Ops. Backfill via `npm run seed:live-pilot` (nach Migration 0029).

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **589** passed (+7 zu Sprint 35) |
| `npm run smoke` | ✅ 253 routes |

---

## 6. Deferred to Sprint 37+

| Priorität | Item |
|-----------|------|
| P2 | Live `completeTrip` + Tracking-Dashboard (Supabase) |
| P2 | QM Live-Repository |
| P2 | View-Präferenz Persistenz (AsyncStorage) |
| P2 | Store/EAS-Audit |

---

## 7. Verdict

PDL-Cockpit ist jetzt Live-fähig mit mandantenbezogenem Snapshot — ehrlicher Slice ohne Store-Release.

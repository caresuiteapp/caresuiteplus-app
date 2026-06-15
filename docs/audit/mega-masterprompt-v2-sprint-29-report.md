# MEGA Masterprompt v2 — Sprint 29 Report

**Datum:** 2026-06-14  
**Scope:** Live Supabase Reporting List + Detail Mapping  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 29 setzte **Live Supabase Business Reporting** um — analog Sprint 27/28. `fetchReportList` und `fetchReportDetail` nutzen in Live-Modus `reportingSupabaseRepository` ohne Demo-Fallback. PDL-Cockpit bleibt Demo-only.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchReportList` | Live-Pfad via `getServiceMode() === 'supabase'` → `reportingSupabaseRepository.listMapped` |
| `fetchReportDetail` | Live-Pfad → `reportingSupabaseRepository.getDetailMapped` |
| `createReportDraft` | Live-Pfad → `reportingSupabaseRepository.create` |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/0027_reporting_reports_live_list.sql` | Tabelle `reporting_reports` + RLS |
| `supabase/migrations/0028_reporting_reports_live_detail.sql` | Detail-Felder `summary`, `kpi_snapshot` |
| `src/lib/reporting/reportListMapper.ts` | Feld-Validierung + Mapping → `ReportListItem` |
| `src/lib/reporting/reportDetailMapper.ts` | Detail-Mapping → `ReportDetail` |
| `src/lib/services/repositories/reportingRepository.supabase.ts` | `listForReports`, `listMapped`, `getDetailMapped` |
| `src/lib/reporting/reportingService.ts` | Repo-Switch ohne Demo-Fallback in Live |
| `src/hooks/useReportList.ts` | `useServiceTenantId` statt `REPORTING_DEMO_TENANT` |
| `src/hooks/useReportDetail.ts` | `useServiceTenantId` statt `REPORTING_DEMO_TENANT` |
| `src/__tests__/reporting/reportsLiveMigration.test.ts` | Migration 0027 Tests |
| `src/__tests__/reporting/reportsLiveDetail.test.ts` | Mapper + Detail-Wiring Tests |

**Live-Verhalten:**

- Leere `reporting_reports` → leere Liste (ok)
- Zeilen ohne Detail-Felder → Fehler: `Live-Berichtdetail: Supabase-Schema unvollständig (…)`
- Vollständige Zeilen → korrektes `ReportListItem` / `ReportDetail`-Mapping
- Demo-Modus → unverändert Demo-Daten

---

## 3. Demo vs. Live

| Modus | Berichte |
|-------|----------|
| **Demo** | `demoReportList` / `getDemoReportDetail()` |
| **Live (Supabase)** | `reportingSupabaseRepository` — kein Demo-Fallback |
| **Migration 0027/0028** | Tabelle + Detail-Felder nötig vor Live-Daten |
| **guardServiceTenant** | ✅ |

---

## 4. Migration-Hinweis (Remote)

| Migration | Status |
|-----------|--------|
| `0021`–`0026` | **Remote noch nicht angewendet** |
| `0027_reporting_reports_live_list.sql` | **Neu Sprint 29 — Remote noch nicht angewendet** |
| `0028_reporting_reports_live_detail.sql` | **Neu Sprint 29 — Remote noch nicht angewendet** |

Keine destruktiven DB-Ops in dieser Session.

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **559** passed (+14 kumulativ zu Sprint 28) |
| `npm run smoke` | ✅ |

---

## 6. Deferred to Sprint 30+

| Priorität | Item |
|-----------|------|
| P1 | Live-Backfill / Seed für Pilot-Mandant |
| P2 | PDL-Cockpit Live-Wiring |
| P2 | Desktop-Tabelle Durchführung + Fahrten |

---

## 7. Verdict

Business Reporting hat ehrliches Live-List- und Detail-Wiring — Migration 0027/0028 nötig bevor Live-Daten angezeigt werden. **Kein Store-Release.**

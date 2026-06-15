# MEGA Masterprompt v2 — Sprint 72 Report

**Datum:** 2026-06-14  
**Scope:** Employee Vollprofil Live-Migration Prep (department, start_date, notes)  
**Verdict:** Live-Mapping code-ready — **NOT production/store ready** (Migration 0033 remote pending)

---

## 1. Entscheidung

Sprint 72 bereitet **Office Employee Vollprofil Live-Mapping** vor: additive Migration 0033, Mapper + Repo `getDetailMapped`, ehrliches `isEmployeeDetailLiveReady()` — **kein Remote-Apply** in diesem Sprint.

---

## 2. Implementiert

| Artefakt | Änderung |
|----------|----------|
| `supabase/migrations/0033_employees_live_detail_fields.sql` | ADD IF NOT EXISTS department, start_date, notes + COMMENT |
| `src/lib/office/employeeDetailMapper.ts` | `mapEmployeeRowToDetail`, Schema-Guard |
| `src/lib/services/repositories/employeeRepository.supabase.ts` | `EMPLOYEE_DETAIL_SELECT_COLUMNS`, `getDetailMapped` |
| `src/lib/office/employeeDetailService.ts` | Live-Pfad nutzt Mapper statt null-Stub |
| `src/lib/office/employeeModuleConfig.ts` | `isEmployeeDetailLiveReady()` = Supabase && !Demo |
| `scripts/apply-live-migrations.mjs` | +0033 in Safe-Apply-Liste |
| `src/__tests__/office/employeesLiveDetail.test.ts` | +6 Live-Mapping-Tests |

**Hinweis:** Spalten existieren ggf. schon in 0005 — 0033 ist idempotent für Safe-Apply-Dokumentation.

---

## 3. Dry-Run / Remote-Apply (nicht ausgeführt)

```bash
# Checklist only — keine DB-Änderung
npm run apply:live-migrations

# Remote-Status prüfen
node scripts/apply-live-migrations.mjs --list --project-ref=<ref>

# Erst nach Review:
node scripts/apply-live-migrations.mjs --apply --confirm --project-ref=<ref>
```

Nach Apply: `npm run fetch-remote-types` + optional Backfill via `npm run seed:live-pilot -- --write-sql`.

---

## 4. Demo vs. Live

| Aspekt | Status |
|--------|--------|
| **Demo-Modus** | Demo-Vollprofil mit angereicherten Feldern |
| **Live-Modus** | Mapper liest department/start_date/notes; Schema-Fehler ehrlich |
| **preparedOnly-Badge** | Sichtbar im Demo; hidden wenn Live-Modus aktiv |
| **service_role** | ❌ Nicht im Frontend |

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **792** |
| `npm run smoke` | ✅ |
| `npm run platform:audit` | ✅ PASS |
| `npm run store:audit` | ✅ PASS |

---

## 6. Deferred to Sprint 73+

| Priorität | Item |
|-----------|------|
| P1 | Migration 0033 remote anwenden + Backfill HR-Felder |
| P1 | Edge Function deploy + Resend Secrets (Sprint 71) |
| P3 | EAS Preview Builds |
| P3 | Assist GPS Live-Tracking |

---

## 7. Verdict

Employee Vollprofil Live-Mapping ist **code-ready** — preparedOnly-Badge ehrlich im Demo. Remote Migration 0033 + Daten-Backfill erforderlich vor echtem Live-Vollprofil.

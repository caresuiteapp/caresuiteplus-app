# Assist Phase 3 — Persistence Schema Abschlussbericht

**Datum:** 2026-06-20  
**Projekt:** CareSuite+  
**HEAD:** `73cd7360cf533051c84b394d82a46b8e38c4b335`  
**Branch:** `main` (= `origin/main`)  
**Scope:** Migration 0156 vorbereitet · TypeScript-Stubs · Berichte · **kein** remote apply · **kein** Commit

---

## 1. Executive Summary

Assist Phase 3 bereitet die **vollständige Execution-Persistenz** vor: Signaturen, Leistungsnachweise, Tracking-Sessions, Standortpunkte, Zeit-Events, Geofence-Audit und Fahrtenbuch-Log. Migration **`0156_assist_execution_persistence.sql`** wurde im Repo erstellt; **nicht** per `supabase db push` angewendet.

TypeScript-DTOs und Service-Stubs sind implementiert; bestehende Session-basierte Flows bleiben aktiv mit dokumentierten GAP-Kommentaren bis Apply-Freigabe.

**Ergebnis:** ✅ **SUCCESS** (vorbereitet, nicht deployed)

---

## 2. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch | `main` ✅ |
| HEAD | `73cd7360cf533051c84b394d82a46b8e38c4b335` ✅ |
| Enthält Commit `73cd7360…` | ✅ (HEAD = Commit) |
| Sync `origin/main` | ✅ `main...origin/main` (0 ahead/behind nach fetch) |
| Staged files at start | ✅ **0** (`git diff --cached` leer) |
| `0154_sync_b1_permission_keys.sql` diff | ✅ leer |
| `0155_sync_legacy_role_permissions.sql` diff | ✅ leer |
| `staticRolePermissions.ts` diff | ✅ leer |
| Permissions-Matrix geändert | ✅ nein |

**Abort:** nicht ausgelöst — alle Gates grün.

---

## 3. Audit-Dokumente gelesen (Phase 2)

| Dokument | Relevante Erkenntnisse |
|----------|------------------------|
| `assist-schema-gap-report.md` | P0: `assist_visit_signatures`, `assist_visit_proofs`; Tracking: sessions/points/time events fehlen |
| `assist-abnahme-checklist-status.md` | F/G/H/I Blocker dokumentiert; B.1k (0155) applied |
| `assist-phase2-durchfuehrung-nachweis-abschlussbericht.md` | Session-Signatur, Preview ohne PDF; GPS MA-Portal only |
| `B1h-migration-0154-apply-abschlussbericht.md` | 0154 remote applied (separater Track) |
| `B1k-migration-0155-apply-abschlussbericht.md` | 0155 remote applied; Baseline 713 TC / 19 Vitest grün (subset) |
| `B1j/B1j1/B1i` Berichte | Role alignment abgeschlossen; Permissions tabu |

**P0-Gaps adressiert in 0156:** Signaturen, Proofs, Tracking-Sessions, Location Points, Time Events, Geofence Events, Driving Log.

---

## 4. Schema-Inventar-Matrix (Phase 3)

| Entität | Migration Ist | Code/Service | Phase-3 Soll (0156) |
|---------|---------------|--------------|---------------------|
| `assist_visits` | ✅ 0116 | visitRepository | FK-Parent |
| `assist_visit_tasks` | ✅ 0116 | visitExecutionService | — |
| `assist_visit_status_history` | ✅ 0116 | visitWorkflow | — |
| `assist_visit_signatures` | ❌ → **0156** | session store + stub | ✅ definiert |
| `assist_visit_proofs` | ❌ → **0156** | visitProofPreviewService + stub | ✅ definiert |
| `assist_proof_attachments` | ❌ → **0156** | — | ✅ optional (Storage-Pattern 0103) |
| `assist_tracking_sessions` | ❌ → **0156** | employeePortalVisitTrackingService | ✅ definiert |
| `assist_location_points` | ❌ → **0156** | foreground GPS | ✅ definiert |
| `assist_time_events` | ❌ → **0156** | computeEmployeePortalLiveTimers | ✅ definiert |
| `assist_geofence_events` | ❌ → **0156** | geofenceSoftCheck | ✅ definiert |
| `assist_driving_log` | ❌ → **0156** | tripLogService / trips 0114 | ✅ definiert |
| `assist_tracking_dashboard` | ✅ 0114 | trackingRepository | Snapshot bleibt |
| `trip_gps_events` | ✅ 0114 | gps prep | Trip-scoped (legacy) |
| `public.trips` | ✅ 0114 | tripRepository | FK in driving_log |

**FK-Entscheidung:** Visit-Bezug über **`assist_visits(id)`** (0116 bestätigt). Legacy `assignments` nur via `assist_visits.legacy_assignment_id` — keine direkte FK in 0156.

---

## 5. Referenz-Tabellen & Patterns (Phase 4)

| Referenz | Tabelle | Migration |
|----------|---------|-----------|
| Mandant | `public.tenants` | 0001 |
| Profile | `public.profiles` | 0001 |
| Klient | `public.clients` | 0001 |
| Mitarbeitende | `public.employees` | 0001 |
| Einsatz (SoT) | `public.assist_visits` | 0116 |
| Legacy Einsatz | `public.assignments` | früher |
| Fahrten | `public.trips` | 0114 |
| Dokumente/Storage | `storage_path` Pattern | 0103, 0061 |

**Patterns übernommen:**
- `tenant_id` auf allen Tabellen
- `set_updated_at()` Trigger (0001)
- RLS `is_tenant_member(tenant_id)` (0116/0114)
- `GRANT SELECT, INSERT` für append-only; `UPDATE` wo fachlich nötig
- Keine destruktiven Statements

---

## 6. Soll-Modell 0156 (Phase 5)

| Tabelle | Zweck | Besonderheiten |
|---------|-------|----------------|
| `assist_visit_signatures` | Audit-Signatur | `storage_path` + `payload_hash` + `signature_hash`; kein Base64 |
| `assist_visit_proofs` | Leistungsnachweis | Snapshot JSONB + optional PDF path |
| `assist_proof_attachments` | Anhänge | Storage-Metadaten (Pattern 0103) |
| `assist_tracking_sessions` | GPS-Session | Consent timestamps; `employee_portal` source |
| `assist_location_points` | Standortverlauf | Session-scoped; append-only |
| `assist_time_events` | Timer-Events | drive/service/pause/arrive |
| `assist_geofence_events` | Weicher Geofence | 50–250 m Toleranz; Override-Audit |
| `assist_driving_log` | Fahrtenbuch-Log | Optional FK `trips`, `assist_visits`, session |

---

## 7. Migration 0156 Details (Phase 6)

**Datei:** `supabase/migrations/0156_assist_execution_persistence.sql`

- 8 Tabellen (`CREATE TABLE IF NOT EXISTS`)
- CHECK constraints für Status/Enums/Koordinaten
- 18+ Indizes (`CREATE INDEX IF NOT EXISTS`)
- 4 `updated_at` Trigger
- 8 RLS Policies (`is_tenant_member`)
- Grants differenziert (append-only vs. updatable)
- **Kein** DROP/TRUNCATE/destructive DELETE
- **Kein** Storage-Bucket/Policy (separate Freigabe empfohlen)

---

## 8. TypeScript-Vorbereitung (Phase 7)

| Datei | Rolle |
|-------|-------|
| `src/types/assistExecutionPersistence.ts` | DTOs + Tabellen-Konstanten |
| `src/lib/assist/assistExecutionPersistenceService.ts` | Shared probe + signature read |
| `src/lib/assist/assistVisitSignaturePersistenceService.ts` | Signatur-Stubs + Hash-GAP |
| `src/lib/assist/assistVisitProofPersistenceService.ts` | Proof read + persist stub |
| `src/lib/assist/assistTrackingPersistenceService.ts` | Tracking/Geofence/Time stubs |

**Minimal aktualisiert (GAP-Kommentare):**
- `visitSignatureSessionStore.ts`
- `visitProofPreviewService.ts`
- `visitExecutionService.ts`
- `employeePortalVisitTrackingService.ts`
- `assistSetupHints.ts`
- `src/lib/assist/index.ts` (Exports)

**Nicht angefasst (tabu):** `staticRolePermissions.ts`, permissions matrix, `assignmentWorkflowService`, ProductAccess, 0154/0155.

---

## 9. Privacy / Portal-Regeln (Phase 8)

| Rolle | Signatur | GPS/Tracking | Nachweis | Geofence |
|-------|----------|--------------|----------|----------|
| **Mitarbeiterportal** | Erfassen + Upload (nach Apply) | **Einzige Quelle** — Consent Pflicht | Entwurf/Export initiieren | Soft check + Override |
| **Assist/Office** | Read-only Audit | Read-only Monitor | Review/Freigabe | Read-only Events |
| **Klientenportal** | Eingeschränkt | Kein Roh-GPS-Trail | Freigegebene Proofs only | — |

Implementiert in TypeScript-Header-Kommentaren + Service-Stubs; Storage-Policies **nicht** in 0156 (bewusst ausgelassen).

---

## 10. Typecheck & Tests (Phase 9)

| Metrik | Ergebnis | Log |
|--------|----------|-----|
| Typecheck gesamt | **713** Fehler (Baseline unverändert) | `.audit-typecheck-assist-phase3.log` |
| Phase-3-Dateien | **0 neue Fehler** | kein Treffer auf neue Pfade |
| Vitest (assist + auth + permissions) | 15 passed / 19 failed (34 files) | `.audit-test-assist-phase3.log` |

**Grün (relevant für Phase 3):**
- `geofenceSoftCheck.test.ts` (5/5)
- `visitDisposition.test.ts` (10/10)
- `assistLiveTrackingView.test.ts` (1/1)
- `tenantBootstrap.test.ts` (16/16)
- `permissions.test.ts` (3/3)

**Pre-existing Failures (nicht Phase-3-regression):**
- `assignmentCompletionChain.test.ts` (assignmentWorkflowService — tabu)
- RN-Parse in Hero-List-Tests
- `scheduleCalendar.test.ts`, `assignmentWorkflow.test.ts`

---

## 11. Migration 0156 Safety Review Matrix (Phase 10)

| Kriterium | 0156 |
|-----------|------|
| CREATE only (IF NOT EXISTS) | ✅ |
| DROP/TRUNCATE/destructive DELETE | ❌ nein |
| FK nur bestätigte Tabellen | ✅ tenants, assist_visits, profiles, employees, trips |
| tenant_id überall | ✅ |
| RLS aktiviert | ✅ 8 Tabellen |
| Policy-Pattern | ✅ `is_tenant_member` wie 0116 |
| updated_at Trigger | ✅ 4 mutable Tabellen |
| Backfill/DML | ❌ nein |
| Storage policies | ❌ bewusst ausgelassen |
| Remote apply | ❌ **nicht ausgeführt** |

---

## 12. Decision Matrix

| Entscheidung | Gewählt | Begründung |
|--------------|---------|------------|
| Visit-FK | `assist_visits` | 0116 = SoT; legacy via `legacy_assignment_id` |
| Signatur-Speicher | Storage path + hashes | Kein Base64 in DB; Abnahme F |
| GPS-Persistenz | Session-scoped tables | Privacy; Consent in session row |
| Geofence | Soft + audit table | Kein Hard-Block; Override-Grund |
| Fahrtenbuch | `assist_driving_log` + FK `trips` | Ergänzt 0114 ohne Ersetzen |
| Proof attachments | Enthalten | Storage-Pattern 0103/0061 klar |
| RLS in 0156 | Ja, Standard-Pattern | Konsistent mit 0116; keine Portal-spezifischen Policies yet |
| Remote apply | Nein | User constraint |

---

## 13. Geänderte / neue Dateien

| Pfad | Status |
|------|--------|
| `supabase/migrations/0156_assist_execution_persistence.sql` | **neu** |
| `src/types/assistExecutionPersistence.ts` | **neu** |
| `src/lib/assist/assistExecutionPersistenceService.ts` | **neu** |
| `src/lib/assist/assistVisitSignaturePersistenceService.ts` | **neu** |
| `src/lib/assist/assistVisitProofPersistenceService.ts` | **neu** |
| `src/lib/assist/assistTrackingPersistenceService.ts` | **neu** |
| `src/lib/assist/visitSignatureSessionStore.ts` | GAP-Kommentar |
| `src/lib/assist/visitProofPreviewService.ts` | GAP-Kommentar |
| `src/lib/assist/visitExecutionService.ts` | GAP-Kommentar |
| `src/lib/portal/employeePortalVisitTrackingService.ts` | GAP-Kommentar |
| `src/lib/assist/assistSetupHints.ts` | 0156-Hinweise |
| `src/lib/assist/index.ts` | Exports |
| `docs/audit/assist-abnahme-checklist-status.md` | B.1k + Phase 3 |
| `docs/audit/assist-phase3-persistence-schema-abschlussbericht.md` | dieser Bericht |
| `.audit-typecheck-assist-phase3.log` | Audit-Log |
| `.audit-test-assist-phase3.log` | Audit-Log |

**Unverändert:** 0154, 0155, `staticRolePermissions.ts`, permissions matrix.

---

## 14. Nicht ausgeführte Aktionen

- ❌ `supabase db push` / remote apply
- ❌ Git commit / push
- ❌ Storage-Bucket-Policies für Signatur/Nachweis-Pfade
- ❌ UI-Rewrite Durchführung/Signatur (nur Stubs)
- ❌ B.2 / B.3 / ProductAccess / assignmentWorkflowService

---

## 15. Commit-Readiness (Phase 13)

**Empfehlung:** Kein Commit in diesem Auftrag (User: prefer NO commit). Bei expliziter Freigabe:

### Commit-Kandidaten (exakte Pfade)

```
supabase/migrations/0156_assist_execution_persistence.sql
src/types/assistExecutionPersistence.ts
src/lib/assist/assistExecutionPersistenceService.ts
src/lib/assist/assistVisitSignaturePersistenceService.ts
src/lib/assist/assistVisitProofPersistenceService.ts
src/lib/assist/assistTrackingPersistenceService.ts
src/lib/assist/visitSignatureSessionStore.ts
src/lib/assist/visitProofPreviewService.ts
src/lib/assist/visitExecutionService.ts
src/lib/portal/employeePortalVisitTrackingService.ts
src/lib/assist/assistSetupHints.ts
src/lib/assist/index.ts
docs/audit/assist-abnahme-checklist-status.md
docs/audit/assist-phase3-persistence-schema-abschlussbericht.md
```

### 8 Commit-Bedingungen

| # | Bedingung | Status |
|---|-----------|--------|
| 1 | Branch main + HEAD OK | ✅ |
| 2 | 0154/0155 untouched | ✅ |
| 3 | Permissions untouched | ✅ |
| 4 | Typecheck keine neuen Fehler in Scope | ✅ |
| 5 | Relevante Tests grün | ✅ (subset) |
| 6 | Scope klar abgegrenzt | ✅ |
| 7 | Kein remote apply nötig für Commit | ✅ |
| 8 | User-Freigabe | ⏸ ausstehend |

**Vorgeschlagene Commit-Message (bei Freigabe):**

```
feat(assist): prepare migration 0156 execution persistence schema

Define signatures, proofs, tracking, geofence, and driving log tables
with TypeScript stubs. Not applied remotely — apply requires separate approval.
```

---

## Nächster empfohlener Schritt

1. **Freigabe** Migration 0156 Review (RLS + Storage-Pfad-Konvention)
2. **`supabase db push`** nur nach expliziter Deploy-Freigabe (nicht in Assist-Zwischenauftrag)
3. Storage-Policies für `tenant/{tenantId}/assist/visits/{visitId}/…`
4. Wire employee portal → `assistTrackingPersistenceService` persist paths
5. Signatur-Hash + Storage upload → `assistVisitSignaturePersistenceService`
6. Phase 4 UI: Nachweis-PDF persist nach Apply

---

*Assist Phase 3 Master — abgeschlossen ohne remote DB-Änderung.*

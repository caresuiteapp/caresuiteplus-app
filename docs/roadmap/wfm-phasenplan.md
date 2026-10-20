# CareSuite+ WFM — Phasenplan

**Stand:** 2026-06-28  
**Gesamtumfang:** ~8–12 Wochen MVP (Phase 1) + 4 Folgephasen  
**Hinweis:** Zeitschätzungen sind Äquivalent-Scope für ein kleines Team — keine Commitments.

---

## Übersicht

| Phase | Fokus | Dauer (eq.) | Abhängigkeiten |
|-------|-------|-------------|----------------|
| **1** | MVP: Zentrale Events, Stempeln, Portal, Office Live | 8–12 Wo. | Migration 0190 |
| **2** | Urlaub, Abwesenheiten, Genehmigungen | 6–8 Wo. | Phase 1 |
| **3** | Live-Karte, Geofencing, Assist-Vollsync | 6–8 Wo. | Phase 1 |
| **4** | Regelwerk, Benachrichtigungen, ArbZG | 8–10 Wo. | Phase 2 |
| **5** | Exporte DATEV/Personio/API | 6–8 Wo. | Phase 2, 4 |

---

## Phase 1 — MVP (Zentrale Zeiterfassung)

**Ziel:** Eine zentrale `workforce_time_events`-Tabelle, Basis Stempeln, Portal-Tab „Arbeitszeit“, Live-Status in Office.

### Datenbank / Migrationen

| Artefakt | Inhalt |
|----------|--------|
| `0190_wfm_foundation.sql` | Kern-Tabellen + RLS (Entwurf, nicht angewendet) |
| `0191_wfm_realtime_publication.sql` | Realtime auf `workforce_work_sessions` |
| `0192_wfm_assist_sync_trigger.sql` | Optional: DB-Trigger Assist → WFM (oder Edge-only) |

**Tabellen:** `workforce_time_events`, `workforce_work_sessions`, `workforce_audit_log` (minimal)

### Services (`src/lib/wfm/`)

| Service | Aufgabe |
|---------|---------|
| `wfmClockService.ts` | clockIn, clockOut, pauseStart, pauseEnd |
| `wfmSessionService.ts` | getOpenSession, listTeamSessionsToday |
| `wfmLiveStatusService.ts` | Aggregierte Live-Karten für Office |
| `wfmAssistAdapter.ts` | assist_time_events → workforce (read/sync) |

### UI / Screens

| Route | Komponente | Modul |
|-------|------------|-------|
| `/portal/employee/arbeitszeit` | Erweiterung `TimeTrackingEmployeeScreen` | Portal |
| `/business/office/time-tracking` | Team-Ansicht + Link Live | Office |
| `/office/live-mitarbeiter` (neu) | `OfficeLiveEmployeesScreen` | Office |
| Portal Header (neu) | `EmployeePortalLiveClockBar` | Portal |

### Tests

| Test | Datei |
|------|-------|
| Clock In/Out Unit | `src/__tests__/wfm/wfmClock.test.ts` |
| RLS Smoke | `src/__tests__/wfm/wfmRls.test.ts` |
| Assist-Adapter | `src/__tests__/wfm/wfmAssistAdapter.test.ts` |
| Portal E2E (optional) | `scripts/audit/wfmPhase1Browser.mjs` |

### Abnahme Phase 1

- [ ] Mitarbeiter kann im Portal ein-/ausstempeln; Event in `workforce_time_events`.
- [ ] Office sieht Live-Karte aller eingestempelten MA (<5 s Latenz).
- [ ] Assist-Einsatzstart spiegelt sich im WFM-Status „Im Einsatz“.
- [ ] Keine Regression Homeoffice-Modul (0161).

---

## Phase 2 — Urlaub / Abwesenheiten / Genehmigungen

**Ziel:** Vollständiger Abwesenheits-Workflow mit unified Approvals.

### Migrationen

| Migration | Inhalt |
|-----------|--------|
| `0193_wfm_absences.sql` | `workforce_absences`, Sync mit `employee_absences` |
| `0194_wfm_approvals.sql` | `workforce_approvals` |
| `0195_wfm_leave_balances.sql` | Urlaubsanspruch, Resturlaub |

### Services

- `wfmAbsenceService.ts` — CRUD + Kalender-Sync
- `wfmApprovalService.ts` — Antrag, Genehmigung, Ablehnung
- Erweiterung `absenceService.ts` — Delegation an WFM

### UI

| Route | Inhalt |
|-------|--------|
| `/portal/employee/arbeitszeit/urlaub` | Urlaubsübersicht + Antrag |
| `/portal/employee/arbeitszeit/abwesenheiten` | Krank, Fortbildung, … |
| `/office/approvals` | Genehmigungs-Posteingang |
| Personalakte Tab | Abwesenheiten verlinken |

### Tests

- `employeeAbsence.test.ts` erweitern
- `wfmApproval.test.ts` neu
- Kalender-Sync Regression

---

## Phase 3 — Live-Karte & Geofencing

**Ziel:** Office-Live-Karte, vollständige Assist-GPS/Geofence-Integration.

### Migrationen

| Migration | Inhalt |
|-----------|--------|
| `0196_wfm_locations.sql` | `workforce_locations`, Geofence-Metadaten |
| `0197_wfm_location_pings.sql` | Optional: zentralisierte GPS-Pings (Retention) |

### Services

- `wfmMapService.ts` — Marker, Cluster, Verspätung
- Vollsync `assist_location_points` / `assist_geofence_events`
- Erweiterung `assistLiveTrackingViewService.ts`

### UI

| Route | Inhalt |
|-------|--------|
| `/office/live-karte` | Karten-View (Mapbox/Google) |
| Assist Live-Status | Unified WFM-Statusfarben |

### Tests

- Geofence-Override Flow (Portal)
- Map-Marker bei ≥10 gleichzeitigen MA
- GPS-Consent / DSGVO-Checks

---

## Phase 4 — Regelwerk & Benachrichtigungen

**Ziel:** ArbZG-Regeln, automatische Warnungen, GF-Dashboard-KPIs.

### Migrationen

| Migration | Inhalt |
|-----------|--------|
| `0198_wfm_rules.sql` | `workforce_rule_definitions`, `workforce_rule_violations` |
| `0199_wfm_time_accounts.sql` | `workforce_time_accounts` vollständig |
| `0200_wfm_tenant_rules_seed.sql` | DE-Feiertage, Standard-Pausen |

### Edge Functions

- `wfm-rules-evaluate` — Cron + on-event
- `wfm-aggregate-accounts` — Nacht-Job

### UI

| Route | Inhalt |
|-------|--------|
| `/office/time-tracking/accounts` | Zeitkonten-Verwaltung |
| `/business/office/wfm-dashboard` | GF-KPIs |
| `/office/settings/wfm-rules` | Regel-Konfiguration |

### Benachrichtigungen

- Integration `office_notifications` + Expo Push
- Regeln: Pause vergessen, Max-Arbeitszeit, Ruhezeit

### Tests

- Regel-Engine Unit (Pausenpflicht 6h/9h)
- Notification-Deduplizierung
- Monatsabschluss-Sperre

---

## Phase 5 — Exporte & Integrationen

**Ziel:** DATEV, Personio, Lexware, API.

### Migrationen

| Migration | Inhalt |
|-----------|--------|
| `0201_wfm_export_jobs.sql` | Export-Aufträge, Audit |
| `0202_wfm_export_mappings.sql` | Feld-Mappings pro Zielsystem |

### Edge Functions

- `wfm-export` — CSV, Excel, DATEV LODAS-Stub
- Webhook-API für Personio

### UI

| Route | Inhalt |
|-------|--------|
| `/office/time-tracking/export` | Export-Wizard |
| Integrations-Hub | DATEV/Personio-Kacheln |

### Tests

- Export-Checksum
- Mapping-Fixtures DATEV
- API-Auth (Service Role)

---

## Empfohlener Phase-1-Start (konkret)

Priorisierte ersten 2–3 Sprints:

1. **Migration 0190 reviewen & anwenden** (nach Freigabe) auf Staging `euagyyztvmemuaiumvxm`
2. **`src/lib/wfm/wfmClockService.ts`** — Portal Stempeln auf zentrale DB
3. **`OfficeLiveEmployeesScreen`** — read-only Team-Übersicht aus `workforce_work_sessions`
4. **`wfmAssistAdapter`** — bei Visit-Status `gestartet`/`beendet` Events spiegeln
5. **Realtime-Preset** `subscribeToWfmLiveChanges` in `presets.ts`
6. **Portal Live-Uhr** (Minimal: heutige Istzeit + Status-Badge)
7. **Tests + Browser-Audit-Skript**

### Nicht in Phase 1

- Büro QR/NFC
- DATEV-Export
- Vollständiges Regelwerk
- Live-Karte (→ Phase 3)
- Urlaubsanträge UI (→ Phase 2) — Schema vorbereiten reicht

---

## Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| Doppelte Zeiterfassung während Migration | Dual-Write + Feature-Flag `WFM_CENTRAL_ENABLED` |
| Schema-Drift Remote vs. Repo | Migration-Checkliste wie B1h-Prozess |
| GPS/DSGVO | Separate Retention-Policy, keine Rohdaten in Events |
| Performance Realtime | Nur `work_sessions` publizieren, Events paginiert laden |

---

## Referenzen

- Spezifikation: `docs/spec/wfm-workforce-management-spezifikation.md`
- Architektur: `docs/spec/wfm-architektur-zentral.md`
- Ist-Abgleich: `docs/audit/wfm-ist-abgleich.md`

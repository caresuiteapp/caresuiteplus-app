# Assist Phase 2 — Durchführung, Nachweis, Abschlussbericht

**Datum:** 2026-06-20  
**HEAD (Pre-Check):** `ad0474b4b34bb0720a513bbbea2c6ecf9a0832b2` · Branch `main`  
**Scope:** Assist-only · Keine Migration · Keine Permissions · Kein Commit/Push

---

## 1. Executive Summary

Assist Phase 2 stabilisiert den **täglichen Durchführungs-Workflow** (Status A–H), **Aufgaben/Dokumentation**, **Session-Signatur**, **Leistungsnachweis-Vorschau**, **Dashboard-KPIs** und **Setup-Hinweise** — alles ohne Schema-Migration.

**Usable today (Demo + Supabase 0116):**
- Dashboard auf `ScreenShell` mit 8 KPIs inkl. fehlende Signaturen, offene Nachweise, offene Fahrten
- Einsatzdetail mit Statuswechseln (validiert, loading, refresh)
- Neuer `VisitExecutionScreen` mit Workflow geplant→…→abgeschlossen
- Aufgaben: erledigt / nicht erledigt / nicht gewünscht / offen + Pflicht-Begründung
- Dokumentation in `employee_notes` (0116)
- Signatur via `CareSignatureModal` (Session-Speicher)
- Leistungsnachweis-Vorschau mit Pflichtfeld-Matrix

**Remaining P0 schema gaps (documented, not fixed):**
- `assist_visit_signatures`, `assist_visit_proofs` — keine Persistenz/Audit-Hash
- Touren (`assist_routes`), Live-Status-Persistenz, Settings-Tabelle

**Pre-Check:** ✅ PASS (main, HEAD ad0474b, keine staged files, 0154 untouched, permissions untouched)

---

## 2. Geänderte Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/types/modules/assist.ts` | `AssistDashboardStats`: +openSignatureCount, +openTripsCount |
| `src/lib/assist/assistDashboardStats.ts` | KPIs Signatur + Fahrten |
| `src/lib/assist/assignmentListService.ts` | Stats-Berechnung + Trip-Count |
| `src/lib/assist/assistSetupHints.ts` | Setup-Hinweise (Schema/Config) |
| `src/lib/assist/visitSignatureSessionStore.ts` | Session-Signatur (Gap dokumentiert) |
| `src/lib/assist/visitProofPreviewService.ts` | Leistungsnachweis-Vorschau |
| `src/lib/assist/visitExecutionService.ts` | Tasks, Doku, Close-Validation |
| `src/lib/assist/visitTypes.ts` | +employeeNotes |
| `src/lib/assist/repositories/visitRepository.supabase.ts` | updateTask, updateDocumentation, employee_notes |
| `src/lib/assist/visitService.ts` | employeeNotes in Detail-Mapping |
| `src/lib/assist/index.ts` | Exports Phase-2-Services |
| `src/components/assist/AssistSetupHintsBanner.tsx` | Dashboard-Banner |
| `src/components/assist/VisitTasksPanel.tsx` | Interaktive Aufgaben |
| `src/components/assist/VisitSignatureSection.tsx` | Signaturfeld (CareSignatureModal) |
| `src/components/assist/VisitProofPreviewPanel.tsx` | Nachweis-Vorschau UI |
| `src/components/assist/AssignmentDetailTabsPanel.tsx` | Tasks/Proof-Tabs wired |
| `src/components/assist/index.ts` | Exports |
| `src/screens/assist/VisitExecutionScreen.tsx` | Neuer Durchführungs-Screen |
| `src/screens/assist/AssistIndexScreen.tsx` | Setup-Hints + KPIs |
| `src/screens/assist/index.ts` | Export VisitExecutionScreen |
| `app/assist/assignments/[id]/execute.tsx` | Route → VisitExecutionScreen |
| `src/__tests__/assist/assistDashboardHero.test.ts` | KPI-Count 8 |
| `docs/audit/assist-schema-gap-report.md` | Anhang Phase 2 |
| `docs/audit/assist-phase2-durchfuehrung-nachweis-abschlussbericht.md` | Dieser Bericht |

---

## 3. Inventory-Matrix (12 Bereiche)

| Bereich | Ist-Stand Phase 2 | Datenquelle | Gap |
|---------|-------------------|-------------|-----|
| **Einsatzliste** | ✅ AssignmentsListView, EinsaetzeList | assist_visits 0116 / Demo | Legacy-Fallback assignments |
| **Einsatzdetails** | ✅ AssignmentDetailScreen + Tabs | visitSupabaseRepository | Budget-Snapshots fehlen |
| **Statuswechsel** | ✅ visitWorkflow + updateAssignmentStatus | canonical_status 0116 | Demo-Pfad teils vereinfacht |
| **Aufgabenliste** | ✅ VisitTasksPanel | assist_visit_tasks 0116 | Legacy assignment_tasks |
| **Dokumentation** | ✅ employee_notes + validation | assist_visits 0116 | Keine assist_visit_documentations |
| **Signatur** | 🟡 Session + CareSignatureModal | Session-Store | **P0 assist_visit_signatures** |
| **Leistungsnachweis** | 🟡 Vorschau-Panel | buildVisitProofPreview | **P0 assist_visit_proofs / PDF** |
| **Fahrtenbuch** | 🟡 TripsListScreen + KPI | trips 0114 | Schema abweichend vs. Soll |
| **Live-Tracking** | 🟡 Live-Status UI | assist_tracking_dashboard 0114 | assist_live_status fehlt |
| **Ablage/Akte** | 🟡 Office-Links | clients/employees | Snapshots Kostenträger/Vertrag |
| **Portal** | 🟡 portal-preview, portal/assist | 0102 Workflows | assist_portal_events fehlt |
| **Abrechnungsbezug** | 🟡 Budget-Vorschau Tab | budget_amount_cents | Billing-Snapshots / Vertrag |

---

## 4. Soll-Ist Workflow-Matrix (Schritte A–H)

| Schritt | Soll | Ist Phase 2 | Persistenz |
|---------|------|-------------|------------|
| **A Planung** | Einsatz geplant | geplant/bestaetigt, Wizard | ✅ 0116 |
| **B Unterwegs** | MA unterwegs | PRIMARY_NEXT → unterwegs, on_the_way_at | ✅ 0116 |
| **C Ankunft** | Angekommen | → angekommen, arrived_at | ✅ 0116 |
| **D Start** | Einsatz gestartet | → gestartet, actual_start_at | ✅ 0116 |
| **E Aufgaben/Doku** | Tasks + Freitext | VisitTasksPanel + employee_notes | ✅ Tasks/Doku 0116 |
| **F Beenden** | Einsatz beendet | → beendet, actual_end_at | ✅ 0116 |
| **G Signatur** | Payload-Hash | CareSignatureModal + Session | ❌ P0 Tabelle |
| **H Nachweis/Abschluss** | PDF + verified | Vorschau + validateVisitCloseReadiness | ❌ P0 proofs |

**Statusmaschine:** `assignmentStatusMachine.ALLOWED_TRANSITIONS` — Buttons nur erlaubte Übergänge, `actionLoading` verhindert Doppel-Submit.

---

## 5. Signatur-Matrix

| Anforderung | Status | Implementierung |
|-------------|--------|-----------------|
| Zeichnen (Touch/Maus) | ✅ | CareSignatureCanvas via CareSignatureModal |
| Leer blockiert | ✅ | Modal bestätigt nur mit dataUrl |
| Klarname + Rolle | ✅ | VisitSignatureSection Inputs |
| Zeitstempel | ✅ | signedAt ISO |
| Visit-ID | ✅ | Anzeige + Store-Key |
| Löschen / Neu | ✅ | clearVisitSignature |
| Payload-Hash | ❌ | Schema-Gap — kein SHA-256 Store |
| DB-Persistenz | ❌ | assist_visit_signatures fehlt |
| Invalidierung bei Änderung | ❌ | Folge-Migration |

---

## 6. Leistungsnachweis-Matrix

| Feld | Vorschau | Persistenz |
|------|----------|------------|
| Klient:in | ✅ | Office-Join / Snapshot-Gap |
| Mitarbeitende:r | ✅ | Office-Join |
| Leistung/Termin/Ort | ✅ | assist_visits |
| Dokumentation | ✅ | employee_notes |
| Aufgaben-Status | ✅ | assist_visit_tasks |
| Unterschrift | 🟡 Session | ❌ proofs table |
| PDF-Export | 🟡 CareRecord-Pfad separat | ❌ |
| Abrechnungsfreigabe | ❌ | billing snapshots |

`VisitProofPreviewPanel` zeigt `readyForExport` nur wenn alle Pflichtfelder gesetzt.

---

## 7. Fahrtenbuch / Live-Tracking

| Feature | Ist | Gap |
|---------|-----|-----|
| Fahrtenliste | TripsListScreen, tripLogService | 0114 `trips` vs. Soll assist_trips |
| Offene Fahrten KPI | openTripsCount aus fetchTripLogList | — |
| Fahrt beenden | completeTrip | Korrektur-Grund teilweise |
| Live-Status UI | live-status, liveMonitorService | assist_live_status fehlt |
| GPS 30-Min-Regel | gpsTrackingConfig | Nicht überall enforced |
| Tracking-Punkte | Dashboard-Snapshot | assist_tracking_points fehlt |

---

## 8. Typecheck & Tests

| Metrik | Ergebnis |
|--------|----------|
| **Gesamt Typecheck** | 715 Fehler (Repo-Baseline, unverändert außerhalb Scope) |
| **Geänderte Assist-Dateien** | **0 neue Fehler** (tsc-Filter auf Phase-2-Pfade leer) |
| **assistDashboardHero.test.ts** | Aktualisiert (8 KPIs) — Vitest RN-Parse bekanntes Env-Problem |
| **assignmentCompletionChain.test.ts** | Pre-existing Fail (assignmentWorkflowService, tabu) |
| **Log** | `.audit-typecheck-assist-phase2.log` |

---

## 9. Unberührte / Tabu-Bereiche

| Bereich | Status |
|---------|--------|
| Migration 0154 | ✅ Unverändert |
| `src/lib/permissions/**` | ✅ Unverändert |
| RLS / supabase db push | ✅ Nicht ausgeführt |
| B.2 ProductAccess | ✅ Nicht angefasst |
| assignmentWorkflowService | ✅ Nicht angefasst |
| Global Calendar/Messages/Design | ✅ Nicht angefasst |
| Git commit/push | ✅ Nicht ausgeführt |

---

## 10. Nächste Schritte (separate Freigabe)

1. **Migration P0:** `assist_visit_signatures` + `assist_visit_proofs` (+ Storage)
2. **Signatur-Hash:** Payload canonical JSON → SHA-256 → DB
3. **PDF-Pipeline:** Nachweis aus VisitProofPreview → Storage + audit
4. **P1:** assist_routes, assist_visit_documentations, assist_live_status
5. **B.1h:** Migration 0154 anwenden (Permissions) — erst nach Abnahme
6. **Office-Snapshots:** Pflegegrad/Kostenträger/Vertrag in Assist-Listen

---

## Scope-Liste (Phase 2)

**Gelesen:** assistnav, visitRepository, visitService, visitWorkflow, AssignmentDetailTabsPanel, CareSignatureModal, tripLogService, assistModuleConfig, Abnahme-Checkliste, Schema-Gap-Bericht.

**Erlaubt geändert:** `app/assist/**`, `src/screens/assist/**`, `src/modules/assist/**`, `src/lib/assist/**`, `src/components/assist/**`, `src/types/modules/assist.ts`, targeted `src/__tests__/assist/**`.

**Tabu:** permissions, 0154, RLS, assignmentWorkflowService, ProductAccess, global design/shell, git operations.

---

## 11. GPS, Live-Tracking, Geofencing und Live-Zeiterfassung (Nachtrag 2026-06-20)

### Umgesetzt (ohne Migration)

| Bereich | Dateien | Verhalten |
|---------|---------|-----------|
| MA-Portal Durchführung | `EmployeePortalVisitExecutionScreen`, `useEmployeePortalVisitExecution` | Consent → Anfahrt → Ankunft → Einsatz; nur MA-Portal |
| Tracking-Service | `employeePortalVisitTrackingService.ts` | Session-Consent, Foreground-GPS, Timer, Auto-Stop |
| Geofence weich | `geofenceSoftCheck.ts` | 50–250 m, Warnung, Override-Grund |
| Assist Live-Status | `AssistLiveStatusScreen`, `assistLiveTrackingViewService.ts` | Tagesmonitor + Tracking-Snapshot, **read-only** |
| Setup-Hinweise | `assistSetupHints.ts` | GPS/Geofence/Klientenportal-Gaps |
| Route MA-Portal | `appointmentService` executionRoute → `/portal/employee/.../execute` | Kein Assist-Start mehr |

### Schema-Gaps (unverändert)

- `assist_live_status`, `assist_tracking_points`, `assist_time_events`
- Geocoding Zielkoordinaten für Geofence
- Klientenportal Live-Ansicht (`assist_portal_events`)
- Native Background-GPS

### Tests

- `src/__tests__/assist/geofenceSoftCheck.test.ts`
- `src/__tests__/assist/assistLiveTrackingView.test.ts`

### Typecheck

- Log: `.audit-typecheck-assist-gps-nachtrag.log`

# Assist Schema-Gap-Bericht

**Datum:** 2026-06-20  
**Referenz-Sollmodell:** `03_SCHEMA_SOLLMODELL_ASSIST_NUR_PLANUNG.md`  
**Keine Migration in diesem Auftrag erstellt.**

---

## Zusammenfassung

Migration **0116** (`assist_visits` + Tasks/History/Audit) und **0114** (`trips`, `assist_tracking_dashboard`) decken den Kern der Einsatz-Disposition und des Fahrtenbuchs ab. Das Sollmodell (19 Tabellen) ist zu ~40 % durch bestehende Migrationen abgedeckt; kritische Lücken betreffen Signaturen, Leistungsnachweise, Touren, Qualität, Einstellungen und Live-Status-Persistenz.

---

## Ist vs. Soll — Tabellenmatrix

| Soll-Tabelle | Ist-Status | Bestehende Alternative | Risiko | UI-Blocker | Priorität |
|--------------|------------|------------------------|--------|------------|-----------|
| `assist_assignments` | **fehlt** | `assignments` (legacy) + `assist_visits.client_id/employee_id` | mittel | Klient-Zuordnung über Office | P2 |
| `assist_visits` | **vorhanden** (0116) | — | — | `AssistDataSourceBanner` bei fehlender Tabelle | — |
| `assist_visit_series` | **fehlt** | manuelle Wiederholung nicht persistent | hoch | Serien-Dialog blockiert (Folgeauftrag) | P1 |
| `assist_visit_status_logs` | **teilweise** | `assist_visit_status_history` (0116) | niedrig | Statuswechsel historisiert in 0116 | P3 |
| `assist_task_templates` | **vorhanden** (0069) | — | — | — | — |
| `assist_task_packages` | **vorhanden** (0069) | — | — | — | — |
| `assist_visit_tasks` | **vorhanden** (0116) | — | — | — | — |
| `assist_visit_documentations` | **fehlt** | `internal_notes`/`employee_notes` in `assist_visits` | hoch | Doku nur als Notizfeld | P1 |
| `assist_visit_signatures` | **fehlt** | UI-Signaturkomponente ohne Payload-Hash-Store | **kritisch** | Signatur speichern blockieren | P0 |
| `assist_visit_proofs` | **fehlt** | `proof_status` Dimension in `assist_visits` | **kritisch** | Nachweis-PDF nicht persistent | P0 |
| `assist_live_status` | **fehlt** | `assist_tracking_dashboard` Snapshot (0114) | mittel | Live-Status teilweise Dashboard-only | P1 |
| `assist_tracking_points` | **fehlt** | GPS-Events prep (0034) | mittel | Kein Verlauf | P2 |
| `assist_routes` | **fehlt** | — | hoch | Tourenplanung UI ohne Persistenz | P1 |
| `assist_route_items` | **fehlt** | — | hoch | Tour-Reihenfolge nicht speicherbar | P1 |
| `assist_trips` (Soll) | **abweichend** | `public.trips` (0114) — vereinfachtes Schema | niedrig | Live Fahrtenbuch nutzbar | P3 |
| `assist_quality_cases` | **fehlt** | In-Memory `qmCockpitStore` | mittel | Qualität-Screen Setup-Hinweis | P2 |
| `assist_quality_actions` | **fehlt** | — | mittel | Maßnahmen nicht persistent | P2 |
| `assist_module_settings` | **fehlt** | Defaults in UI | mittel | Einstellungen nicht speicherbar | P2 |
| `assist_portal_events` | **fehlt** | Portal-Workflows (0102) teilweise | niedrig | Portalereignisse nicht auditierbar | P3 |

---

## Spalten-Gaps in `assist_visits` (0116 vs. Soll)

| Soll-Feld | 0116 | Gap |
|-----------|------|-----|
| `series_id` | fehlt | Serienverknüpfung |
| `assignment_id` | fehlt | dedizierte Assist-Zuordnung |
| `route_id` | fehlt | Tour-Verknüpfung |
| `calendar_event_id` | fehlt | explizite Kalender-ID (Sync über Service) |
| `client_snapshot` / `employee_snapshot` | fehlt | nur Live-Joins |
| `cost_carrier_snapshot` / `contract_snapshot` | fehlt | Abrechnungsblocker |
| `not_met_protocol_id` | fehlt | Nicht-angetroffen-Workflow |
| `problem_flags` | teilweise | `is_at_risk`, `error_code` |
| `deleted_at` | fehlt | Soft-Delete |

---

## Migrationen-Referenz (Assist-relevant)

| Migration | Inhalt |
|-----------|--------|
| 0030 | `assist_tracking_dashboard` |
| 0053 | Assist Service Catalog |
| 0069 | Task Templates/Packages |
| 0114 | `trips`, Tracking Dashboard Live |
| 0116 | `assist_visits`, Tasks, Status History, Audit |
| 0118 | Calendar backfill |
| 0102 | Portal Assist Workflows |

**0154:** Permission-Keys — **nicht angewendet**, **nicht verändert** in diesem Auftrag.

---

## Empfohlene spätere Migrationen (Reihenfolge)

1. **P0:** `assist_visit_signatures`, `assist_visit_proofs` (+ Storage-Pfade)
2. **P1:** `assist_visit_series`, `assist_routes` + `assist_route_items`, `assist_visit_documentations`
3. **P1:** `assist_live_status` (oder Erweiterung `assist_tracking_dashboard`)
4. **P2:** `assist_quality_cases`, `assist_module_settings`, `assist_assignments`
5. **P3:** `assist_portal_events`, `assist_tracking_points`, Spalten-Ergänzungen `assist_visits`

---

## UI-Blocker eingebaut (dieser Auftrag)

| Blocker | Komponente | Bedingung |
|---------|------------|-----------|
| Visit-Repo nicht erreichbar | `AssistDataSourceBanner` | `getServiceMode() === 'supabase'` + Probe `visitSupabaseRepository.list` fehlgeschlagen |
| Supabase nicht konfiguriert | `AssistDataSourceBanner` | Modus supabase ohne `isSupabaseConfigured()` |

Kein stilles Demo-Fallback für fachkritisches Speichern im Supabase-Modus.

---

## Sollmodell §1 — Grundregeln (Audit gegen Ist)

| Grundregel | Ist (0116 / Assist-Migrationen) | Gap |
|------------|----------------------------------|-----|
| `id`, `tenant_id`, `created_at`, `updated_at` | ✅ in `assist_visits`, Tasks, History | — |
| `created_by`, `updated_by` | 🟡 `created_by`/`updated_by` nur teilweise in 0116 | Audit-Felder nicht überall |
| `deleted_at` / soft delete | ❌ fehlt in `assist_visits` | Hard-only |
| Tenant-RLS | ✅ Pattern 0116 (`is_tenant_member`) | — |
| Audit bei Statuswechsel | 🟡 `assist_visit_status_history` + `assist_visit_audit_logs` | Kein separates immutable Log wie Soll §2.4 |
| Audit Signatur/Nachweis/Fahrt/Tour/Qualität | ❌ Tabellen fehlen | P0–P2 |

---

## Sollmodell §2 — Vollständige Tabellenübersicht (19 Entitäten)

Quelle: `03_SCHEMA_SOLLMODELL_ASSIST_NUR_PLANUNG.md` — **nur Planung, keine Migration in diesem Schritt.**

| § | Soll-Tabelle | Zweck (Kurz) | Ist | Abdeckung |
|---|--------------|--------------|-----|-----------|
| 2.1 | `assist_assignments` | Klient ↔ Assist-Zuständigkeit | ❌ | Legacy `assignments` / Visit-FKs |
| 2.2 | `assist_visits` | Einsatz | ✅ 0116 | ~65 % Felder (multi-status statt single `status`) |
| 2.3 | `assist_visit_series` | Serien | ❌ | — |
| 2.4 | `assist_visit_status_logs` | Immutable Statuslog | 🟡 | `assist_visit_status_history` (dimension-basiert) |
| 2.5 | `assist_task_templates` | Aufgabenbibliothek | ✅ 0069 | — |
| 2.6 | `assist_task_packages` | Aufgabenpakete | ✅ 0069 | — |
| 2.7 | `assist_visit_tasks` | Einsatzaufgaben | ✅ 0116 | Status-Enum teilweise |
| 2.8 | `assist_visit_documentations` | Durchführungstext | ❌ | Notizfelder in `assist_visits` |
| 2.9 | `assist_visit_signatures` | Payload-Hash-Signatur | ❌ | **P0 Abnahme F** |
| 2.10 | `assist_visit_proofs` | Leistungsnachweis | ❌ | `proof_status` Dimension only — **P0 Abnahme G** |
| 2.11 | `assist_live_status` | Live je Einsatz/MA | ❌ | `assist_tracking_dashboard` Snapshot |
| 2.12 | `assist_tracking_points` | Standortverlauf | ❌ | GPS prep 0034 |
| 2.13 | `assist_routes` | Touren | ❌ | UI ohne Persistenz — **Abnahme I** |
| 2.14 | `assist_route_items` | Tour-Einsätze | ❌ | — |
| 2.15 | `assist_trips` | Fahrtenbuch | 🟡 | `public.trips` 0114 (Schema abweichend) |
| 2.16 | `assist_quality_cases` | QM-Fälle | ❌ | In-Memory QM Store |
| 2.17 | `assist_quality_actions` | QM-Maßnahmen | ❌ | — |
| 2.18 | `assist_module_settings` | Mandanten-Settings | ❌ | UI-Defaults — **Abnahme §19** |
| 2.19 | `assist_portal_events` | Portal-Audit | ❌ | 0102 Workflows teilweise |

**Zählung:** ✅ voll/teil **6/19** · 🟡 abweichend **3/19** · ❌ fehlend **10/19**

---

## Soll §2.18 — Settings-Keys (UI vs. DB)

Folgende Settings aus dem Sollmodell haben **keine** persistente `assist_module_settings`-Tabelle; im Zwischenauftrag nur UI-Defaults / Blocker-Hinweise erlaubt:

- Signatur/Dokumentation/Nachweis-Defaults
- Tracking-Fenster (30 Min vor/nach)
- Nicht-angetroffen-Mindestwartezeit
- Abrechnungs-Blocker bei fehlender Signatur/Kostenträger/Vertrag
- GPS-Pflicht Unterwegs/Ankunft
- Fahrten-Freigabe / manuelle Korrektur

**Empfehlung Folge-Migration:** `assist_module_settings` (JSONB oder key-value pro Mandant) — **separate Freigabe**, nicht B.1h.

---

## Bezug Abnahme-Checkliste

| Abnahme-Abschnitt | Schema-Gap |
|-------------------|------------|
| F Signatur | §2.9 fehlt |
| G Leistungsnachweis | §2.10 fehlt |
| E Durchführung / nicht angetroffen | §2.8, `not_met_protocol_id` |
| H Live-Status | §2.11, §2.12 |
| I Fahrtenbuch | §2.15 (`trips` vs. Soll) |
| J Portale | §2.19 |

Vollständiger Abnahme-Status: `docs/audit/assist-abnahme-checklist-status.md`

---

## Phase 2 Ergänzungen (2026-06-20)

### UI ohne Migration umgesetzt

| Feature | Implementierung | Persistenz |
|---------|-----------------|------------|
| Durchführungs-Screen | `VisitExecutionScreen` | Status → assist_visits 0116 |
| Aufgaben-Status | `VisitTasksPanel` + `visitExecutionService` | assist_visit_tasks 0116 |
| Dokumentation | `employee_notes` via `updateDocumentation` | assist_visits 0116 |
| Signatur | `VisitSignatureSection` + `visitSignatureSessionStore` | **Nur Session** — P0 Gap |
| Nachweis-Vorschau | `visitProofPreviewService` | **Kein PDF-Archiv** — P0 Gap |
| Dashboard KPIs | openSignatureCount, openTripsCount | Listen-Aggregation |
| Setup-Hinweise | `assistSetupHints` + Banner | rein informativ |

### Weiterhin offen (unverändert P0)

- `assist_visit_signatures` — Hash, Invalidierung, Audit
- `assist_visit_proofs` — PDF, Freigabe, Abrechnungskette
- `assist_visit_documentations` — dedizierte Doku-Entität (Workaround: employee_notes)

Bericht: `docs/audit/assist-phase2-durchfuehrung-nachweis-abschlussbericht.md`

---

## GPS, Live-Tracking, Geofencing und Live-Zeiterfassung (2026-06-20)

### Datenmodell — Ist-Check (keine Migration)

| Entität / Feld | Migration / Service | Status | Gap |
|----------------|---------------------|--------|-----|
| Tracking-Sessions | — | ❌ | Keine `assist_tracking_sessions`; Session-Store im Mitarbeiterportal |
| Standortpunkte (Verlauf) | `trip_gps_events` prep 0034 | 🟡 | Nicht an Visit gebunden; `assist_tracking_points` fehlt |
| Zeit-Events (Fahrt/Einsatz/Pause) | — | ❌ | Timer aus Status-Historie + Pause-Events rekonstruiert |
| Geofence-Events | `assist_tracking_dashboard` 0114 | 🟡 | Snapshot-only; kein Visit-Ankunft-Event in DB |
| Fahrtenbuch-Felder | `public.trips` 0114 | 🟡 | Live Fahrtenbuch; GPS-Streaming blockiert (`isGpsTrackingLiveReady`) |
| Live-Status je Einsatz | — | ❌ | `assist_live_status` fehlt |
| Zielkoordinaten Einsatz | `assist_visits.location_*` | ❌ | Nur Adress-Text; Geocoding-Gap für Geofence |

### UI / Flow (ohne Migration)

| Bereich | Implementierung | Initiator |
|---------|-----------------|-----------|
| Mitarbeiterportal Durchführung | `EmployeePortalVisitExecutionScreen`, `employeePortalVisitTrackingService` | **Mitarbeiterportal only** |
| Einwilligung / Consent | `EmployeePortalLocationConsentBanner` | Mitarbeiter:in vor erstem GPS |
| Foreground-GPS | `captureEmployeePortalForegroundPosition` (expo-location) | Mitarbeiterportal; kein Fake-GPS |
| Live-Timer | `computeEmployeePortalLiveTimers` (Status + Pause-Events) | Sessionbasiert |
| Geofence weich | `geofenceSoftCheck.ts` (50–250 m, Override) | Clientseitig bei Ankunft |
| Assist Live-Status | `AssistLiveStatusScreen` + `assistLiveTrackingViewService` | **Nur Anzeige** — kein Tracking-Start |
| Klientenportal | `clientPortalVisible: false` in Snapshot | Gap: dedizierte UI + `assist_portal_events` |
| Native Background-GPS | — | **Nicht implementiert** — Web/PWA Foreground dokumentiert |

### Privacy / Architektur

- Tracking startet **nur** im Mitarbeiterportal (Anfahrt-Button nach Consent).
- Assist/Office: Read-only Tagesmonitor mit Timer/GPS-Status-Warnungen.
- Auto-Stop bei `beendet` / `abgeschlossen` / `storniert`.
- Keine Dauerüberwachung; Backend-Streaming weiterhin an `isGpsTrackingLiveReady()` gebunden.

### Empfohlene Folge-Migration (separate Freigabe)

1. `assist_live_status` + `assist_tracking_points` (Visit-scoped)
2. `assist_time_events` oder Erweiterung `assist_visit_status_history`
3. Geocoding-Zielkoordinaten in `assist_visits` oder Snapshot
4. `assist_portal_events` für Klientenportal-Freigabefenster


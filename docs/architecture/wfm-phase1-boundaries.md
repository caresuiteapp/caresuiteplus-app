# WFM Phase 1 — Architektur-Grenzen und Stabilisierung

Stand: Phase 1 (Stabilisierung ohne Schema-Migration)

## Zielbild Phase 1

- **WFM (`src/lib/wfm/`)** ist die fachliche Single Source of Truth (SSOT) für Zeiterfassung, Team-Übersicht und Abwesenheiten im Workforce-Kontext.
- **Office → Arbeitszeit** nutzt eine stabile Tab-Shell mit 10 Ziel-Tabs unter `/business/office/time-tracking/`.
- **Legacy `timeTrackingStore`** bleibt nur für Unit-Tests aktiv (`EXPO_PUBLIC_WFM_LEGACY_STORE=true` oder Demo-Modus).

## Office-Arbeitszeit Routing (Phase 1)

| Tab | Route | Implementierung |
|-----|-------|-----------------|
| Live | `/live` | `OfficeLiveEmployeesScreen` |
| Zeitkonten | `/zeitkonten` | `WfmZeitkontenScreen` (Team heute) |
| Prüfqueue | `/pruefqueue` | `WfmPruefqueueScreen` + `WfmOfficeTimeHistoryPanel` (Filter: pending) |
| Abwesenheiten | `/abwesenheiten` | `WfmEmployeeRequestsOfficeScreen` |
| Nachträge | `/nachtraege` | `WfmNachtraegeOfficeScreen` |
| Fahrzeitregeln | `/fahrzeitregeln` | Platzhalter (Phase 2) |
| Team-Meetings | `/team-meetings` | Platzhalter (Phase 2) |
| Historie | `/historie` | `WfmHistorieOfficeScreen` |
| Export | `/export` | `WfmExportScreen` |
| Einstellungen | `/einstellungen` | `TimeTrackingSettingsScreen` |

Sekundärbereich (nicht Admin-Hauptscreen): **Eigene Erfassung** unter `/eigene-erfassung`.

Legacy-Aliase (Redirects, keine Dead Links):

- `/team` → `/zeitkonten`
- `/requests` → `/abwesenheiten`
- `/audit` → `/historie`
- `/` (Index) → `/live`

Shell-Komponente: `OfficeTimeTrackingShell` + `officeTimeTrackingNav.ts`.

## Review-Status: In-Memory vs. persistent

| Bereich | Speicher | Service / Store | Phase-2-Bedarf |
|---------|----------|-----------------|----------------|
| Office-Zeitprüfung (Freigabe, Korrektur) | **In-Memory** | `wfmOfficeTimekeepingStore` | Persistenz in `workforce_time_reviews` o. ä. |
| Export-Warnungen (offene Prüfungen) | **In-Memory** (Store-Overlay) | `getWfmOfficeExportWarnings` | Join auf persistente Review-Tabelle |
| WFM-Sessions / Events | **Supabase** (Demo-Fallback) | `wfmWorkSessionRepository` | Bereits live — Review-Join fehlt |
| Legacy-Korrekturanfragen | **In-Memory** | `timeTrackingStore` | Nur Legacy-Tests; Produktion über WFM |

**Konsequenz Phase 1:** Prüfqueue und Historie funktionieren UI-seitig, aber Review-Entscheidungen überleben keinen App-Neustart.

## Export-Status: In-Memory vs. persistent

| Export-Typ | Datenquelle | Persistenz Export-Job |
|------------|-------------|----------------------|
| CSV Sessions | `wfmExportService` / Supabase Sessions | Job-Metadaten nicht persistent |
| PDF / DATEV | `createWfmExportJob` | In-Memory-Job-Status |
| Legacy CSV | `timeTrackingStore` (nur Legacy-Gate) | In-Memory |

**Konsequenz Phase 1:** Export liefert korrekte CSV aus WFM-Sessions; Export-Historie und wiederholbare Jobs fehlen.

## Abwesenheiten: Dual-System

### WFM (bevorzugter Read-Pfad Office/Arbeitszeit)

- **Service:** `wfmAbsenceService` → Tabelle `workforce_absences`
- **UI:** `WfmEmployeeRequestsOfficeScreen`, `WfmAbsencePortalScreen`, Team-Übersicht via `listWfmAbsencesForTeam`
- **Genehmigung:** `wfmAbsenceApprovalWorkflow` / `reviewWfmAbsenceRequest`

### Legacy (Fallback / andere Module)

- **Service:** `absenceService` → In-Memory `absenceStore` / Konzept `employee_absences`
- **UI:** Mitarbeiter-Personalakte, Compliance-Cockpit, Kalender-Legacy
- **Realtime:** `employee_absences` in `presets.ts` (Schema-Vorbereitung)

**Phase-1-Entscheidung:** Office-Arbeitszeit liest Abwesenheiten ausschließlich über `wfmAbsenceService`. Legacy `absenceService` bleibt für Personalakte/Compliance unangetastet.

**Phase 2:** Datenmigration `employee_absences` → `workforce_absences`, Vereinheitlichung Kalenderbrücke, Entfernung paralleler Genehmigungsflows.

## WFM vs. Legacy — parallele Bereiche

| Funktion | WFM (Produktion) | Legacy (nur Test/Demo) |
|----------|------------------|------------------------|
| Stempeln / Sessions | `wfmClockIn`, `workforce_work_sessions` | `startWorkday` (Gate: `wfmLegacyGate`) |
| Team-Übersicht | `wfmTeamTodayService` | — |
| Office-Prüfung | `wfmOfficeTimekeepingService` + In-Memory Store | `timeTracking` Korrekturen |
| Abwesenheiten Office | `wfmAbsenceService` | `absenceService` (andere Module) |
| Einstellungen | `TimeTrackingSettingsScreen` (Legacy-Kataloge) + WFM-Regeln | `timeTrackingSettingsService` |

## Fehlende Datenfelder / Relationen (Phase 2)

- Persistente Review-Status pro Zeitbuchung (FK: entry/session → reviewer → decision)
- Export-Job-Protokoll (Format, Zeitraum, Ersteller, Datei-Referenz)
- Fahrzeitregeln (Assist-Routenplanung, Wegezeiten)
- Team-Meetings als `work_type` mit Kalender-Sync
- Urlaubskontingent-Sync WFM ↔ Legacy `employee_absences` Balances
- Einheitliche `employee_id` ↔ `user_id` Auflösung in allen Office-Joins

## Schema-Entscheidungen für Phase 2

1. **Review-Persistenz:** Neue Tabelle oder Erweiterung `workforce_time_events` um `review_status`?
2. **Abwesenheits-Migration:** Cutover-Strategie Legacy → `workforce_absences`
3. **Export-Audit:** `workforce_export_jobs` mit RLS
4. **Legacy-Store-Abschaltung:** Entfernung `timeTrackingStore` aus Produktionspfaden nach vollständiger WFM-Abdeckung
5. **RLS/RPC:** Nur nach Schema-Freigabe; Phase 1 bewusst ohne Änderungen

## Risiken

| Risiko | Schwere | Mitigation Phase 1 |
|--------|---------|-------------------|
| Review-Verlust nach Reload | Hoch | Dokumentiert; UI-Hinweis in Prüfqueue möglich (Phase 2) |
| Dual Abwesenheitssystem | Mittel | Office nur WFM-Read-Path |
| Bookmarks auf `/team` | Niedrig | Redirects aktiv |
| Legacy-Tests ohne Env | Mittel | `EXPO_PUBLIC_WFM_LEGACY_STORE=true` in `timeTracking.test.ts` |

## Empfehlung: Schema-Readiness Phase 2

**Bedingt bereit.** UI-Shell, Routing und WFM-Read-Pfade sind konsolidiert. Vor Schema-Phase 2 müssen Review- und Export-Persistenz als erstes Schema-Design abgeschlossen werden — ohne diese Tabellen bleibt die Prüfqueue fachlich unvollständig trotz stabiler Oberfläche.

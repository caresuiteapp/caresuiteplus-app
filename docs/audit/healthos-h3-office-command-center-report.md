# CareSuite+ HealthOS — H3 Office Command Center Report

**Stand:** 2026-07-02  
**Phase:** H3 — Office Command Center  
**Deploy:** nein · **Commit:** ausstehend (Freigabe)

---

## 1. Bestehendes Office Dashboard (Analyse)

| Aspekt | Befund |
|--------|--------|
| **Screen** | `src/screens/office/OfficeIndexScreen.tsx` |
| **View (legacy)** | `src/components/dashboard/OfficeDashboardView.tsx` — **nicht mehr produktiv eingebunden** |
| **Neue View** | `src/components/healthos/office/HealthOSOfficeCommandCenterView.tsx` |
| **Routen** | `/office` (`app/office/(tabs)/index.tsx`), `/business/office/dashboard` (Alias) |
| **Datenquelle** | `useOfficeDashboard` → `fetchOfficeDashboard` → `officeDashboardSupabaseRepository.fetchMetrics` (read) |
| **Shell (outer)** | `PlatformShell` via `app/office/_layout.tsx` — unverändert |
| **Shell (content)** | `ModuleDashboardShell` → **ersetzt durch** `HealthOSModuleShell` |

### Bisherige Karten (8 KPIs + 7 Sektionen)

- 8 Workspace-KPIs (Klient:innen, MA, Termine, Nachrichten, Dokumente, Portal, Abrechnung, QM)
- Status-Karten aus Metriken (Abrechnung, Aufnahme, Blocker)
- Sektions-Links (Betrieb, Stammdaten, Kalender, Kommunikation, Dokumente, Abrechnung, Qualität)
- Timeline Aktivitäten

### Schwächen vor H3

| Problem | Detail |
|---------|--------|
| Generischer Titel | „Heute im Office“ statt Command Center |
| `budgetWarnings` unsichtbar | Metrik bereits im Repository, nicht im UI |
| Keine Betriebsstatus-Sektion | `assignmentsToday` nicht prominent |
| Blocker nur als Count | Kein dediziertes Blockerzentrum |
| WFM ohne Summary | Keine Dashboard-Kachel (bewusst read-only Link) |
| Legacy Premium-Komponenten | Nicht HealthOS-konsistent |

### P0/P0.1 — nur lesend erlaubt

- `officeDashboardSupabaseRepository.fetchMetrics`
- `countAssistExecutionProblems` (bereits im Repository, Count only)
- `budgetWarnings` aus `client_budgets` (80%-Schwelle)
- Keine Writes zu Budget/WFM/Proof/Finalize

---

## 2. H3 Umsetzung

### Adoptierte Seite

**`/office` Command Center** — `OfficeIndexScreen` nutzt HealthOS-Shell + neue Command-Center-View.

### Neue / geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/screens/office/OfficeIndexScreen.tsx` | `HealthOSModuleShell`, `HealthOSTopBar`, `HealthOSBreadcrumbs` |
| `src/components/healthos/office/HealthOSOfficeCommandCenterView.tsx` | **neu** — H3 UI |
| `src/components/healthos/office/index.ts` | **neu** |
| `src/lib/office/officeCommandCenterModel.ts` | **neu** — reine Modell-Builder |
| `src/types/dashboard/index.ts` | `OfficeCommandCenterReadMetrics` + `officeReadMetrics` auf Snapshot |
| `src/lib/dashboard/liveDashboardSnapshot.ts` | Metriken-Passthrough für Office |
| `src/data/demo/officeDashboard.ts` | Demo-Metriken + `officeReadMetrics` |
| `src/components/healthos/index.ts` | Export `./office` |
| `src/__tests__/healthos/healthosOfficeCommandCenter.test.ts` | **neu** |
| `src/__tests__/office/officeDashboard.test.ts` | aktualisiert |

### Command Center Sektionen (Ziel A–F)

| Sektion | Inhalt | Datenquelle |
|---------|--------|-------------|
| **A. Betriebsstatus heute** | Einsätze, Termine, Blocker, Doku, Nachweise | `officeReadMetrics` |
| **B. Qualitäts- / Blockerzentrum** | Aggregat + Status-Karten | `executionBlockers`, `statusCards` |
| **C. Budget Health Summary** | Warnungen, offene Fälle, Entwürfe | `budgetWarnings`, Rechnungs-Counts |
| **D. Workforce / Zeitkonto** | Aktive MA, Link Arbeitszeit | `activeEmployees`, Route only |
| **E. Nachweise & Dokumente** | Nachweise, Dokumente, Portal | read metrics + KPI portal |
| **F. Schnellzugriffe** | HealthOS Office Nav (visible) | `healthosNavigationConfig` |

### HealthOS-Komponenten verwendet

`HealthOSModuleShell`, `HealthOSPage`, `HealthOSSection`, `HealthOSMetricCard`, `HealthOSCard`, `HealthOSAlert`, `HealthOSEmptyState`, `HealthOSLoadingState`, `HealthOSErrorState`, `HealthOSTopBar`, `HealthOSBreadcrumbs`

---

## 3. Bewusst nicht geändert (rote Zonen)

- `finalizeVisit.ts`, Proof-Persistenz, Budget-Transaktionen, WFM-Sync RPC
- `EmployeePortalVisitExecutionScreen`, Assist Assignment Detail
- RLS, Migrationen, Portal-Routes
- Dual-Routing `/office` vs `/business/office` — keine Redirects
- `PlatformShell`, `officeNav.ts`, `assistNav.ts`
- `OfficeDashboardView.tsx` — legacy, unverändert (Fallback-Referenz)

---

## 4. UI- / Textverbesserungen

- Titel **Command Center** mit Untertitel Steuerungszentrale
- Deutsche Fachbegriffe statt technischer Keys (via Modell-Labels)
- Empty States: „Keine offenen Blocker“, „Keine Übersichtsdaten“
- Budget-Sektion: „Nur Übersicht — keine Buchungen“
- Keine Demo-/Mock-/Coming-soon-Texte

---

## 5. Responsive Verhalten

| Breakpoint | Verhalten |
|------------|-----------|
| Desktop | 4-spaltige KPI-Grids, Sektionen untereinander |
| Tablet | 2–3 Spalten, `AdaptiveKpiGrid` |
| Mobile | 2 Spalten, scrollbare `HealthOSPage`, touchfähige Pressables |

---

## 6. Datenlücken ( dokumentiert, keine neuen RPCs )

| Lücke | H3-Verhalten |
|-------|--------------|
| Laufende / abgeschlossene Einsätze heute | Nur `assignmentsToday` (geplant heute) — keine Status-Split |
| Blocker nach Typ (Doku/Signatur/Proof) | Nur Aggregat-Count — kein `fetchAssistExecutionProblems` im UI |
| WFM Sync-Count / offene Zeitkonten | Link zu `/business/office/time-tracking`, Wert „—“ |
| Budget reserviert/durchgeführt/freigegeben | Nur `budgetWarnings` + Rechnungs-Counts |
| Client-Document-Mirror Status | Nicht als eigene Metrik — Datenlücke |

---

## 7. Tests

| Suite | Tests | Ergebnis |
|-------|-------|----------|
| `healthosOfficeCommandCenter.test.ts` | 12 | ✅ |
| `healthosShellNavigation.test.ts` | 32 | ✅ |
| `healthosFoundation.test.ts` | 18 | ✅ |
| `healthosStatusMapping.test.ts` | 9 | ✅ |
| `officeDashboard.test.ts` | 8 | ✅ |
| P0.1 `wfmAssistAdapterRpc.test.ts` | 5 | ✅ |
| P0.1 `finalizeVisitProof.test.ts` | 5 | ✅ |

**Gesamt ausgeführte Suite: 89/89 grün**

Abgedeckt: HealthOSModuleShell, Command Center Sektionen, read-only metrics, keine P0-Write-Imports, rote Zonen unberührt.

---

## 8. Risiken

| Risiko | Bewertung | Mitigation |
|--------|-----------|------------|
| Doppelte Shell (Platform + HealthOSModule) | niedrig | HealthOSModuleShell nur Content-Layer |
| Nutzer erwarten WFM-Summary | mittel | Link + Datenlücke dokumentiert |
| Blocker-Detail fehlt | mittel | H4 Assist Ops / QM-Hub |
| Legacy `OfficeDashboardView` verwaist | niedrig | Nicht gelöscht, Tests umgestellt |

---

## 9. Empfehlung für H4

**Go** — Assist HealthOS Ops Dashboard unter gleichem Muster.

H4 Fokus:
1. Assist Live-Status / Einsatzplanung mit `HealthOSModuleShell`
2. Optional: read-only `fetchAssistExecutionProblems` in Blockerzentrum (ohne Write)
3. Sidebar-Migration Office → `HealthOSRoleNavigationSidebar`

---

## Abschluss-Checkliste H3

| Kriterium | Status |
|-----------|--------|
| Nur lesende Daten | ✅ |
| Budget/WFM/Proof/Finalize unberührt | ✅ |
| Rote Zonen unberührt | ✅ |
| Kein Deploy | ✅ |
| Commit-Readiness | ✅ (auf Freigabe) |
| Go für H4 | ✅ |

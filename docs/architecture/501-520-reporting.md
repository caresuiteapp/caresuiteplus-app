# WP 501–520 — Reporting & PDL-Cockpit

## Überblick

Abschnitt 26 liefert das Reporting-Modul mit PDL-Cockpit für Pflegedienstleitung und Geschäftsführung.

| WP | Position | Deliverable |
|----|----------|-------------|
| 501 | Architektur & Datenmodell | `src/types/reporting/index.ts` |
| 502 | Routen & Navigation | `app/business/reporting/` |
| 503 | PDL-Cockpit Dashboard | `src/screens/reporting/PdlCockpitScreen.tsx` |
| 504 | Listenansicht | `src/screens/reporting/ReportListScreen.tsx` |
| 505 | Detailansicht | `src/screens/reporting/ReportDetailScreen.tsx` |
| 506 | Create/Edit Wizard | `src/screens/reporting/ReportCreateScreen.tsx` |
| 507 | Service-Schicht | `src/lib/reporting/reportingService.ts` |
| 508 | Hooks & State | `src/hooks/usePdlCockpit.ts`, `useReportList.ts`, `useReportDetail.ts` |
| 509 | Rollen & Rechte | `business.reporting.view`, `business.reporting.create` |
| 510 | Supabase & RLS | `src/lib/services/repositories/reportingRepository.supabase.ts` |
| 511 | Demo-Daten | `src/data/demo/reportingDemo.ts` |
| 515 | Workflow & Status | `src/lib/reporting/reportingWorkflow.ts` |
| 516 | Abrechnung & Audit | `src/lib/reporting/reportingBillingAudit.ts` |
| 517 | AI/OCR/API | `src/lib/reporting/reportingAiExtension.ts` |
| 518 | UX & Barrierefreiheit | `src/lib/a11y/wp501-reporting.ts` + `ScreenShell.a11yMeta` |
| 519 | Tests | `src/__tests__/wp/wp519-reporting.test.ts` |
| 520 | Abschluss | Business-Tab „PDL“ in `shellConfig.ts` |

## Navigation

- Tab: **PDL** → `/business/reporting`
- Berichte: `/business/reporting/list`
- Detail: `/business/reporting/[id]`
- Anlegen: `/business/reporting/create`

## PDL-Cockpit Inhalte

- **KPIs:** Einsatzabdeckung, offene Aufgaben, Qualität, Risiken
- **Offene Aufgaben:** Priorität, Fälligkeit, Verantwortliche
- **Risiken:** Schweregrad (critical/warning/info) mit Hinweistext

## Demo-Persistenz

`createReportDraft` schreibt neue Berichte in `demoReportList` (In-Memory). Supabase-Repository-Stub für spätere Migration vorhanden.

## Ergänzungen WP 512–514

| WP | Deliverable |
|----|-------------|
| 512 | `app/business/reporting/portal-preview.tsx` |
| 513 | `src/screens/reporting/ReportingComposeMessageScreen.tsx` |
| 514 | `src/lib/documents/reportingDocumentService.ts` |
| 509 | `docs/architecture/wp-509-reporting-permissions.md` |

## Berechtigungen

| Permission | Rollen |
|------------|--------|
| `business.reporting.view` | business_admin, business_manager, billing (via BUSINESS_PLATFORM) |
| `business.reporting.create` | business_admin, business_manager |

# CareSuite+ HealthOS — UI-Struktur-Landkarte (H0)

**Stand:** 2026-07-02  
**Scope:** Office, Assist, Mitarbeiterportal, Klient:innenportal  
**Routing:** Expo Router (`app/`), Screens (`src/screens/`), Registry (`src/lib/navigation/routes.ts`)  
**P0/P0.1:** Budget + WFM production GO — keine Änderungsvorschläge an Finalize, Proof, Budget-Transaktionen, WFM-Sync, RLS, Migrationen.

---

## Architektur-Überblick

| Bereich | Shell | Navigation | Route-Prefix |
|---------|-------|------------|--------------|
| Office | `PlatformShell` | `ModuleNavSidebar` + `officeNav.ts` | `/office`, `/business/office` |
| Assist | `PlatformShell` | `assistNav.ts` + `ASSIST_TABS` | `/assist` |
| Mitarbeiterportal | `EmployeePortalShell` → `PortalShellLayout` | Bottom-Nav + Drawer | `/portal/employee` |
| Klient:innenportal | `ClientPortalShell` → `PortalShellLayout` | Bottom-Nav + Drawer | `/portal/client` |

**Strukturproblem:** Office existiert doppelt (`/office/*` und `/business/office/*`) — gleiche Funktion, unterschiedliche Layouts.

**Seitenzählung:** Office 15 · Assist 13 · Employee 15 · Client 11 ≈ **54 Kernseiten** (+ ~30 Detail-/Subrouten). Gesamt: ~581 `app/`-Routen, ~417 Screen-Dateien.

---

## Office — Seiteninventar

| Seite | Datei / Route | Rolle | Zweck | Key Action | Datenquelle | Layout | Text | Mobile | RLS | P0-Risiko | Empfehlung |
|-------|---------------|-------|-------|------------|-------------|--------|------|--------|-----|-----------|------------|
| Dashboard | `OfficeIndexScreen` → `/office` | dispatch, admin, billing | KPI-Übersicht | Neuaufnahme, Rechnung | `useOfficeDashboard` | OK Desktop | „Office“ generisch | Tabs fehlen WFM | tenant-scoped | grün | **keep** (H3) |
| Klient:innenliste | `ClientsListScreen` / `ClientsAdaptiveScreen` → `/office/clients` | Office-Team | Suche, Filter | Klient öffnen | `clientRepository` | Adaptive OK | konsistent | Card-View | client RLS | grün | **keep** |
| Klient:innenakte | `ClientRecordScreen` → `/business/office/clients/[id]`, `/office/clients/[id]` | Pflegekoord., Billing | Stammdaten, Tabs | Bearbeiten | `useClientRecord` | Tab-Overflow mobil | Tab-Labels lang | Scroll tief | sensitiv | gelb | **rebuild** Shell |
| Dokumente | `OfficeDocumentsListScreen` → `/office/documents` | Office | Akten-DMS | Upload, Detail | `useOfficeDocuments` | Modal-Stack | OK | Upload schwer | document RLS | gelb | **rebuild** UI |
| Nachweise | Akte + `/assist/nachweise` | Backoffice | Proof-Review | Review | proof services | — | — | — | proof RLS | **rot** | **keep** Backend |
| Budgets | `ClientCareGradeBudgetsPanel` in Akte; `/office/budgets/[id]` | Billing | Pflegegrad-Budgets | Sperren, Korrektur | `clientBudgetAccountService` | Tabelle gut | „Anspruch“ vs „Budget“ | Modal-Höhe | budget RLS | **rot** | **keep** |
| Mitarbeitende | `EmployeesListScreen` → `/office/employees` | HR, Dispatch | Teamliste | MA anlegen | employee repos | OK | OK | Filter eng | employee RLS | grün | **keep** |
| MA-Detail | `EmployeeDetailScreen` → `/office/employees/[id]` | HR | Personalakte light | Bearbeiten | personnel services | Modal vs Page | inkonsistent | — | employee RLS | grün | **merge** mit personnel |
| Zeit/WFM | `TimeTrackingTeamScreen` → `/business/office/time-tracking/*` | Leitung | Team-AZW, Live | Export, Audit | `wfm*` services | getrennt von Nav | „Arbeitszeit“ vs „WFM“ | Karte schwer | time RLS | **rot** | **keep**, H3 Nav |
| Urlaub/Abwesenheit | indirekt WFM + Portal | HR | Fehlt dediziert Office-UI | — | `wfmAbsence*` | — | — | — | — | gelb | **merge** unter WFM |
| Einsätze | Kalender + Assist | Dispatch | Termin/Einsatz | Termin anlegen | calendar services | Duplikat `/office/kalender` | Doppel „Kalender“ | OK | — | gelb | **merge** |
| Abrechnungsvorbereitung | `app/office/billing-preparation.tsx` | Billing | Monatsabschluss | Export | billing prep | nicht in Nav | schwer auffindbar | — | billing | gelb | **rebuild** Nav |
| Kommunikation | `OfficeMessengerScreen` → `/office/messages` | Office | Messenger 3-Kanal | Senden | `officemessaging*` | 3-Spalten gut | Query-Param-URLs | Mobile OK | message RLS | gelb | **rebuild** URLs |
| Blocker/Qualität | `AssistExecutionProblemInboxPanel`; `/business/office/qm` | QM | Blocker + QM | Einsatz öffnen | `assistExecutionProblemInboxService` | Assist-only | „Problem-Inbox“ | klein | — | gelb | **merge** Command Center |
| Einstellungen | `/business/office/settings`, `/settings/tenant/*` | Admin | Mandant, Kataloge | Speichern | tenant settings | verstreut | — | — | admin | grün | **merge** Settings Hub |

**Office Unterrouten (Auswahl):** Rechnungen `/office/invoices`, Kataloge `/office/catalogs`, Zugänge `/business/office/access`, Audit `/business/office/audit-log`, Inventar `/business/office/inventory`, Reporting `/business/office/reporting`.

---

## Assist — Seiteninventar

| Seite | Datei / Route | Rolle | Key Action | Datenquelle | P0 | Empfehlung |
|-------|---------------|-------|------------|-------------|-----|------------|
| Dashboard | `AssistIndexScreen` → `/assist` | Dispatch | Einsatz planen | `useAssistDashboard` | grün | keep |
| Planung | `AssignmentEditScreen`, `/assist/einsaetze/new` | Dispatch | Speichern (Wizard) | `visitService`, Katalog | **rot** (budget alloc) | **rebuild** Shell |
| Live-Einsätze | `AssistLiveStatusScreen` → `/assist/live-status` | Leitung | MA/Einsatz | `useAssistLiveMonitoring` | gelb | keep |
| Einsatzdetails | `AssignmentDetailTabsPanel` → `/assist/assignments/[id]` | Dispatch | Status ändern | `visitRepository` | **rot** | keep Backend |
| Durchführung | `VisitExecutionScreen` → `/assist/durchfuehrung/[id]` | Feld | Start/Stop | assistWorkflow | **rot** | **merge** Portal |
| Nachweise | `LeistungsnachweiseListScreen` → `/assist/nachweise` | Backoffice | Review | proof services | **rot** | keep |
| Budgets (Einsatz) | Tab in Assignment Detail | Billing | Override | `clientBudgetTransactionService` | **rot** | keep |
| Leistungsarten | `AssistCatalogHubScreen` → `/business/office/settings/assist-catalogs` | Admin | Bearbeiten | catalog repos | grün | **merge** Settings |
| Blocker-Inbox | `AssistExecutionProblemInboxPanel` | Leitung | Drill-down | inbox service | gelb | **replace** → HealthOSInbox |
| Kommunikation | Office Messages (cross) | — | — | — | grün | cross-link |
| Einstellungen | `AssistSettingsScreen` → Modal | Admin | Speichern | tenant assist | grün | keep |
| Touren/Fahrten | `AssistTourenScreen`, `TripsListScreen` | Dispatch | Route öffnen | trip repos | grün | keep |
| Qualität | `AssistQualityListScreen` → `/assist/qualitaet` | QM | — | quality service | grün | **merge** Blocker |

---

## Mitarbeiterportal — Seiteninventar

| Seite | Route | Screen | Key Action | Datenquelle | P0 | Empfehlung |
|-------|-------|--------|------------|-------------|-----|------------|
| Home/Today | `/portal/employee` | `EmployeePortalDashboardScreen` | Fortsetzen/Start | `employeePortalLiveOverviewService` | gelb | **rebuild** Hero |
| Meine Einsätze | `/portal/employee/assignments` | Tab-Route | Detail | portal assignment service | gelb | keep |
| Aktueller Einsatz | `/portal/employee/assignments/[id]` | `PortalAssignmentDetailScreen` | Execute | live assignment | **rot** | keep |
| Execution | `/portal/employee/assignments/[id]/execute` | `EmployeePortalVisitExecutionScreen` | finalize | `useEmployeePortalVisitExecution` | **rot** | **keep** — nur Shell |
| Dokumentation | Panel in Execution | `EmployeePortalVisitDocumentationPanel` | Speichern | `saveVisitDocumentation` | **rot** | keep |
| Signatur | Step in Execution | `CareSignatureCanvas` | Erfassen | signature session | **rot** | keep |
| Meine Zeiten | `/portal/employee/times`, `/arbeitszeit` | `EmployeePortalTimesScreen` | Stempeln | `wfmClockService` | **rot** | **rebuild** Nav |
| Urlaub/Abwesenheit | `/portal/employee/arbeitszeit/urlaub`, `/abwesenheiten` | `WfmAbsencePortalScreen` | Einreichen | WFM absence | gelb | merge |
| Nachrichten | `/portal/employee/messages` | portal message screens | Senden | portal messaging | gelb | keep |
| Dokumente/Schulung | `/portal/employee/documents` | `PortalDocumentsTab` | Öffnen | `portalDocumentsLiveService` | grün | keep |
| Dienstplan | `/portal/employee/schedule` | `(tabs)/schedule.tsx` | — | schedule service | grün | keep |
| Profil | `/portal/employee/profile` | `EmployeeProfileScreen` | Bearbeiten | profile service | grün | keep |
| Hilfe | `/portal/employee/help` | Help route | — | statisch | grün | keep |
| Mobilität | `/portal/employee/mobilitaet` | `EmployeeMobilitySettingsScreen` | GPS Consent | consent service | **rot** | keep |

---

## Klient:innenportal — Seiteninventar

| Seite | Route | Screen | Key Action | Datenquelle | P0 | Empfehlung |
|-------|-------|--------|------------|-------------|-----|------------|
| Übersicht | `/portal/client` | `AdaptivePortalOverview` | Quick actions | `clientPortalDashboardLive` | grün | keep |
| Termine | `/portal/client/appointments` | appointments tab | Detail | portal appointments | gelb | keep |
| Termin-Detail | `/portal/client/appointments/[id]` | `PortalClientAppointmentDetailScreen` | Live-Karte | `getClientLiveVisitLocation` | gelb | keep |
| Live Tracking | `/portal/client/live` | `PortalClientLiveTrackingScreen` | — | live tracking | gelb | keep |
| Nachweise | in Termin/Dokumente | wenn released | — | portal release | **rot** | **merge** Termine |
| Dokumente | `/portal/client/documents` | documents tab | PDF | `portalDocumentsLiveService` | **rot** | keep |
| Budget | `/portal/client/budget` | inline route | — | `getClientPortalBudgetProjection` | gelb | **rebuild** Nav |
| Nachrichten | `/portal/client/messages` | messages tab | Chat | portal messaging | grün | keep |
| Stammdaten | `/portal/client/profile` | `ClientPortalProfileScreen` | Anfrage | client profile | **rot** | keep |
| Hilfe | `/portal/client/help` | help route | — | statisch | grün | keep |
| Mitteilungen | `/portal/client/announcements` | announcements | Lesen | announcements | grün | merge Messages |

---

## Hauptprobleme (Seiten-Ebene)

1. Dual-Routing `/office` vs `/business/office`
2. Portal-Deep-Routes (Budget, Arbeitszeit, Hilfe) fehlen in Bottom-Nav
3. Assist Blocker-Inbox nur auf Live-Status, nicht im Office Command Center
4. Execution/Durchführung doppelt (Assist + Employee Portal)
5. Abrechnungsvorbereitung und WFM schwer auffindbar in Office-Nav

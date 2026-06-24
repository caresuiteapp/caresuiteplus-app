# C.14V — Route-Component-Matrix

## Datum
2026-06-24

## Legende
- ✅ = C14vSubpageShell mit Eyebrow + ActionBar (vollständiger Rebuild)
- 🔶 = Eyebrow-Enhancement (bestehendes Pattern erweitert)
- ⬜ = Unverändert (Dashboard oder spezialisiertes Layout)

## Office Portal

| Route | Komponente | Status | Shell |
|-------|-----------|--------|-------|
| `/business/office` | `OfficeIndexScreen` | ⬜ Dashboard | ModuleDashboardShell |
| `/business/office/clients` | `ClientsListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/business/office/employees` | `EmployeesListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/business/office/messages` | `OfficeMessagesListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/business/office/documents` | `OfficeDocumentsListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/business/office/settings` | `OfficeBusinessSettingsScreen` | ✅ Rebuild | C14vSubpageShell |
| `/business/office/calendar` | `OfficeCalendarScreen` | ⬜ CalendarShell | Spezialisiert |
| `/business/office/portals` | `AccessManagementDashboardScreen` | ⬜ Spezialisiert | Eigenes Layout |
| `/business/office/invoices` | `InvoicesListScreen` | ⬜ Unverändert | ScreenShell |

## Assist Portal

| Route | Komponente | Status | Shell |
|-------|-----------|--------|-------|
| `/assist` | `AssistIndexScreen` | ⬜ Dashboard | ModuleDashboardShell |
| `/assist/einsaetze` | `EinsaetzeListScreen` | ⬜ EntityListScreen | Eigenes Pattern |
| `/assist/assignments` | `AssignmentsListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/assist/durchfuehrung` | `ExecutionsListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/assist/nachweise` | `LeistungsnachweiseListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/assist/fahrten` | `TripsListScreen` | ✅ Rebuild | C14vSubpageShell |
| `/assist/touren` | `AssistTourenScreen` | ✅ Rebuild | C14vSubpageShell |
| `/assist/einstellungen` | `AssistSettingsScreen` | ✅ Rebuild | C14vSubpageShell |
| `/assist/live-status` | `AssistLiveStatusScreen` | ⬜ Spezialisiert | ScreenShell (komplex) |
| `/assist/aufgaben` | `AssistTasksListScreen` | ⬜ EntityListScreen | Eigenes Pattern |
| `/assist/qualitaet` | `AssistQualityListScreen` | ⬜ DedicatedListScreen | Eigenes Pattern |
| `/assist/zugeordnete-klienten` | `ModuleAssignedClientsScreen` | ⬜ Shared | Eigenes Pattern |
| `/assist/kalender` | `AssistCalendarScreen` | ⬜ CalendarShell | Spezialisiert |

## Employee Portal

| Route | Komponente | Status | Shell |
|-------|-----------|--------|-------|
| `/portal/employee` | `EmployeePortalOverviewScreen` | 🔶 Eyebrow | PortalTabScreen |
| `/portal/employee/messages/[id]` | `PortalMessageDetailScreen` | ✅ Rebuild | C14vSubpageShell |
| `/portal/employee/documents/[id]` | `PortalDocumentDetailScreen` | ✅ Rebuild | C14vSubpageShell |
| `/portal/employee/assignments/[id]` | `PortalAssignmentDetailScreen` | ✅ Rebuild | C14vSubpageShell |
| `/portal/employee/announcements` | `EmployeePortalAnnouncementsScreen` | ⬜ Unverändert | PortalTabScreen |

## Client Portal

| Route | Komponente | Status | Shell |
|-------|-----------|--------|-------|
| `/portal/client` | `ClientPortalOverviewScreen` | 🔶 Eyebrow | PortalTabScreen |
| `/portal/client/messages/[id]` | `PortalClientMessageDetailScreen` | ⬜ Unverändert | ScreenShell |
| `/portal/client/documents/[id]` | `PortalClientDocumentDetailScreen` | ⬜ Unverändert | ScreenShell |
| `/portal/client/appointments/[id]` | `PortalClientAppointmentDetailScreen` | ⬜ Unverändert | ScreenShell |

## Zusammenfassung

| Portal | Gesamt Routes | Rebuild ✅ | Enhanced 🔶 | Unverändert ⬜ |
|--------|--------------|-----------|-------------|---------------|
| Office | 9 | 5 | 0 | 4 |
| Assist | 13 | 6 | 0 | 7 |
| Employee | 5 | 3 | 1 | 1 |
| Client | 4 | 0 | 1 | 3 |
| **Gesamt** | **31** | **14** | **2** | **15** |

## Shared Component
- `src/components/layout/C14vSubpageShell.tsx` — Einheitlicher Container mit:
  - Eyebrow (uppercase Modul-Label)
  - ActionBar (Primary/Secondary/Ghost Actions)
  - Aurora-Glass-Panel (automatisch bei shellHostsAurora)
  - moduleColor Akzente
  - Lesemodus-Indikator
  - Role-Label-Integration

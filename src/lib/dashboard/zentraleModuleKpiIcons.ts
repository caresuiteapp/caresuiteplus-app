import type { MainModuleKey } from '@/types/navigation/platform';
import type { SpaceModuleKpiGlyphKind } from '@/components/icons/space/spaceModuleKpiGlyphs';

/** Modul-spezifische KPI-Icons für die Zentrale-Übersicht (6×5). */
export const ZENTRALE_MODULE_KPI_ICONS: Record<MainModuleKey, Record<string, SpaceModuleKpiGlyphKind>> = {
  zentrale: {},
  office: {
    'clients-active': 'mkpiOfficeClients',
    invoices: 'mkpiOfficeInvoice',
    'employees-active': 'mkpiOfficeStaff',
    'appointments-week': 'mkpiOfficeCalendar',
    'clients-new': 'mkpiOfficeNewClient',
  },
  assist: {
    assignments: 'mkpiAssistAssignments',
    'service-records': 'mkpiAssistProof',
    tasks: 'mkpiAssistTasks',
    messages: 'mkpiAssistMessages',
    'documents-review': 'mkpiAssistDocuments',
  },
  pflege: {
    'clients-active': 'mkpiPflegeClients',
    'budget-warnings': 'mkpiPflegeBudget',
    tasks: 'mkpiPflegeTasks',
    'portal-requests': 'mkpiPflegePortal',
    'clients-new': 'mkpiPflegeNewClient',
  },
  stationaer: {
    'clients-total': 'mkpiStationRoster',
    'clients-active': 'mkpiStationClients',
    'appointments-week': 'mkpiStationCalendar',
    'portal-users': 'mkpiStationPortal',
    'employees-active': 'mkpiStationStaff',
  },
  beratung: {
    'clients-active': 'mkpiBeratungClients',
    'appointments-week': 'mkpiBeratungCalendar',
    messages: 'mkpiBeratungMessages',
    tasks: 'mkpiBeratungTasks',
    'clients-new': 'mkpiBeratungNewClient',
  },
  akademie: {
    modules: 'mkpiAkademieCourses',
    'portal-users': 'mkpiAkademiePortal',
    'employees-active': 'mkpiAkademieParticipants',
    'documents-review': 'mkpiAkademieMedia',
    tasks: 'mkpiAkademieMandatory',
  },
  admin: {},
};

export function resolveZentraleModuleKpiIcon(
  moduleKey: MainModuleKey,
  kpiSuffix: string,
): SpaceModuleKpiGlyphKind | undefined {
  return ZENTRALE_MODULE_KPI_ICONS[moduleKey]?.[kpiSuffix];
}

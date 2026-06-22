import type { MainModuleKey } from '@/types/navigation/platform';

/** Default live-data destinations for Zentrale KPI suffixes (Office-centric). */
const DEFAULT_KPI_ROUTES: Record<string, string> = {
  'clients-active': '/office/clients',
  'clients-total': '/office/clients',
  'clients-new': '/office/clients',
  invoices: '/office/invoices',
  'employees-active': '/office/employees',
  'employees-total': '/office/employees',
  'appointments-week': '/office/calendar',
  assignments: '/assist/assignments',
  'service-records': '/assist/nachweise',
  tasks: '/business/office/access/tasks',
  messages: '/office/messages',
  'documents-review': '/office/documents',
  modules: '/business/office/modules',
  'portal-users': '/business/office/access/client-portal',
  'portal-requests': '/business/office/access/client-portal',
  'budget-warnings': '/office/budgets',
};

const MODULE_KPI_ROUTE_OVERRIDES: Partial<Record<MainModuleKey, Record<string, string>>> = {
  assist: {
    tasks: '/assist/aufgaben',
  },
  pflege: {
    'clients-active': '/pflege/zugeordnete-klienten',
    'clients-new': '/pflege/zugeordnete-klienten',
    tasks: '/pflege/massnahmen',
  },
  stationaer: {
    'clients-total': '/stationaer/bewohner',
    'clients-active': '/stationaer/bewohner',
    'appointments-week': '/stationaer/calendar',
  },
  beratung: {
    'clients-active': '/beratung/faelle',
    'clients-new': '/beratung/faelle',
    'appointments-week': '/beratung/calendar',
    tasks: '/beratung/wiedervorlagen',
  },
  akademie: {
    'portal-users': '/akademie/teilnehmer',
    'employees-active': '/akademie/teilnehmer',
    'documents-review': '/akademie/mediathek',
    tasks: '/akademie/pflichtschulungen',
  },
};

export function resolveZentraleKpiRoute(moduleKey: MainModuleKey, kpiSuffix: string): string {
  const override = MODULE_KPI_ROUTE_OVERRIDES[moduleKey]?.[kpiSuffix];
  if (override) return override;
  const route = DEFAULT_KPI_ROUTES[kpiSuffix];
  if (!route) {
    throw new Error(`Missing route for KPI suffix ${kpiSuffix} in module ${moduleKey}`);
  }
  return route;
}

export function extractKpiSuffixFromId(kpiId: string): string {
  const match = kpiId.match(/^(?:kpi|office-kpi)-(.+)$/);
  if (!match?.[1]) {
    throw new Error(`Unexpected KPI id: ${kpiId}`);
  }
  return match[1];
}

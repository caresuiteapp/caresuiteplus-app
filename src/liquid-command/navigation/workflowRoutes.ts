import type { LiquidModuleKey } from '../types';

type RouteBuilder = (recordId: string) => string;

const recordRoutes: Partial<Record<LiquidModuleKey, Record<string, RouteBuilder>>> = {
  office: {
    company: (id) => `/business/office/clients/${id}`,
    people: (id) => `/business/office/employees/${id}`,
    billing: (id) => `/business/office/invoices/${id}`,
    documents: (id) => `/business/office/documents/${id}`,
  },
  assist: {
    assignments: (id) => `/assist/assignments/${id}`,
    planning: (id) => `/assist/einsaetze/${id}`,
    live: (id) => `/assist/assignments/${id}`,
    proofs: (id) => `/assist/nachweise/${id}`,
  },
  pflege: {
    sis: (id) => `/pflege/sis/${id}`,
    measures: (id) => `/pflege/planung/${id}`,
    medication: (id) => `/pflege/medikation/${id}`,
    diagnoses: (id) => `/pflege/dokumentation/${id}`,
    wounds: (id) => `/pflege/wunddokumentation/${id}`,
    vitals: (id) => `/pflege/vitalwerte/${id}`,
    reports: (id) => `/pflege/berichte/${id}`,
  },
  stationaer: {
    residents: (id) => `/stationaer/bewohner/${id}`,
  },
  akademie: {
    paths: (id) => `/akademie/teilnehmer/${id}`,
    courses: (id) => `/akademie/teilnehmer/${id}`,
    exams: (id) => `/akademie/teilnehmer/${id}`,
    certificates: (id) => `/akademie/teilnehmer/${id}`,
    mandatory: (id) => `/akademie/teilnehmer/${id}`,
  },
};

const primaryWorkflowRoutes: Partial<Record<LiquidModuleKey, Record<string, string>>> = {
  office: {
    company: '/business/office/clients/new',
    people: '/business/office/employees/new',
    billing: '/business/office/invoices/new',
    documents: '/business/office/documents/upload',
    communication: '/business/messages/new',
    inventory: '/business/office/inventory/items',
    audit: '/business/office/audit-log',
  },
  assist: {
    clients: '/assist/zugeordnete-klienten',
    assignments: '/assist/einsaetze/new',
    planning: '/assist/einsaetze/new',
    live: '/assist/live-status',
    proofs: '/assist/nachweise/review',
    budgets: '/assist/abrechnungsquellen',
    portals: '/assist/portal-preview',
  },
  pflege: {
    sis: '/pflege/sis/new',
    measures: '/pflege/planung/new',
    medication: '/pflege/medikation/new',
    diagnoses: '/pflege/verordnungen',
    wounds: '/pflege/bodymap',
    vitals: '/pflege/vitalwerte/new',
    reports: '/pflege/berichte/new',
  },
  stationaer: {
    residents: '/stationaer/bewohner',
    wards: '/stationaer/belegung',
    shifts: '/stationaer/bewohnerplanung',
    handover: '/stationaer/uebergabe',
    services: '/stationaer/bodymap',
    occupancy: '/stationaer/belegung',
  },
  beratung: {
    cases: '/beratung/faelle/new',
    appointments: '/beratung/calendar',
    assessments: '/beratung/erstgespraech',
    recommendations: '/beratung/massnahmen',
    proofs: '/beratung/protokolle/new',
    'follow-up': '/beratung/wiedervorlagen',
  },
  akademie: {
    paths: '/akademie/schulungsplan',
    courses: '/akademie/kurse/new',
    exams: '/akademie/pruefungen',
    certificates: '/akademie/zertifikate',
    mandatory: '/akademie/pflichtschulungen',
  },
  platform: {
    tenants: '/platform/tenants',
    plans: '/platform/plans',
    billing: '/platform/billing',
    flags: '/platform/feature-flags',
    support: '/platform/support',
    releases: '/platform/releases',
    audit: '/platform/audit',
  },
  settings: {
    organization: '/settings/tenant',
    roles: '/business/settings',
    integrations: '/business/integrations',
    privacy: '/settings/data-request',
    templates: '/business/templates',
    notifications: '/settings/profile',
  },
};

export function getLiquidRecordRoute(
  moduleKey: LiquidModuleKey,
  areaId: string,
  recordId: string,
): string | null {
  return recordRoutes[moduleKey]?.[areaId]?.(recordId) ?? null;
}

export function getLiquidPrimaryWorkflowRoute(
  moduleKey: LiquidModuleKey,
  areaId: string,
): string | null {
  return primaryWorkflowRoutes[moduleKey]?.[areaId] ?? null;
}

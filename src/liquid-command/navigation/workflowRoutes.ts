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
    diagnoses: () => '/pflege/diagnosen',
    wounds: (id) => `/pflege/wunddokumentation/${id}`,
    vitals: (id) => `/pflege/vitalwerte/${id}`,
    reports: (id) => `/pflege/berichte/${id}`,
    proofs: () => '/pflege/leistungsnachweise',
    billing: () => '/pflege/abrechnung',
    'invoice-foundations': () => '/pflege/rechnungsgrundlagen',
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
    company: '/settings/tenant',
    clients: '/business/office/clients/new',
    people: '/business/office/employees/new',
    timekeeping: '/business/office/time-tracking/nachtraege',
    payroll: '/business/office/payroll',
    billing: '/business/office/invoices/new',
    documents: '/business/office/documents/upload',
    communication: '/business/messages/new',
    portals: '/business/office/access/employee-portal/new',
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
    portals: '/assist/portale',
  },
  pflege: {
    sis: '/pflege/sis/new',
    measures: '/pflege/planung/new',
    medication: '/pflege/medikation/new',
    diagnoses: '/pflege/diagnosen',
    wounds: '/pflege/bodymap',
    vitals: '/pflege/vitalwerte/new',
    reports: '/pflege/berichte/new',
    treatment: '/pflege/behandlungspflege/new',
    handovers: '/pflege/uebergaben/new',
    risks: '/pflege/risiken',
    evaluations: '/pflege/evaluation/new',
    visits: '/pflege/visiten/new',
    deviations: '/pflege/abweichung-new',
    'md-readiness': '/pflege/md-pruefbereitschaft',
    quality: '/pflege/reports',
    proofs: '/pflege/leistungsnachweis-new',
    billing: '/pflege/abrechnung',
    'invoice-foundations': '/pflege/rechnungsgrundlage-new',
    acceptance: '/pflege/gesamtabnahme',
    settings: '/pflege/settings',
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
    roles: '/business/office/permissions',
    integrations: '/business/integrations',
    privacy: '/settings/data-request',
    templates: '/business/templates',
    branding: '/settings/appearance',
  },
};

const primaryActionLabels: Partial<Record<LiquidModuleKey, Record<string, string>>> = {
  office: {
    company: 'Organisation bearbeiten',
    clients: 'Klient:in anlegen',
    people: 'Mitarbeitende anlegen',
    timekeeping: 'Nachtrag erfassen',
    payroll: 'Gehaltsmonat öffnen',
    billing: 'Rechnung erstellen',
    documents: 'Dokument hochladen',
    communication: 'Nachricht verfassen',
    portals: 'Portalzugang anlegen',
    inventory: 'Inventar öffnen',
    audit: 'Audit öffnen',
  },
  assist: {
    clients: 'Klient:innen öffnen',
    assignments: 'Einsatz planen',
    planning: 'Einsatz planen',
    live: 'Live-Status öffnen',
    proofs: 'Nachweise prüfen',
    budgets: 'Budgets öffnen',
    portals: 'Portale öffnen',
  },
  pflege: {
    sis: 'SIS anlegen',
    measures: 'Maßnahme planen',
    medication: 'Medikation anlegen',
    diagnoses: 'Diagnosen öffnen',
    wounds: 'BodyMap öffnen',
    vitals: 'Vitalwert erfassen',
    reports: 'Pflegebericht anlegen',
    treatment: 'Behandlung dokumentieren',
    handovers: 'Übergabe anlegen',
    risks: 'Risiken öffnen',
    evaluations: 'Evaluation anlegen',
    visits: 'Pflegevisite anlegen',
    deviations: 'Abweichung erfassen',
    'md-readiness': 'Prüfbereitschaft öffnen',
    quality: 'Kennzahlen öffnen',
    proofs: 'Leistungsnachweis anlegen',
    billing: 'Abrechnung prüfen',
    'invoice-foundations': 'Rechnungsgrundlage anlegen',
    acceptance: 'Gesamtabnahme öffnen',
    settings: 'Einstellungen öffnen',
  },
  stationaer: {
    residents: 'Bewohner:innen öffnen',
    wards: 'Belegung öffnen',
    shifts: 'Schichtplanung öffnen',
    handover: 'Übergabe öffnen',
    services: 'BodyMap öffnen',
    occupancy: 'Belegung öffnen',
  },
  beratung: {
    cases: 'Beratungsfall anlegen',
    appointments: 'Terminplanung öffnen',
    assessments: 'Erstgespräch starten',
    recommendations: 'Maßnahmen öffnen',
    proofs: 'Protokoll anlegen',
    'follow-up': 'Wiedervorlage anlegen',
  },
  akademie: {
    paths: 'Lernpfade öffnen',
    courses: 'Kurs anlegen',
    exams: 'Prüfungen öffnen',
    certificates: 'Zertifikate öffnen',
    mandatory: 'Pflichten öffnen',
  },
  platform: {
    tenants: 'Mandanten öffnen',
    plans: 'Tarife öffnen',
    billing: 'Abrechnung öffnen',
    flags: 'Feature Flags öffnen',
    support: 'Support öffnen',
    releases: 'Releases öffnen',
    audit: 'Audit öffnen',
  },
  settings: {
    organization: 'Organisation öffnen',
    roles: 'Rollen öffnen',
    integrations: 'Integrationen öffnen',
    privacy: 'Datenschutz öffnen',
    templates: 'Vorlagen öffnen',
    branding: 'Darstellung öffnen',
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

export function getLiquidPrimaryActionLabel(
  moduleKey: LiquidModuleKey,
  areaId: string,
): string | null {
  return primaryActionLabels[moduleKey]?.[areaId] ?? null;
}

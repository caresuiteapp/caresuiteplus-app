import type {
  DashboardActivity,
  DashboardKpi,
  DashboardQuickAction,
  DashboardSnapshot,
  DashboardStatusCard,
} from '@/types/dashboard';
import type { RoleKey } from '@/types';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import { buildOfficeAreaShortcuts, type OfficeAreaShortcut } from '@/lib/office/officeAreaShortcuts';
import {
  buildOfficeKpisFromMetrics,
  emptyOfficeDashboardMetrics,
} from '@/lib/office/officeDashboardMetrics';
import { demoAppointments, demoInvoices } from './seedCatalog';
import { demoClients } from './clients';
import { demoEmployees } from './employees';
import { demoTenant, DEMO_TENANT_ID } from './tenant';
import { demoTenantProducts } from './products';

const OFFICE_DEMO_KPIS = buildOfficeKpisFromMetrics({
  ...emptyOfficeDashboardMetrics(),
  activeClients: demoClients.filter((c) => c.status === 'aktiv').length,
  totalClients: demoClients.length,
  clientsInIntake: demoClients.filter((c) => c.status === 'in_bearbeitung').length,
  activeEmployees: demoEmployees.filter((e) => e.status === 'aktiv').length,
  totalEmployees: demoEmployees.length,
  openInvoices: demoInvoices.filter((i) => i.status === 'aktiv' || i.status === 'in_bearbeitung').length,
  draftInvoices: demoInvoices.filter((i) => i.status === 'entwurf').length,
  appointmentsThisWeek: demoAppointments.length,
  activeModules: demoTenantProducts.filter((p) => p.isActive).length,
  totalModules: demoTenantProducts.length,
  tableAvailability: {
    clients: true,
    employees: true,
    invoices: true,
    assignments: true,
    tasks: true,
    messages: true,
    modules: true,
    portalUsers: true,
    documents: true,
    portalRequests: true,
    serviceRecords: true,
    budgets: true,
    appointments: true,
  },
});

const OFFICE_KPIS: DashboardKpi[] = OFFICE_DEMO_KPIS;

const OFFICE_STATUS_CARDS: DashboardStatusCard[] = [
  {
    id: 'office-sc-invoices',
    title: 'Rechnungsentwürfe',
    description: 'Entwürfe warten auf Freigabe und Versand',
    status: 'entwurf',
    count: demoInvoices.filter((i) => i.status === 'entwurf').length,
  },
  {
    id: 'office-sc-clients',
    title: 'Klient:innen in Aufnahme',
    description: 'Stammdaten und Modulzuordnung prüfen',
    status: 'in_bearbeitung',
    count: demoClients.filter((c) => c.status === 'in_bearbeitung').length,
    sensitivity: 'care',
  },
  {
    id: 'office-sc-modules',
    title: 'Modulzuordnungen',
    description: `${demoTenantProducts.filter((p) => p.isActive).length} Module aktiv — Zuordnungen prüfen`,
    status: 'aktiv',
    count: demoTenantProducts.filter((p) => p.isActive).length,
    sensitivity: 'internal',
  },
];

const OFFICE_ACTIVITIES: DashboardActivity[] = [
  {
    id: 'office-act-1',
    icon: '👤',
    title: 'Klient:in aktualisiert',
    subtitle: 'Maria Wagner — Stammdaten geprüft',
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    status: 'abgeschlossen',
    type: 'client',
  },
  {
    id: 'office-act-2',
    icon: '🧾',
    title: 'Rechnung erstellt',
    subtitle: 'RE-2026-0341 · 1.245,00 €',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    status: 'entwurf',
    type: 'invoice',
  },
  {
    id: 'office-act-3',
    icon: '📅',
    title: 'Termin bestätigt',
    subtitle: 'Hausbesuch Frau Schneider',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    status: 'aktiv',
    type: 'system',
  },
  {
    id: 'office-act-4',
    icon: '📄',
    title: 'Dokument hochgeladen',
    subtitle: 'Pflegevertrag — zentrale Akte',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: 'abgeschlossen',
    type: 'document',
  },
];

const OFFICE_QUICK_ACTIONS_BASE: DashboardQuickAction[] = [
  {
    id: 'office-qa-client',
    label: 'Klient:in anlegen',
    icon: '➕',
    route: CLIENT_INTAKE_NEW_ROUTE,
    variant: 'primary',
  },
  {
    id: 'office-qa-invoice',
    label: 'Rechnungen',
    icon: '🧾',
    route: '/office/invoices',
    variant: 'secondary',
  },
  {
    id: 'office-qa-appointment',
    label: 'Termine',
    icon: '📅',
    route: '/office/appointments',
    variant: 'secondary',
  },
];

const OFFICE_QUICK_ACTIONS: DashboardQuickAction[] = [
  ...OFFICE_QUICK_ACTIONS_BASE,
  {
    id: 'office-qa-modules',
    label: 'Modulzuordnungen',
    icon: '🧩',
    route: '/business/office/modules',
    variant: 'secondary',
  },
  {
    id: 'office-qa-audit',
    label: 'Audit-Log',
    icon: '📋',
    route: '/business/office/audit-log',
    variant: 'secondary',
  },
];

export type { OfficeAreaShortcut } from '@/lib/office/officeAreaShortcuts';

const OFFICE_AREA_DEMO_COUNTS: Partial<Record<string, number>> = {
  clients: demoClients.length,
  employees: demoEmployees.length,
  invoices: demoInvoices.length,
  appointments: demoAppointments.length,
};

export const OFFICE_AREA_SHORTCUTS: OfficeAreaShortcut[] =
  buildOfficeAreaShortcuts(OFFICE_AREA_DEMO_COUNTS);

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function buildOfficeDashboard(roleKey: RoleKey): DashboardSnapshot {
  return {
    scope: 'office',
    roleKey,
    tenantName: demoTenant.name,
    tenantId: DEMO_TENANT_ID,
    greeting: getGreeting(),
    heroSubtitle: 'Office · Zentrale Verwaltung & Stammdaten',
    moduleLabel: 'CareSuite+ Office',
    primaryAction: OFFICE_QUICK_ACTIONS[0],
    kpis: OFFICE_KPIS,
    statusCards: OFFICE_STATUS_CARDS,
    quickActions: OFFICE_QUICK_ACTIONS,
    activities: OFFICE_ACTIVITIES,
    areaShortcuts: OFFICE_AREA_SHORTCUTS,
  };
}

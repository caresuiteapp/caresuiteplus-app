import type {
  DashboardActivity,
  DashboardKpi,
  DashboardQuickAction,
  DashboardSnapshot,
  DashboardStatusCard,
} from '@/types/dashboard';
import type { RoleKey } from '@/types';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import { OFFICE_NAV_AREAS, type OfficeNavArea } from '@/lib/navigation/officeNavigation';
import { demoAppointments, demoInvoices } from './seedCatalog';
import { demoClients } from './clients';
import { demoEmployees } from './employees';
import { demoTenant, DEMO_TENANT_ID } from './tenant';
import { demoTenantProducts } from './products';

const OFFICE_KPIS: DashboardKpi[] = [
  {
    id: 'office-kpi-clients',
    label: 'Aktive Klient:innen',
    value: demoClients.filter((c) => c.status === 'aktiv').length,
    subValue: `${demoClients.length} gesamt`,
    icon: '👥',
    accentColor: '#62F3FF',
    trend: 'up',
    trendValue: `${demoClients.filter((c) => c.status === 'in_bearbeitung').length} in Aufnahme`,
  },
  {
    id: 'office-kpi-employees',
    label: 'Mitarbeitende',
    value: demoEmployees.filter((e) => e.status === 'aktiv').length,
    subValue: `${demoEmployees.length} im Team`,
    icon: '👤',
    accentColor: '#FF9500',
  },
  {
    id: 'office-kpi-invoices',
    label: 'Offene Rechnungen',
    value: demoInvoices.filter((i) => i.status === 'aktiv' || i.status === 'in_bearbeitung').length,
    subValue: `${demoInvoices.filter((i) => i.status === 'entwurf').length} Entwürfe`,
    icon: '🧾',
    accentColor: '#FFD166',
    trend: 'neutral',
  },
  {
    id: 'office-kpi-appointments',
    label: 'Termine heute',
    value: demoAppointments.filter((a) => a.status === 'aktiv').length,
    subValue: `${demoAppointments.length} geplant`,
    icon: '📅',
    accentColor: '#7C5CFF',
  },
];

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

export type OfficeAreaShortcut = OfficeNavArea & {
  /** Alias for dashboard list rows that expect `title`. */
  title: string;
  /** Alias for dashboard list rows that expect `route`. */
  route: string;
  count?: number;
};

const OFFICE_AREA_DEMO_COUNTS: Partial<Record<string, number>> = {
  clients: demoClients.length,
  employees: demoEmployees.length,
  invoices: demoInvoices.length,
  appointments: demoAppointments.length,
};

export const OFFICE_AREA_SHORTCUTS: OfficeAreaShortcut[] = OFFICE_NAV_AREAS.map((area) => ({
  ...area,
  title: area.label,
  route: area.href,
  count: OFFICE_AREA_DEMO_COUNTS[area.id],
}));

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
  };
}

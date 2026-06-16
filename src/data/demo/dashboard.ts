import type {
  DashboardActivity,
  DashboardKpi,
  DashboardQuickAction,
  DashboardScope,
  DashboardSnapshot,
  DashboardStatusCard,
} from '@/types/dashboard';
import type { RoleKey } from '@/types';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { demoClients } from './clients';
import { DEMO_TENANT_ID, demoTenant } from './tenant';
import { demoTenantProducts } from './products';

export { WORKFLOW_STATUS_LABELS };

const activeClientCount = demoClients.filter((c) => c.status === 'aktiv').length;
const activeModuleCount = demoTenantProducts.filter((tp) => tp.isActive).length;

const BASE_KPIS: DashboardKpi[] = [
  {
    id: 'kpi-clients',
    label: 'Aktive Klient:innen',
    value: activeClientCount,
    subValue: `${demoClients.length} gesamt im Demo-Mandanten`,
    icon: '👥',
    accentColor: '#62F3FF',
    trend: 'up',
    trendValue: `${activeClientCount}`,
  },
  {
    id: 'kpi-assignments',
    label: 'Heutige Einsätze',
    value: 18,
    subValue: '2 noch offen',
    icon: '📅',
    accentColor: '#FF9500',
    trend: 'neutral',
  },
  {
    id: 'kpi-tasks',
    label: 'Offene Aufgaben',
    value: 7,
    subValue: '3 überfällig',
    icon: '✓',
    accentColor: '#7C5CFF',
    trend: 'down',
    trendValue: '3 überfällig',
  },
  {
    id: 'kpi-modules',
    label: 'Module aktiv',
    value: activeModuleCount,
    subValue: `von ${demoTenantProducts.length}`,
    icon: '⬡',
    accentColor: '#22C55E',
  },
];

const BILLING_KPIS: DashboardKpi[] = [
  {
    id: 'kpi-invoices-open',
    label: 'Offene Rechnungen',
    value: 12,
    subValue: '4.820 € offen',
    icon: '🧾',
    accentColor: '#FF9500',
  },
  {
    id: 'kpi-invoices-overdue',
    label: 'Überfällig',
    value: 3,
    subValue: 'Mahnung fällig',
    icon: '⚠️',
    accentColor: '#EF4444',
    trend: 'down',
  },
  {
    id: 'kpi-payments',
    label: 'Zahlungseingänge',
    value: '8.240 €',
    subValue: 'Diesen Monat',
    icon: '💶',
    accentColor: '#22C55E',
    trend: 'up',
    trendValue: '+12 %',
  },
  {
    id: 'kpi-clients-bill',
    label: 'Abrechnungsfälle',
    value: 31,
    icon: '📋',
    accentColor: '#62F3FF',
  },
];

const DISPATCH_KPIS: DashboardKpi[] = [
  {
    id: 'kpi-tours',
    label: 'Touren heute',
    value: 6,
    icon: '🚗',
    accentColor: '#FF9500',
  },
  {
    id: 'kpi-staff',
    label: 'Eingesetzte MA',
    value: 14,
    icon: '👤',
    accentColor: '#62F3FF',
  },
  {
    id: 'kpi-open-slots',
    label: 'Unbesetzte Slots',
    value: 2,
    subValue: 'Dringend',
    icon: '⏰',
    accentColor: '#EF4444',
  },
  {
    id: 'kpi-absence',
    label: 'Ausfälle',
    value: 1,
    icon: '🏥',
    accentColor: '#7C5CFF',
  },
];

const PORTAL_EMPLOYEE_KPIS: DashboardKpi[] = [
  {
    id: 'kpi-my-assignments',
    label: 'Meine Einsätze heute',
    value: 4,
    icon: '📅',
    accentColor: '#FF9500',
  },
  {
    id: 'kpi-docs-open',
    label: 'Dokumentation offen',
    value: 2,
    icon: '📝',
    accentColor: '#7C5CFF',
  },
  {
    id: 'kpi-messages',
    label: 'Neue Nachrichten',
    value: 3,
    icon: '💬',
    accentColor: '#62F3FF',
  },
  {
    id: 'kpi-km',
    label: 'Kilometer heute',
    value: '47 km',
    icon: '🚗',
    accentColor: '#22C55E',
  },
];

const PORTAL_CLIENT_KPIS: DashboardKpi[] = [
  {
    id: 'kpi-appointments',
    label: 'Nächste Termine',
    value: 2,
    icon: '📅',
    accentColor: '#FF9500',
  },
  {
    id: 'kpi-messages-client',
    label: 'Nachrichten',
    value: 1,
    icon: '💬',
    accentColor: '#62F3FF',
  },
  {
    id: 'kpi-documents',
    label: 'Freigegebene Dokumente',
    value: 5,
    icon: '📄',
    accentColor: '#7C5CFF',
  },
  {
    id: 'kpi-care-team',
    label: 'Betreuungsteam',
    value: 3,
    icon: '👥',
    accentColor: '#22C55E',
  },
];

const STATUS_CARDS_ADMIN: DashboardStatusCard[] = [
  {
    id: 'sc-invoices',
    title: 'Rechnungslauf März',
    description: '12 Rechnungen warten auf Freigabe',
    status: 'in_bearbeitung',
    count: 12,
    sensitivity: 'internal',
  },
  {
    id: 'sc-assignments',
    title: 'Einsatzplanung heute',
    description: '2 Einsätze noch nicht zugewiesen',
    status: 'aktiv',
    count: 2,
  },
  {
    id: 'sc-training',
    title: 'Pflichtschulungen',
    description: '4 Mitarbeitende mit überfälliger Schulung',
    status: 'fehlerhaft',
    count: 4,
    sensitivity: 'internal',
  },
];

const STATUS_CARDS_BILLING: DashboardStatusCard[] = [
  {
    id: 'sc-invoices-draft',
    title: 'Rechnungsentwürfe',
    description: '5 Entwürfe zur Prüfung',
    status: 'entwurf',
    count: 5,
  },
  {
    id: 'sc-reminders',
    title: 'Mahnungen',
    description: '3 Rechnungen überfällig',
    status: 'fehlerhaft',
    count: 3,
  },
  {
    id: 'sc-export',
    title: 'DATEV-Export',
    description: 'Letzter Export vor 2 Tagen',
    status: 'abgeschlossen',
  },
];

const STATUS_CARDS_PORTAL_EMP: DashboardStatusCard[] = [
  {
    id: 'sc-next',
    title: 'Nächster Einsatz',
    description: 'Frau Schneider, 14:00 Uhr',
    status: 'aktiv',
    sensitivity: 'care',
  },
  {
    id: 'sc-signature',
    title: 'Leistungsnachweis',
    description: 'Unterschrift von gestern ausstehend',
    status: 'in_bearbeitung',
  },
  {
    id: 'sc-training-emp',
    title: 'Pflichtunterweisung',
    description: 'Hygiene-Schulung bis 30.06.',
    status: 'aktiv',
  },
];

const STATUS_CARDS_PORTAL_CLIENT: DashboardStatusCard[] = [
  {
    id: 'sc-appointment',
    title: 'Hausbesuch morgen',
    description: 'Pflegefachkraft Keller, 10:00 Uhr',
    status: 'aktiv',
    sensitivity: 'care',
  },
  {
    id: 'sc-consent',
    title: 'Einwilligung',
    description: 'Datenfreigabe für Angehörige offen',
    status: 'entwurf',
  },
  {
    id: 'sc-document',
    title: 'Neuer Bericht',
    description: 'Pflegebericht März freigegeben',
    status: 'abgeschlossen',
    sensitivity: 'health',
  },
];

const ACTIVITIES_BUSINESS: DashboardActivity[] = [
  {
    id: 'act-1',
    icon: '👤',
    title: 'Neue Klientin angelegt',
    subtitle: 'Maria Wagner',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    status: 'abgeschlossen',
    type: 'client',
  },
  {
    id: 'act-2',
    icon: '📅',
    title: 'Einsatz zugewiesen',
    subtitle: 'Thomas Keller → Frau Schneider',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'aktiv',
    type: 'assignment',
  },
  {
    id: 'act-3',
    icon: '🧾',
    title: 'Rechnung erstellt',
    subtitle: 'RE-2026-0341 · 420,00 €',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    status: 'entwurf',
    type: 'invoice',
  },
  {
    id: 'act-4',
    icon: '💊',
    title: 'Vitalwerte erfasst',
    subtitle: 'Blutdruck — nur Pflege sichtbar',
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
    status: 'abgeschlossen',
    type: 'care',
  },
];

const ACTIVITIES_PORTAL_EMP: DashboardActivity[] = [
  {
    id: 'act-e1',
    icon: '✅',
    title: 'Einsatz abgeschlossen',
    subtitle: 'Herr Müller, 09:00–10:30',
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    status: 'abgeschlossen',
    type: 'assignment',
  },
  {
    id: 'act-e2',
    icon: '📝',
    title: 'Dokumentation gespeichert',
    subtitle: 'Betreuungsprotokoll',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    status: 'abgeschlossen',
    type: 'care',
  },
];

const ACTIVITIES_PORTAL_CLIENT: DashboardActivity[] = [
  {
    id: 'act-c1',
    icon: '📅',
    title: 'Termin bestätigt',
    subtitle: 'Hausbesuch am 13.06.',
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: 'aktiv',
    type: 'system',
  },
  {
    id: 'act-c2',
    icon: '📄',
    title: 'Dokument freigegeben',
    subtitle: 'Pflegebericht März',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: 'abgeschlossen',
    type: 'document',
  },
];

function getKpisForRole(roleKey: RoleKey, scope: DashboardScope): DashboardKpi[] {
  if (scope === 'portal_employee') return PORTAL_EMPLOYEE_KPIS;
  if (scope === 'portal_client' || scope === 'portal_family') return PORTAL_CLIENT_KPIS;
  if (roleKey === 'billing') return BILLING_KPIS;
  if (roleKey === 'dispatch') return DISPATCH_KPIS;
  return BASE_KPIS;
}

function getStatusCardsForRole(roleKey: RoleKey, scope: DashboardScope): DashboardStatusCard[] {
  if (scope === 'portal_employee') return STATUS_CARDS_PORTAL_EMP;
  if (scope === 'portal_client' || scope === 'portal_family') return STATUS_CARDS_PORTAL_CLIENT;
  if (roleKey === 'billing') return STATUS_CARDS_BILLING;
  return STATUS_CARDS_ADMIN;
}

function getActivitiesForScope(scope: DashboardScope): DashboardActivity[] {
  if (scope === 'portal_employee') return ACTIVITIES_PORTAL_EMP;
  if (scope === 'portal_client' || scope === 'portal_family') return ACTIVITIES_PORTAL_CLIENT;
  return ACTIVITIES_BUSINESS;
}

function getQuickActions(roleKey: RoleKey, scope: DashboardScope): DashboardQuickAction[] {
  if (scope === 'portal_employee') {
    return [
      {
        id: 'qa-assign',
        label: 'Einsätze',
        icon: '📅',
        route: '/portal/employee/assignments',
        variant: 'primary',
      },
      {
        id: 'qa-docs',
        label: 'Dokumente',
        icon: '📄',
        route: '/portal/employee/documents',
        variant: 'secondary',
      },
      {
        id: 'qa-msg',
        label: 'Nachrichten',
        icon: '💬',
        route: '/portal/employee/messages',
        variant: 'secondary',
      },
    ];
  }
  if (scope === 'portal_client') {
    return [
      {
        id: 'qa-appt',
        label: 'Termine',
        icon: '📅',
        route: '/portal/client/appointments',
        variant: 'primary',
      },
      {
        id: 'qa-docs',
        label: 'Dokumente',
        icon: '📄',
        route: '/portal/client/documents',
        variant: 'secondary',
      },
      {
        id: 'qa-msg',
        label: 'Nachrichten',
        icon: '💬',
        route: '/portal/client/messages',
        variant: 'secondary',
      },
    ];
  }
  if (scope === 'portal_family') {
    return [
      {
        id: 'qa-msg',
        label: 'Nachrichten',
        icon: '💬',
        route: '/portal/relative/messages',
        variant: 'primary',
      },
      {
        id: 'qa-info',
        label: 'Geteilte Informationen',
        icon: '📋',
        route: '/portal/relative',
        variant: 'secondary',
      },
    ];
  }
  const actions: DashboardQuickAction[] = [
    {
      id: 'qa-client-new',
      label: 'Klient:in anlegen',
      icon: '➕',
      route: CLIENT_INTAKE_NEW_ROUTE,
      variant: 'primary',
    },
    { id: 'qa-assign', label: 'Einsatz planen', icon: '📅', route: '/assist', variant: 'secondary' },
    { id: 'qa-clients-list', label: 'Klient:innenliste', icon: '👥', route: '/office/clients', variant: 'secondary' },
    { id: 'qa-invoice', label: 'Rechnung erstellen', icon: '🧾', route: '/office', variant: 'secondary' },
    { id: 'qa-employees', label: 'Mitarbeitende', icon: '👤', route: '/office/employees', variant: 'secondary' },
    { id: 'qa-messages', label: 'Nachrichten', icon: '💬', route: '/office/messages', variant: 'secondary' },
  ];
  if (roleKey === 'billing') {
    return [
      { id: 'qa-invoice', label: 'Rechnung erstellen', icon: '🧾', route: '/office', variant: 'primary' },
      { id: 'qa-export', label: 'Export', icon: '📤', variant: 'secondary' },
      { id: 'qa-remind', label: 'Mahnungen', icon: '⚠️', variant: 'secondary' },
    ];
  }
  if (roleKey === 'dispatch') {
    return [
      { id: 'qa-plan', label: 'Einsatzplan', icon: '📅', route: '/assist', variant: 'primary' },
      { id: 'qa-tour', label: 'Touren', icon: '🚗', variant: 'secondary' },
      { id: 'qa-staff', label: 'Verfügbarkeit', icon: '👥', variant: 'secondary' },
    ];
  }
  return actions;
}

function getPrimaryAction(roleKey: RoleKey, scope: DashboardScope): DashboardQuickAction {
  const actions = getQuickActions(roleKey, scope);
  return actions.find((a) => a.variant === 'primary') ?? actions[0];
}

function getGreeting(roleKey: RoleKey): string {
  const hour = new Date().getHours();
  const time = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  return time;
}

function getModuleLabel(scope: DashboardScope): string | undefined {
  if (scope === 'portal_employee') return 'Mitarbeiterportal';
  if (scope === 'portal_client') return 'Klient:innenportal';
  if (scope === 'portal_family') return 'Angehörigenportal';
  return undefined;
}

function getHeroSubtitle(scope: DashboardScope): string {
  if (scope === 'portal_employee') {
    return 'Ihre Einsätze und Dokumentation — portal-gefiltert.';
  }
  if (scope === 'portal_client') {
    return 'Termine und freigegebene Dokumente — portal-gefiltert.';
  }
  if (scope === 'portal_family') {
    return 'Geteilte Nachrichten und Informationen für Angehörige — portal-gefiltert.';
  }
  return `Mandant ${demoTenant.slug} · tenant_id: ${DEMO_TENANT_ID}`;
}

export function buildDemoDashboard(
  roleKey: RoleKey,
  scope: DashboardScope,
): DashboardSnapshot {
  return {
    scope,
    roleKey,
    tenantName: demoTenant.name,
    tenantId: DEMO_TENANT_ID,
    greeting: getGreeting(roleKey),
    heroSubtitle: getHeroSubtitle(scope),
    moduleLabel: getModuleLabel(scope),
    primaryAction: getPrimaryAction(roleKey, scope),
    kpis: getKpisForRole(roleKey, scope),
    statusCards: getStatusCardsForRole(roleKey, scope),
    quickActions: getQuickActions(roleKey, scope),
    activities: getActivitiesForScope(scope),
  };
}

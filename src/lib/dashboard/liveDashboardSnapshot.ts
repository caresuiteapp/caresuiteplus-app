import type {
  DashboardActivity,
  DashboardKpi,
  DashboardQuickAction,
  DashboardScope,
  DashboardSnapshot,
  DashboardStatusCard,
} from '@/types/dashboard';
import type { RoleKey } from '@/types';
import type { ClientPortalLiveMetrics } from '@/lib/portal/clientPortalDashboardLive';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import {
  buildBusinessKpisFromMetrics,
  emptyBusinessDashboardMetrics,
  type BusinessDashboardMetrics,
} from '@/lib/dashboard/businessDashboardMetrics';
import { buildZentraleModuleOverviewRows } from '@/lib/dashboard/zentraleModuleOverview';
import { getTenantModuleSettingsCache } from '@/lib/tenant/tenantModuleSettingsCache';
import {
  buildOfficeStatusCardsFromMetrics,
  emptyOfficeDashboardMetrics,
  type OfficeDashboardMetrics,
} from '@/lib/office/officeDashboardMetrics';
import { buildOfficeAreaShortcutsFromMetrics } from '@/lib/office/officeAreaShortcuts';
import { buildOfficeWorkspaceSnapshotFields } from '@/lib/office/officeDashboardWorkspace';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function getModuleLabel(scope: DashboardScope): string | undefined {
  if (scope === 'portal_employee') return 'Mitarbeiterportal';
  if (scope === 'portal_client') return 'Klient:innenportal';
  if (scope === 'portal_family') return 'Angehörigenportal';
  return undefined;
}

function getLiveHeroSubtitle(scope: DashboardScope, tenantName: string): string {
  if (scope === 'portal_employee') {
    return 'Ihre Einsätze und Dokumentation — portal-gefiltert.';
  }
  if (scope === 'portal_client') {
    return 'Termine und freigegebene Dokumente — portal-gefiltert.';
  }
  if (scope === 'portal_family') {
    return 'Geteilte Nachrichten und Informationen für Angehörige — portal-gefiltert.';
  }
  return `Mandant ${tenantName}`;
}

function getBusinessQuickActions(roleKey: RoleKey, scope: DashboardScope): DashboardQuickAction[] {
  if (scope === 'portal_employee') {
    return [
      { id: 'qa-assign', label: 'Einsätze', icon: '📅', route: '/portal/employee/assignments', variant: 'primary' },
      { id: 'qa-docs', label: 'Dokumente', icon: '📄', route: '/portal/employee/documents', variant: 'secondary' },
      { id: 'qa-msg', label: 'Nachrichten', icon: '💬', route: '/portal/employee/messages', variant: 'secondary' },
    ];
  }
  if (scope === 'portal_client') {
    return [
      { id: 'qa-appt', label: 'Termine', icon: '📅', route: '/portal/client/appointments', variant: 'primary' },
      { id: 'qa-docs', label: 'Dokumente', icon: '📄', route: '/portal/client/documents', variant: 'secondary' },
      { id: 'qa-msg', label: 'Nachrichten', icon: '💬', route: '/portal/client/messages', variant: 'secondary' },
    ];
  }
  if (scope === 'portal_family') {
    return [
      { id: 'qa-msg', label: 'Nachrichten', icon: '💬', route: '/portal/relative/messages', variant: 'primary' },
      { id: 'qa-info', label: 'Geteilte Informationen', icon: '📋', route: '/portal/relative', variant: 'secondary' },
    ];
  }
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
  return [
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
}

function getPrimaryAction(roleKey: RoleKey, scope: DashboardScope): DashboardQuickAction {
  const actions = getBusinessQuickActions(roleKey, scope);
  return actions.find((action) => action.variant === 'primary') ?? actions[0];
}

function buildClientPortalKpis(metrics?: ClientPortalLiveMetrics): DashboardKpi[] {
  const appointments = metrics?.upcomingAppointments ?? 0;
  const messages = metrics?.openMessages ?? 0;
  const documents = metrics?.documents ?? 0;

  return [
    {
      id: 'kpi-appointments',
      label: 'Nächste Termine',
      value: appointments,
      subValue: appointments === 0 ? 'Keine Termine' : `${appointments} anstehend`,
      icon: '📅',
      accentColor: '#FF9500',
    },
    {
      id: 'kpi-messages-client',
      label: 'Nachrichten',
      value: messages,
      subValue: messages === 0 ? 'Keine Nachrichten' : `${messages} Konversation${messages === 1 ? '' : 'en'}`,
      icon: '💬',
      accentColor: '#62F3FF',
    },
    {
      id: 'kpi-docs',
      label: 'Dokumente',
      value: documents,
      subValue: documents === 0 ? 'Keine Dokumente' : `${documents} freigegeben`,
      icon: '📄',
      accentColor: '#7C5CFF',
    },
  ];
}

function buildEmptyBusinessKpis(
  roleKey: RoleKey,
  scope: DashboardScope,
  portalMetrics?: ClientPortalLiveMetrics,
): DashboardKpi[] {
  if (scope === 'portal_employee') {
    return [
      { id: 'kpi-assignments', label: 'Meine Einsätze', value: 0, subValue: 'Keine Einsätze', icon: '📅', accentColor: '#FF9500' },
      { id: 'kpi-docs', label: 'Dokumente', value: 0, subValue: 'Keine Dokumente', icon: '📄', accentColor: '#62F3FF' },
    ];
  }
  if (scope === 'portal_client' || scope === 'portal_family') {
    return buildClientPortalKpis(portalMetrics);
  }
  if (roleKey === 'billing') {
    return [
      { id: 'kpi-invoices-open', label: 'Offene Rechnungen', value: 0, subValue: 'Keine offenen Rechnungen', icon: '🧾', accentColor: '#FF9500' },
      { id: 'kpi-invoices-overdue', label: 'Überfällig', value: 0, subValue: 'Keine überfälligen Rechnungen', icon: '⚠️', accentColor: '#EF4444' },
      { id: 'kpi-payments', label: 'Zahlungseingänge', value: 0, subValue: 'Noch keine Zahlungen', icon: '💶', accentColor: '#22C55E' },
      { id: 'kpi-clients-bill', label: 'Abrechnungsfälle', value: 0, subValue: 'Noch keine Fälle', icon: '📋', accentColor: '#62F3FF' },
    ];
  }
  if (roleKey === 'dispatch') {
    return [
      { id: 'kpi-tours', label: 'Touren heute', value: 0, subValue: 'Keine Touren geplant', icon: '🚗', accentColor: '#FF9500' },
      { id: 'kpi-assignments', label: 'Einsätze heute', value: 0, subValue: 'Keine Einsätze', icon: '📅', accentColor: '#62F3FF' },
      { id: 'kpi-open-slots', label: 'Offene Slots', value: 0, subValue: 'Keine offenen Slots', icon: '🕐', accentColor: '#7C5CFF' },
      { id: 'kpi-staff', label: 'Verfügbare MA', value: 0, subValue: 'Noch keine Mitarbeitende', icon: '👥', accentColor: '#22C55E' },
    ];
  }
  return [
    { id: 'kpi-clients', label: 'Aktive Klient:innen', value: 0, subValue: 'Noch keine Klient:innen', icon: '👥', accentColor: '#62F3FF' },
    { id: 'kpi-assignments', label: 'Heutige Einsätze', value: 0, subValue: 'Keine Einsätze geplant', icon: '📅', accentColor: '#FF9500' },
    { id: 'kpi-tasks', label: 'Offene Aufgaben', value: 0, subValue: 'Keine offenen Aufgaben', icon: '✓', accentColor: '#7C5CFF' },
    { id: 'kpi-modules', label: 'Module aktiv', value: 0, subValue: 'Noch keine Module aktiv', icon: '⬡', accentColor: '#22C55E' },
  ];
}

const EMPTY_ACTIVITIES: DashboardActivity[] = [];
const EMPTY_STATUS_CARDS: DashboardStatusCard[] = [];

export function buildLiveDashboardSnapshot(
  roleKey: RoleKey,
  scope: DashboardScope,
  tenantId: string,
  tenantName: string,
  businessMetrics: BusinessDashboardMetrics = emptyBusinessDashboardMetrics(),
  activities: DashboardActivity[] = EMPTY_ACTIVITIES,
  portalMetrics?: ClientPortalLiveMetrics,
): DashboardSnapshot {
  const isBusinessScope = scope === 'business';
  const kpis = isBusinessScope
    ? buildBusinessKpisFromMetrics(businessMetrics)
    : buildEmptyBusinessKpis(roleKey, scope, portalMetrics);

  const tenantModules = getTenantModuleSettingsCache(tenantId);
  const moduleOverviewRows = isBusinessScope
    ? buildZentraleModuleOverviewRows(businessMetrics, 'dark', 'kpi', {
        tenantId,
        roleKey,
        tenantModules,
      })
    : [];

  return {
    scope,
    roleKey,
    tenantName,
    tenantId,
    greeting: getGreeting(),
    heroSubtitle: getLiveHeroSubtitle(scope, tenantName),
    moduleLabel: getModuleLabel(scope),
    primaryAction: getPrimaryAction(roleKey, scope),
    kpis,
    ...(moduleOverviewRows.length > 0 ? { moduleOverviewRows } : {}),
    statusCards: EMPTY_STATUS_CARDS,
    quickActions: getBusinessQuickActions(roleKey, scope),
    activities,
  };
}

export function buildLiveOfficeDashboardSnapshot(
  roleKey: RoleKey,
  tenantId: string,
  tenantName: string,
  metrics: OfficeDashboardMetrics = emptyOfficeDashboardMetrics(),
  activities: DashboardActivity[] = EMPTY_ACTIVITIES,
): DashboardSnapshot {
  const statusCards = buildOfficeStatusCardsFromMetrics(metrics);
  const workspaceFields = buildOfficeWorkspaceSnapshotFields(metrics);

  return {
    scope: 'office',
    roleKey,
    tenantName,
    tenantId,
    greeting: getGreeting(),
    heroSubtitle: workspaceFields.heroSubtitle,
    moduleLabel: 'CareSuite+ Office',
    primaryAction: workspaceFields.primaryAction,
    kpis: workspaceFields.kpis,
    statusCards,
    quickActions: workspaceFields.quickActions,
    activities,
    areaShortcuts: buildOfficeAreaShortcutsFromMetrics(metrics),
  };
}

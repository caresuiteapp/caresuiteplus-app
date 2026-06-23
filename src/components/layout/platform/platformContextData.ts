import type { DashboardKpi } from '@/types/dashboard';
import type { MainModuleKey, ModuleNavConfig, ModuleNavItem } from '@/types/navigation/platform';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { OFFICE_SIDEBAR_QUICK_ACTIONS } from '@/lib/office/officeDashboardWorkspace';
import { PFLEGE_SIDEBAR_QUICK_ACTIONS } from '@/lib/pflege/pflegeDashboardWorkspace';
import { STATIONAER_SIDEBAR_QUICK_ACTIONS, buildStationaerOpenTasks } from '@/lib/stationaer/stationaerDashboardWorkspace';
import type { StationaerDashboardStats } from '@/types/modules/stationaer';
import { getModuleNavConfig } from '@/lib/navigation/modulenav';

export type ContextQuickAction = {
  label: string;
  icon: string;
  href: string;
};

export const OFFICE_QUICK_ACTIONS: ContextQuickAction[] = OFFICE_SIDEBAR_QUICK_ACTIONS.map((action) => ({
  label: action.label,
  icon:
    action.id === 'office-qa-client'
      ? 'addClient'
      : action.id === 'office-qa-employee'
        ? 'employeeBadge'
        : action.id === 'office-qa-appointment'
          ? 'calendar'
          : action.id === 'office-qa-document'
            ? 'uploadFolder'
            : action.id === 'office-qa-message'
              ? 'messageWave'
              : action.id === 'office-qa-broadcast'
                ? 'messageWave'
                : action.id === 'office-qa-portal'
                  ? 'portalGlobe'
                  : 'docsReview',
  href: action.route ?? '/office',
}));

export const ASSIST_QUICK_ACTIONS: ContextQuickAction[] = [
  { label: 'Einsatz planen', icon: 'calendar', href: '/assist/einsaetze/new' },
  { label: 'Live-Status', icon: 'livePulse', href: '/assist/live-status' },
  { label: 'Nachweise prüfen', icon: 'docsReview', href: '/assist/nachweise' },
  { label: 'Fahrtenbuch', icon: 'assignmentRoute', href: '/assist/fahrten' },
];

export const PFLEGE_QUICK_ACTIONS: ContextQuickAction[] = PFLEGE_SIDEBAR_QUICK_ACTIONS.map((action) => ({
  label: action.label,
  icon:
    action.id === 'pflege-qa-visit'
      ? 'calendar'
      : action.id === 'pflege-qa-doc'
        ? 'docsReview'
        : action.id === 'pflege-qa-vital'
          ? 'livePulse'
          : action.id === 'pflege-qa-measure'
            ? 'taskCheck'
            : action.id === 'pflege-qa-handover'
              ? 'messageWave'
              : action.id === 'pflege-qa-plan'
                ? 'uploadFolder'
                : action.id === 'pflege-qa-wound'
                  ? 'serviceRecord'
                  : 'insightScope',
  href: action.route ?? '/pflege',
}));

export const STATIONAER_QUICK_ACTIONS: ContextQuickAction[] = STATIONAER_SIDEBAR_QUICK_ACTIONS.map(
  (action) => ({
    label: action.label,
    icon:
      action.id === 'stationaer-qa-resident'
        ? 'addClient'
        : action.id === 'stationaer-qa-admission'
          ? 'calendar'
          : action.id === 'stationaer-qa-occupancy'
            ? 'serviceRecord'
            : action.id === 'stationaer-qa-rooms'
              ? 'uploadFolder'
              : action.id === 'stationaer-qa-handover'
                ? 'messageWave'
                : action.id === 'stationaer-qa-daily'
                  ? 'taskCheck'
                  : action.id === 'stationaer-qa-meals'
                    ? 'livePulse'
                    : 'insightScope',
    href: action.route ?? '/stationaer',
  }),
);

/** Expanded hub nav for Office right context panel — min. 5 items per group. */
export const officeContextPanelNav: ModuleNavConfig = {
  moduleKey: 'office',
  label: 'Zentrale',
  groups: [
    {
      title: 'Übersicht',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'kpiChart', href: '/business' },
        { key: 'messages', label: 'Nachrichten', icon: 'messageWave', href: '/business/messages' },
        { key: 'reporting', label: 'Reporting', icon: 'trendChart', href: '/business/reporting' },
        { key: 'calendar', label: 'Kalender', icon: 'calendar', href: '/office/calendar' },
        { key: 'tasks', label: 'Aufgaben & Vorgänge', icon: 'taskCheck', href: '/business/office/access/tasks' },
      ],
    },
    {
      title: 'Organisation',
      items: [
        { key: 'modules', label: 'Module & Lizenzen', icon: 'pluginCrystal', href: '/business/modules' },
        { key: 'connect', label: 'Connect & Integrationen', icon: 'connectPlug', href: '/business/connect' },
        { key: 'subscription', label: 'Abonnement', icon: 'subscriptionCard', href: '/business/subscription' },
        { key: 'tenant-settings', label: 'Mandant-Einstellungen', icon: 'gear', href: '/business/office/settings' },
        { key: 'team-roles', label: 'Team & Rollen', icon: 'teamRoles', href: '/business/office/access/roles' },
      ],
    },
    {
      title: 'Insight & QM',
      items: [
        { key: 'insight', label: 'InsightCenter', icon: 'insightScope', href: '/insight' },
        { key: 'qm', label: 'Qualitätsmanagement', icon: 'qmShield', href: '/business/qm' },
        { key: 'ops', label: 'Betrieb & Monitoring', icon: 'opsConsole', href: '/business/ops' },
        { key: 'audit-log', label: 'Audit-Log', icon: 'auditTrail', href: '/business/office/audit-log' },
        {
          key: 'live-monitor',
          label: 'Live-Monitor',
          icon: 'livePulse',
          href: '/business/office/admin/operations-monitoring',
        },
      ],
    },
  ],
};

/** Nav groups shown below Schnellaktionen in the right context panel (Office → business hub). */
export function resolveContextPanelNavConfig(mainModule: MainModuleKey): ModuleNavConfig {
  if (mainModule === 'office' || mainModule === 'zentrale') {
    return officeContextPanelNav;
  }
  return getModuleNavConfig(mainModule);
}

export function buildContextPanelNavItems(mainModule: MainModuleKey): ModuleNavItem[] {
  return resolveContextPanelNavConfig(mainModule).groups.flatMap((group) => group.items);
}

export const DEMO_MODULE_STATUS: Record<MainModuleKey, { label: string; status: string }[]> = {
  zentrale: [
    { label: 'Module aktiv', status: '3/6' },
    { label: 'Nachrichten', status: '2 neu' },
  ],
  office: [
    { label: 'Klient:innen', status: 'Aktiv' },
    { label: 'Abrechnung', status: 'Prüfen' },
  ],
  assist: [
    { label: 'Einsätze heute', status: '5' },
    { label: 'Nachweise', status: '2 offen' },
  ],
  pflege: [
    { label: 'Pflegepläne', status: 'Aktuell' },
    { label: 'Vitalwerte', status: '1 Warnung' },
  ],
  stationaer: [
    { label: 'Belegung', status: '92%' },
    { label: 'Übergaben', status: '1 offen' },
  ],
  beratung: [
    { label: 'Offene Fälle', status: '4' },
    { label: 'Wiedervorlagen', status: '2 heute' },
  ],
  akademie: [
    { label: 'Kurse aktiv', status: '6' },
    { label: 'Pflichtschulungen', status: '3 fällig' },
  ],
  admin: [
    { label: 'Benutzer', status: '12 aktiv' },
    { label: 'Integrationen', status: '2 verbunden' },
  ],
};

const DEMO_OPEN_TASKS = [
  { title: 'Offene Aufgaben', count: 2 },
  { title: 'Zu prüfen', count: 1 },
];

function findKpi(kpis: DashboardKpi[] | undefined, id: string): DashboardKpi | undefined {
  return kpis?.find((kpi) => kpi.id === id);
}

export function buildOfficeModuleStatusChips(
  kpis: DashboardKpi[] | undefined,
): { label: string; status: string }[] {
  const clientsKpi = findKpi(kpis, 'office-ws-kpi-clients-active') ?? findKpi(kpis, 'office-kpi-clients-active');
  const billingKpi = findKpi(kpis, 'office-ws-kpi-billing') ?? findKpi(kpis, 'office-kpi-invoices');
  const openBilling = Number(billingKpi?.value ?? 0);

  return [
    {
      label: 'Klient:innen',
      status:
        clientsKpi && Number(clientsKpi.value) > 0
          ? `${clientsKpi.value} aktiv`
          : 'Keine Klient:innen',
    },
    {
      label: 'Abrechnung',
      status: openBilling > 0 ? `${openBilling} offen` : 'Nichts offen',
    },
  ];
}

export function buildLiveModuleStatusChips(mainModule: MainModuleKey): { label: string; status: string }[] {
  return [{ label: 'Modul', status: mainModule === 'office' ? 'Office Live' : 'Live' }];
}

export function buildOpenTasks(
  mainModule: MainModuleKey,
  officeData: ReturnType<typeof useOfficeDashboard>['data'],
  isLive: boolean,
  stationaerStats?: StationaerDashboardStats | null,
): { title: string; count: number | string }[] {
  if (mainModule === 'stationaer') {
    return buildStationaerOpenTasks(stationaerStats);
  }

  if (mainModule === 'office' && officeData) {
    const cards = officeData.statusCards.slice(0, 3);
    if (cards.length > 0) {
      return cards.map((card) => ({
        title: card.title,
        count: card.count ?? 0,
      }));
    }
    if (isLive) {
      return [{ title: 'Keine offenen Vorgänge', count: 0 }];
    }
  }

  if (isLive) {
    return [{ title: 'Keine offenen Vorgänge', count: 0 }];
  }

  return DEMO_OPEN_TASKS;
}

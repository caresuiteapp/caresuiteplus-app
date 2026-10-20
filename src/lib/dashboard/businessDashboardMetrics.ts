import type { DashboardKpi } from '@/types/dashboard';

export type BusinessDashboardMetrics = {
  activeClients: number;
  totalClients: number;
  activeEmployees: number;
  totalEmployees: number;
  assignmentsToday: number;
  openInvoices: number;
  draftInvoices: number;
  openTasks: number;
  overdueTasks: number;
  unreadMessages: number;
  activeModules: number;
  totalModules: number;
  activePortalUsers: number;
  documentsForReview: number;
  openPortalRequests: number;
  openServiceRecords: number;
  executionBlockers: number;
  budgetWarnings: number;
  appointmentsThisWeek: number;
  appointmentsToday: number;
  newClients30Days: number;
  clientsInIntake: number;
  tableAvailability: {
    clients: boolean;
    employees: boolean;
    assignments: boolean;
    invoices: boolean;
    tasks: boolean;
    messages: boolean;
    modules: boolean;
    portalUsers: boolean;
    documents: boolean;
    portalRequests: boolean;
    serviceRecords: boolean;
    budgets: boolean;
    appointments: boolean;
  };
};

export function emptyBusinessDashboardMetrics(): BusinessDashboardMetrics {
  return {
    activeClients: 0,
    totalClients: 0,
    activeEmployees: 0,
    totalEmployees: 0,
    assignmentsToday: 0,
    openInvoices: 0,
    draftInvoices: 0,
    openTasks: 0,
    overdueTasks: 0,
    unreadMessages: 0,
    activeModules: 0,
    totalModules: 0,
    activePortalUsers: 0,
    documentsForReview: 0,
    openPortalRequests: 0,
    openServiceRecords: 0,
    executionBlockers: 0,
    budgetWarnings: 0,
    appointmentsThisWeek: 0,
    appointmentsToday: 0,
    newClients30Days: 0,
    clientsInIntake: 0,
    tableAvailability: {
      clients: false,
      employees: false,
      assignments: false,
      invoices: false,
      tasks: false,
      messages: false,
      modules: false,
      portalUsers: false,
      documents: false,
      portalRequests: false,
      serviceRecords: false,
      budgets: false,
      appointments: false,
    },
  };
}

function unavailableSubValue(label: string, available: boolean, emptyLabel: string): string {
  if (available) return emptyLabel;
  return `${label} nicht verfügbar`;
}

export function buildZentraleKpisFromMetrics(
  metrics: BusinessDashboardMetrics,
  idPrefix: 'kpi' | 'office-kpi' = 'kpi',
): DashboardKpi[] {
  const id = (suffix: string) => `${idPrefix}-${suffix}`;

  return [
    {
      id: id('clients-active'),
      label: 'Aktive Klient:innen',
      value: metrics.activeClients,
      subValue:
        metrics.totalClients > 0
          ? `${metrics.totalClients} gesamt`
          : unavailableSubValue('Klient:innen', metrics.tableAvailability.clients, 'Noch keine Klient:innen'),
      icon: 'teamGroup',
      accentColor: '#62F3FF',
      ...(metrics.clientsInIntake > 0
        ? { trend: 'up' as const, trendValue: `${metrics.clientsInIntake} in Aufnahme` }
        : {}),
    },
    {
      id: id('clients-total'),
      label: 'Klient:innen gesamt',
      value: metrics.totalClients,
      subValue:
        metrics.newClients30Days > 0
          ? `${metrics.newClients30Days} neu (30 Tage)`
          : unavailableSubValue('Klient:innen', metrics.tableAvailability.clients, 'Keine Klient:innen'),
      icon: 'clientsRoster',
      accentColor: '#7C5CFF',
    },
    {
      id: id('employees-active'),
      label: 'Mitarbeitende aktiv',
      value: metrics.activeEmployees,
      subValue:
        metrics.totalEmployees > 0
          ? `${metrics.totalEmployees} gesamt`
          : unavailableSubValue('Mitarbeitende', metrics.tableAvailability.employees, 'Noch keine Mitarbeitende'),
      icon: 'personSingle',
      accentColor: '#FF9500',
    },
    {
      id: id('employees-total'),
      label: 'Mitarbeitende gesamt',
      value: metrics.totalEmployees,
      subValue: unavailableSubValue(
        'Mitarbeitende',
        metrics.tableAvailability.employees,
        metrics.totalEmployees === 0 ? 'Noch keine Mitarbeitende' : `${metrics.activeEmployees} aktiv`,
      ),
      icon: 'employeeBadge',
      accentColor: '#FFD166',
    },
    {
      id: id('assignments'),
      label: 'Heutige Einsätze',
      value: metrics.assignmentsToday,
      subValue: unavailableSubValue(
        'Einsätze',
        metrics.tableAvailability.assignments,
        metrics.assignmentsToday === 0 ? 'Keine Einsätze geplant' : `${metrics.assignmentsToday} geplant`,
      ),
      icon: 'assignmentRoute',
      accentColor: '#FF9500',
      trend: 'neutral',
    },
    {
      id: id('invoices'),
      label: 'Offene Rechnungen',
      value: metrics.openInvoices,
      subValue:
        metrics.draftInvoices > 0
          ? `${metrics.draftInvoices} Entwürfe`
          : unavailableSubValue('Rechnungen', metrics.tableAvailability.invoices, 'Keine offenen Rechnungen'),
      icon: 'invoice',
      accentColor: '#FFD166',
      trend: 'neutral',
    },
    {
      id: id('tasks'),
      label: 'Offene Aufgaben',
      value: metrics.openTasks,
      subValue:
        metrics.overdueTasks > 0
          ? `${metrics.overdueTasks} überfällig`
          : unavailableSubValue('Aufgaben', metrics.tableAvailability.tasks, 'Keine offenen Aufgaben'),
      icon: 'taskTick',
      accentColor: '#7C5CFF',
      ...(metrics.overdueTasks > 0
        ? { trend: 'down' as const, trendValue: `${metrics.overdueTasks} überfällig` }
        : {}),
    },
    {
      id: id('messages'),
      label: 'Ungelesene Nachrichten',
      value: metrics.unreadMessages,
      subValue: unavailableSubValue(
        'Nachrichten',
        metrics.tableAvailability.messages,
        metrics.unreadMessages === 0 ? 'Keine ungelesenen Nachrichten' : `${metrics.unreadMessages} ungelesen`,
      ),
      icon: 'messageWave',
      accentColor: '#62F3FF',
    },
    {
      id: id('modules'),
      label: 'Module aktiv',
      value: metrics.activeModules,
      subValue:
        metrics.totalModules > 0
          ? `von ${metrics.totalModules}`
          : unavailableSubValue('Module', metrics.tableAvailability.modules, 'Noch keine Module aktiv'),
      icon: 'modulesActive',
      accentColor: '#22C55E',
    },
    {
      id: id('portal-users'),
      label: 'Portal-Nutzer aktiv',
      value: metrics.activePortalUsers,
      subValue: unavailableSubValue(
        'Portal-Nutzer',
        metrics.tableAvailability.portalUsers,
        metrics.activePortalUsers === 0 ? 'Keine Portal-Nutzer aktiv' : `${metrics.activePortalUsers} aktiv`,
      ),
      icon: 'portalGlobe',
      accentColor: '#06B6D4',
    },
    {
      id: id('documents-review'),
      label: 'Dokumente zur Prüfung',
      value: metrics.documentsForReview,
      subValue: unavailableSubValue(
        'Dokumente',
        metrics.tableAvailability.documents,
        metrics.documentsForReview === 0 ? 'Keine Dokumente zur Prüfung' : `${metrics.documentsForReview} offen`,
      ),
      icon: 'docsReview',
      accentColor: '#EC4899',
    },
    {
      id: id('portal-requests'),
      label: 'Offene Portal-Anfragen',
      value: metrics.openPortalRequests,
      subValue: unavailableSubValue(
        'Portal-Anfragen',
        metrics.tableAvailability.portalRequests,
        metrics.openPortalRequests === 0 ? 'Keine offenen Anfragen' : `${metrics.openPortalRequests} offen`,
      ),
      icon: 'portalInbox',
      accentColor: '#F97316',
    },
    {
      id: id('service-records'),
      label: 'Leistungsnachweise offen',
      value: metrics.openServiceRecords,
      subValue: unavailableSubValue(
        'Leistungsnachweise',
        metrics.tableAvailability.serviceRecords,
        metrics.openServiceRecords === 0 ? 'Keine offenen Nachweise' : `${metrics.openServiceRecords} in Prüfung`,
      ),
      icon: 'serviceRecord',
      accentColor: '#A855F7',
    },
    {
      id: id('budget-warnings'),
      label: 'Budget-Warnungen',
      value: metrics.budgetWarnings,
      subValue: unavailableSubValue(
        'Budgets',
        metrics.tableAvailability.budgets,
        metrics.budgetWarnings === 0 ? 'Keine Budget-Warnungen' : `${metrics.budgetWarnings} Warnung${metrics.budgetWarnings === 1 ? '' : 'en'}`,
      ),
      icon: 'budgetWarn',
      accentColor: '#EF4444',
    },
    {
      id: id('appointments-week'),
      label: 'Termine diese Woche',
      value: metrics.appointmentsThisWeek,
      subValue: unavailableSubValue(
        'Termine',
        metrics.tableAvailability.appointments,
        metrics.appointmentsThisWeek === 0 ? 'Keine Termine diese Woche' : `${metrics.appointmentsThisWeek} geplant`,
      ),
      icon: 'weekPlanner',
      accentColor: '#6366F1',
    },
    {
      id: id('clients-new'),
      label: 'Neue Klient:innen',
      value: metrics.newClients30Days,
      subValue: unavailableSubValue(
        'Klient:innen',
        metrics.tableAvailability.clients,
        metrics.newClients30Days === 0 ? 'Keine neuen Klient:innen' : `${metrics.newClients30Days} neu`,
      ),
      icon: 'sparkleNew',
      accentColor: '#14B8A6',
    },
  ];
}

export function buildBusinessKpisFromMetrics(metrics: BusinessDashboardMetrics): DashboardKpi[] {
  return buildZentraleKpisFromMetrics(metrics, 'kpi');
}

export const ZENTRALE_KPI_COUNT = 16;

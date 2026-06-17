import type { DashboardKpi } from '@/types/dashboard';

export type BusinessDashboardMetrics = {
  activeClients: number;
  totalClients: number;
  assignmentsToday: number;
  openAssignmentsToday: number;
  openTasks: number;
  overdueTasks: number;
  activeModules: number;
  totalModules: number;
  tableAvailability: {
    clients: boolean;
    assignments: boolean;
    tasks: boolean;
    modules: boolean;
  };
};

export function emptyBusinessDashboardMetrics(): BusinessDashboardMetrics {
  return {
    activeClients: 0,
    totalClients: 0,
    assignmentsToday: 0,
    openAssignmentsToday: 0,
    openTasks: 0,
    overdueTasks: 0,
    activeModules: 0,
    totalModules: 0,
    tableAvailability: {
      clients: false,
      assignments: false,
      tasks: false,
      modules: false,
    },
  };
}

export function buildBusinessKpisFromMetrics(metrics: BusinessDashboardMetrics): DashboardKpi[] {
  const clientSubValue =
    metrics.totalClients > 0
      ? `${metrics.totalClients} gesamt`
      : metrics.tableAvailability.clients
        ? 'Noch keine Klient:innen'
        : 'Klient:innen nicht verfügbar';

  const assignmentSubValue =
    metrics.assignmentsToday > 0
      ? metrics.openAssignmentsToday > 0
        ? `${metrics.openAssignmentsToday} noch offen`
        : 'Alle abgeschlossen'
      : metrics.tableAvailability.assignments
        ? 'Keine Einsätze geplant'
        : 'Einsätze nicht verfügbar';

  const taskSubValue =
    metrics.openTasks > 0
      ? metrics.overdueTasks > 0
        ? `${metrics.overdueTasks} überfällig`
        : 'Keine überfälligen Aufgaben'
      : metrics.tableAvailability.tasks
        ? 'Keine offenen Aufgaben'
        : 'Aufgaben nicht verfügbar';

  const moduleSubValue =
    metrics.totalModules > 0
      ? `von ${metrics.totalModules}`
      : metrics.tableAvailability.modules
        ? 'Noch keine Module aktiv'
        : 'Module nicht verfügbar';

  return [
    {
      id: 'kpi-clients',
      label: 'Aktive Klient:innen',
      value: metrics.activeClients,
      subValue: clientSubValue,
      icon: '👥',
      accentColor: '#62F3FF',
      ...(metrics.activeClients > 0 ? { trend: 'up' as const, trendValue: `${metrics.activeClients}` } : {}),
    },
    {
      id: 'kpi-assignments',
      label: 'Heutige Einsätze',
      value: metrics.assignmentsToday,
      subValue: assignmentSubValue,
      icon: '📅',
      accentColor: '#FF9500',
      trend: 'neutral',
    },
    {
      id: 'kpi-tasks',
      label: 'Offene Aufgaben',
      value: metrics.openTasks,
      subValue: taskSubValue,
      icon: '✓',
      accentColor: '#7C5CFF',
      ...(metrics.overdueTasks > 0
        ? { trend: 'down' as const, trendValue: `${metrics.overdueTasks} überfällig` }
        : {}),
    },
    {
      id: 'kpi-modules',
      label: 'Module aktiv',
      value: metrics.activeModules,
      subValue: moduleSubValue,
      icon: '⬡',
      accentColor: '#22C55E',
    },
  ];
}

import { describe, expect, it } from 'vitest';
import {
  buildBusinessKpisFromMetrics,
  emptyBusinessDashboardMetrics,
} from '@/lib/dashboard/businessDashboardMetrics';

describe('business dashboard metrics', () => {
  it('buildBusinessKpisFromMetrics zeigt Live-Kennzahlen für Helferhasen+', () => {
    const kpis = buildBusinessKpisFromMetrics({
      ...emptyBusinessDashboardMetrics(),
      activeClients: 1,
      totalClients: 1,
      assignmentsToday: 0,
      openTasks: 2,
      overdueTasks: 1,
      activeModules: 3,
      totalModules: 6,
      tableAvailability: {
        clients: true,
        assignments: true,
        tasks: true,
        modules: true,
      },
    });

    expect(kpis.find((kpi) => kpi.id === 'kpi-clients')?.value).toBe(1);
    expect(kpis.find((kpi) => kpi.id === 'kpi-clients')?.subValue).toBe('1 gesamt');
    expect(kpis.find((kpi) => kpi.id === 'kpi-assignments')?.value).toBe(0);
    expect(kpis.find((kpi) => kpi.id === 'kpi-tasks')?.value).toBe(2);
    expect(kpis.find((kpi) => kpi.id === 'kpi-tasks')?.trendValue).toBe('1 überfällig');
    expect(kpis.find((kpi) => kpi.id === 'kpi-modules')?.value).toBe(3);
    expect(kpis.find((kpi) => kpi.id === 'kpi-modules')?.subValue).toBe('von 6');
  });

  it('nutzt leere Platzhalter wenn Tabellen noch nicht verfügbar sind', () => {
    const kpis = buildBusinessKpisFromMetrics(emptyBusinessDashboardMetrics());

    expect(kpis.find((kpi) => kpi.id === 'kpi-clients')?.subValue).toBe('Klient:innen nicht verfügbar');
    expect(kpis.find((kpi) => kpi.id === 'kpi-assignments')?.subValue).toBe('Einsätze nicht verfügbar');
    expect(kpis.find((kpi) => kpi.id === 'kpi-tasks')?.subValue).toBe('Aufgaben nicht verfügbar');
    expect(kpis.find((kpi) => kpi.id === 'kpi-modules')?.subValue).toBe('Module nicht verfügbar');
  });
});

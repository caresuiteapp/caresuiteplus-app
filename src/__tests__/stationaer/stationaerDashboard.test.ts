import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { emptyStationaerDashboardStats } from '@/types/modules/stationaer';
import {
  STATIONAER_HEADER_PRIMARY_ACTIONS,
  STATIONAER_HEADER_SECONDARY_ACTIONS,
  STATIONAER_QUICK_ACCESS,
  STATIONAER_SIDEBAR_QUICK_ACTIONS,
  STATIONAER_WORKSPACE_KPI_COUNT,
  buildStationaerDashboardPriorities,
  buildStationaerDashboardSections,
  buildStationaerOpenTasks,
  buildStationaerWorkspaceKpis,
} from '@/lib/stationaer/stationaerDashboardWorkspace';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const SAMPLE_STATS = {
  ...emptyStationaerDashboardStats(),
  totalResidents: 12,
  activeCount: 10,
  newAdmissionsCount: 2,
  occupancyPercent: 83,
  handoverPendingCount: 1,
  freeBeds: 2,
  totalBeds: 10,
  admissionsToday: 1,
  admissionsThisWeek: 2,
  dischargesToday: 0,
  dischargesThisWeek: 1,
  openRoomAssignments: 1,
  activeLivingAreas: 4,
  openDailyStructureCount: 2,
  openMealPlanningCount: 1,
  openHandoversCount: 1,
  openHandoverReportsCount: 1,
  alertsCount: 3,
  openResidentPlanningCount: 2,
  roomConflictCount: 1,
};

describe('Stationaer dashboard workspace (UI Reality Fix)', () => {
  it('buildStationaerWorkspaceKpis liefert 12 Einrichtungs-KPIs mit Routen', () => {
    const kpis = buildStationaerWorkspaceKpis(SAMPLE_STATS);
    expect(kpis).toHaveLength(STATIONAER_WORKSPACE_KPI_COUNT);
    expect(kpis[0]?.label).toBe('Bewohner:innen aktuell');
    expect(kpis[1]?.label).toBe('Belegungsquote');
    expect(kpis[11]?.label).toBe('Auffälligkeiten / Hinweise');
    expect(kpis.every((k) => typeof k.route === 'string')).toBe(true);
    expect(kpis.find((k) => k.id === 'stationaer-ws-kpi-residents')?.route).toBe(
      '/stationaer/bewohner?status=aktiv',
    );
  });

  it('Prioritäten leiten aus Stats ab', () => {
    const priorities = buildStationaerDashboardPriorities(SAMPLE_STATS);
    expect(priorities.length).toBeGreaterThan(0);
    expect(priorities.some((p) => p.label === 'Zimmerkonflikte')).toBe(true);
    expect(buildStationaerDashboardPriorities(emptyStationaerDashboardStats())).toHaveLength(0);
  });

  it('Dashboard-Sektionen decken Einrichtungs-Workflow ab (A–E)', () => {
    const sections = buildStationaerDashboardSections(SAMPLE_STATS, []);
    expect(sections.some((s) => s.title === 'Bewohner:innen & Belegung')).toBe(true);
    expect(sections.some((s) => s.title === 'Wohnbereiche & Zimmer')).toBe(true);
    expect(sections.some((s) => s.title === 'Alltag & Versorgung')).toBe(true);
    expect(sections.some((s) => s.title === 'Übergabe & Berichte')).toBe(true);
    expect(sections.some((s) => s.title === 'Auswertungen')).toBe(true);
  });

  it('Header-Aktionen sind stationär-spezifisch', () => {
    expect(STATIONAER_HEADER_PRIMARY_ACTIONS.map((a) => a.label)).toEqual([
      'Bewohner:in anlegen',
      'Aufnahme starten',
    ]);
    expect(STATIONAER_HEADER_SECONDARY_ACTIONS.map((a) => a.label)).toEqual([
      'Belegung öffnen',
      'Übergabe schreiben',
      'Zimmerübersicht',
      'Tagesstruktur öffnen',
    ]);
  });

  it('Sidebar-Schnellaktionen ohne Office-Aktionen', () => {
    expect(STATIONAER_SIDEBAR_QUICK_ACTIONS).toHaveLength(8);
    const labels = STATIONAER_SIDEBAR_QUICK_ACTIONS.map((a) => a.label).join(' ');
    expect(labels).not.toContain('Klient anlegen');
    expect(labels).not.toContain('Mitarbeiter anlegen');
    expect(labels).not.toContain('Rechnung');
    expect(labels).toContain('Bewohner:in anlegen');
    expect(labels).toContain('Aufnahme starten');
  });

  it('Schnellzugriff nur Stationär-Routen', () => {
    expect(STATIONAER_QUICK_ACCESS).toHaveLength(11);
    const routes = STATIONAER_QUICK_ACCESS.map((a) => a.route).join(' ');
    expect(routes).not.toContain('/office');
    expect(routes).not.toContain('/pflege');
    expect(routes).not.toContain('/assist');
    expect(routes).toContain('/stationaer/belegung');
    expect(routes).toContain('/stationaer/mahlzeiten');
  });

  it('Heute-Aufgaben für Sidebar aus Stats', () => {
    const tasks = buildStationaerOpenTasks(SAMPLE_STATS);
    expect(tasks).toHaveLength(6);
    expect(tasks.some((t) => t.title === 'Neuaufnahmen')).toBe(true);
    expect(tasks.some((t) => t.title === 'Zimmerkonflikte')).toBe(true);
  });

  it('StationaerIndexScreen nutzt Einrichtungs-Cockpit statt CareLightModuleDashboard', () => {
    const source = readSrc('src/screens/stationaer/StationaerIndexScreen.tsx');
    expect(source).toContain('ModuleDashboardShell');
    expect(source).toContain('StationaerDashboardView');
    expect(source).toContain('Bewohner:innen, Belegung und Einrichtungsalltag im Überblick');
    expect(source).toContain("label: 'Stationär'");
    expect(source).not.toContain('CareLightModuleDashboard');
    expect(source).not.toContain('Klient anlegen');
    expect(source).not.toContain('Mitarbeiter anlegen');
  });

  it('StationaerDashboardView ist Einrichtungs-Cockpit', () => {
    const source = readSrc('src/components/dashboard/StationaerDashboardView.tsx');
    expect(source).toContain('Einrichtungsstatus heute');
    expect(source).toContain('Heute in der Einrichtung wichtig');
    expect(source).toContain('Schnellzugriff');
    expect(source).not.toContain('CareLightModuleDashboard');
    expect(source).not.toContain('Klient anlegen');
  });

  it('platformContextData mappt Stationär-Sidebar-Aktionen', () => {
    const source = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(source).toContain('STATIONAER_SIDEBAR_QUICK_ACTIONS');
    expect(source).toContain('STATIONAER_QUICK_ACTIONS');
    expect(source).toContain('buildStationaerOpenTasks');
  });

  it('rightcontextpanel nutzt Stationär-Quick-Actions', () => {
    const source = readSrc('src/components/layout/platform/rightcontextpanel.tsx');
    expect(source).toContain('STATIONAER_QUICK_ACTIONS');
    expect(source).toContain('useStationaerDashboard');
  });
});

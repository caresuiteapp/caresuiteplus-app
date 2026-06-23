import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { emptyBeratungDashboardStats } from '@/types/modules/beratung';
import {
  BERATUNG_HEADER_PRIMARY_ACTIONS,
  BERATUNG_HEADER_SECONDARY_ACTIONS,
  BERATUNG_QUICK_ACCESS,
  BERATUNG_SIDEBAR_QUICK_ACTIONS,
  BERATUNG_WORKSPACE_KPI_COUNT,
  buildBeratungDashboardPriorities,
  buildBeratungDashboardSections,
  buildBeratungOpenTasks,
  buildBeratungWorkspaceKpis,
} from '@/lib/beratung/beratungDashboardWorkspace';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const SAMPLE_STATS = {
  ...emptyBeratungDashboardStats(),
  totalCases: 12,
  openCount: 5,
  activeCount: 4,
  upcomingAppointmentsCount: 3,
  closedThisMonthCount: 2,
  newCasesCount: 2,
  appointmentsTodayCount: 1,
  openFirstConsultationsCount: 2,
  openProtocolsCount: 1,
  dueFollowUpsCount: 2,
  openCallbacksCount: 1,
  openRelativeContactsCount: 1,
  casesWithoutNextStepCount: 1,
  deadlinesEscalationsCount: 1,
  closedThisWeekCount: 1,
  openReportsCount: 1,
};

describe('Beratung dashboard workspace (UI Reality Fix)', () => {
  it('buildBeratungWorkspaceKpis liefert 12 Beratungs-KPIs mit Routen', () => {
    const kpis = buildBeratungWorkspaceKpis(SAMPLE_STATS);
    expect(kpis).toHaveLength(BERATUNG_WORKSPACE_KPI_COUNT);
    expect(kpis[0]?.label).toBe('Offene Fälle');
    expect(kpis[11]?.label).toBe('Berichte offen');
    expect(kpis.every((k) => typeof k.route === 'string')).toBe(true);
    expect(kpis.find((k) => k.id === 'beratung-ws-kpi-open-cases')?.route).toBe(
      '/beratung/cases?status=open',
    );
  });

  it('Prioritäten leiten aus Stats ab', () => {
    const priorities = buildBeratungDashboardPriorities(SAMPLE_STATS);
    expect(priorities.length).toBeGreaterThan(0);
    expect(priorities.some((p) => p.label === 'Wiedervorlagen fällig')).toBe(true);
    expect(buildBeratungDashboardPriorities(emptyBeratungDashboardStats())).toHaveLength(0);
  });

  it('Dashboard-Sektionen decken Beratungs-Workflow ab (A–F)', () => {
    const sections = buildBeratungDashboardSections(SAMPLE_STATS, []);
    expect(sections.some((s) => s.title === 'Aktuelle Fälle')).toBe(true);
    expect(sections.some((s) => s.title === 'Termine & Erstgespräche')).toBe(true);
    expect(sections.some((s) => s.title === 'Protokolle & Dokumentation')).toBe(true);
    expect(sections.some((s) => s.title === 'Wiedervorlagen & Fristen')).toBe(true);
    expect(sections.some((s) => s.title === 'Kontakt & Angehörige')).toBe(true);
    expect(sections.some((s) => s.title === 'Auswertungen & Berichte')).toBe(true);
    expect(sections).toHaveLength(6);
  });

  it('Header-Aktionen sind beratung-spezifisch', () => {
    expect(BERATUNG_HEADER_PRIMARY_ACTIONS.map((a) => a.label)).toEqual([
      'Fall anlegen',
      'Erstgespräch dokumentieren',
    ]);
    expect(BERATUNG_HEADER_SECONDARY_ACTIONS.map((a) => a.label)).toEqual([
      'Wiedervorlagen öffnen',
      'Protokoll schreiben',
      'Kontakt erfassen',
    ]);
  });

  it('Sidebar-Schnellaktionen ohne Office/Pflege/Stationär-Aktionen', () => {
    expect(BERATUNG_SIDEBAR_QUICK_ACTIONS).toHaveLength(8);
    const labels = BERATUNG_SIDEBAR_QUICK_ACTIONS.map((a) => a.label).join(' ');
    expect(labels).not.toContain('Klient anlegen');
    expect(labels).not.toContain('Mitarbeiter anlegen');
    expect(labels).not.toContain('Rechnung');
    expect(labels).not.toContain('Bewohner');
    expect(labels).toContain('Fall anlegen');
    expect(labels).toContain('Wiedervorlage setzen');
  });

  it('Schnellzugriff nur Beratung-Routen', () => {
    expect(BERATUNG_QUICK_ACCESS).toHaveLength(11);
    const routes = BERATUNG_QUICK_ACCESS.map((a) => a.route).join(' ');
    expect(routes).not.toContain('/office');
    expect(routes).not.toContain('/pflege');
    expect(routes).not.toContain('/assist');
    expect(routes).not.toContain('/stationaer');
    expect(routes).toContain('/beratung/protokolle');
    expect(routes).toContain('/beratung/wiedervorlagen');
  });

  it('Heute-Aufgaben für Sidebar aus Stats', () => {
    const tasks = buildBeratungOpenTasks(SAMPLE_STATS);
    expect(tasks).toHaveLength(6);
    expect(tasks.some((t) => t.title === 'Termine')).toBe(true);
    expect(tasks.some((t) => t.title === 'Fristen')).toBe(true);
  });

  it('BeratungIndexScreen nutzt Fall-Cockpit statt CareLightModuleDashboard', () => {
    const source = readSrc('src/screens/beratung/BeratungIndexScreen.tsx');
    expect(source).toContain('ModuleDashboardShell');
    expect(source).toContain('BeratungDashboardView');
    expect(source).toContain('Fälle, Protokolle und Wiedervorlagen im Überblick');
    expect(source).toContain("label: 'Beratung'");
    expect(source).not.toContain('CareLightModuleDashboard');
    expect(source).not.toContain('Klient anlegen');
    expect(source).not.toContain('Mitarbeiter anlegen');
  });

  it('BeratungDashboardView ist Beratungs-Cockpit', () => {
    const source = readSrc('src/components/dashboard/BeratungDashboardView.tsx');
    expect(source).toContain('Beratungsstatus heute');
    expect(source).toContain('Heute in der Beratung wichtig');
    expect(source).toContain('Schnellzugriff');
    expect(source).toContain("section.id === 'cases'");
    expect(source).not.toContain('CareLightModuleDashboard');
    expect(source).not.toContain('Klient anlegen');
  });

  it('platformContextData mappt Beratung-Sidebar-Aktionen', () => {
    const source = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(source).toContain('BERATUNG_SIDEBAR_QUICK_ACTIONS');
    expect(source).toContain('BERATUNG_QUICK_ACTIONS');
    expect(source).toContain('buildBeratungOpenTasks');
  });

  it('rightcontextpanel nutzt Beratung-Quick-Actions', () => {
    const source = readSrc('src/components/layout/platform/rightcontextpanel.tsx');
    expect(source).toContain('BERATUNG_QUICK_ACTIONS');
    expect(source).toContain('useBeratungDashboard');
  });
});

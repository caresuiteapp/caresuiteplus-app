import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { emptyAkademieDashboardStats } from '@/types/modules/akademie';
import {
  AKADEMIE_HEADER_PRIMARY_ACTIONS,
  AKADEMIE_HEADER_SECONDARY_ACTIONS,
  AKADEMIE_QUICK_ACCESS,
  AKADEMIE_SIDEBAR_QUICK_ACTIONS,
  AKADEMIE_WORKSPACE_KPI_COUNT,
  buildAkademieDashboardPriorities,
  buildAkademieDashboardSections,
  buildAkademieOpenTasks,
  buildAkademieWorkspaceKpis,
} from '@/lib/akademie/akademieDashboardWorkspace';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const SAMPLE_STATS = {
  ...emptyAkademieDashboardStats(),
  totalCourses: 12,
  activeCoursesCount: 8,
  upcomingCoursesCount: 3,
  runningCoursesCount: 2,
  mandatoryCount: 4,
  mandatoryOpenCount: 3,
  mandatoryOverdueCount: 1,
  totalEnrollments: 45,
  activeParticipantsCount: 18,
  openEnrollmentsCount: 12,
  openProgressCount: 7,
  upcomingStartsCount: 3,
  upcomingExamsCount: 4,
  examsToGradeCount: 2,
  certificatesToIssueCount: 3,
  certificatesExpiringCount: 1,
  mediathekOpenCount: 15,
  trainingPlanOpenCount: 5,
};

describe('Akademie dashboard workspace (UI Reality Fix)', () => {
  it('buildAkademieWorkspaceKpis liefert 14 Akademie-KPIs mit Routen', () => {
    const kpis = buildAkademieWorkspaceKpis(SAMPLE_STATS);
    expect(kpis).toHaveLength(AKADEMIE_WORKSPACE_KPI_COUNT);
    expect(kpis[0]?.label).toBe('Aktive Kurse');
    expect(kpis[13]?.label).toBe('Schulungsplan offen');
    expect(kpis.every((k) => typeof k.route === 'string')).toBe(true);
    expect(kpis.find((k) => k.id === 'akademie-ws-kpi-active-courses')?.route).toBe(
      '/akademie/courses?status=aktiv',
    );
  });

  it('Prioritäten leiten aus Stats ab', () => {
    const priorities = buildAkademieDashboardPriorities(SAMPLE_STATS);
    expect(priorities.length).toBeGreaterThan(0);
    expect(priorities.some((p) => p.label === 'Pflichtschulungen überfällig')).toBe(true);
    expect(buildAkademieDashboardPriorities(emptyAkademieDashboardStats())).toHaveLength(0);
  });

  it('Dashboard-Sektionen decken Lern-Workflow ab (A–G)', () => {
    const sections = buildAkademieDashboardSections(SAMPLE_STATS, []);
    expect(sections.some((s) => s.title === 'Kurse & Schulungen')).toBe(true);
    expect(sections.some((s) => s.title === 'Pflichtschulungen')).toBe(true);
    expect(sections.some((s) => s.title === 'Teilnehmer:innen & Fortschritt')).toBe(true);
    expect(sections.some((s) => s.title === 'Prüfungen')).toBe(true);
    expect(sections.some((s) => s.title === 'Zertifikate')).toBe(true);
    expect(sections.some((s) => s.title === 'Mediathek & Lernmaterial')).toBe(true);
    expect(sections.some((s) => s.title === 'Planung & Auswertung')).toBe(true);
    expect(sections).toHaveLength(7);
  });

  it('Header-Aktionen sind akademie-spezifisch', () => {
    expect(AKADEMIE_HEADER_PRIMARY_ACTIONS.map((a) => a.label)).toEqual([
      'Kurs anlegen',
      'Pflichtschulung planen',
    ]);
    expect(AKADEMIE_HEADER_SECONDARY_ACTIONS.map((a) => a.label)).toEqual([
      'Teilnehmer:innen öffnen',
      'Zertifikate prüfen',
      'Prüfung anlegen',
      'Mediathek öffnen',
    ]);
  });

  it('Sidebar-Schnellaktionen ohne Office/Pflege/Stationär-Aktionen', () => {
    expect(AKADEMIE_SIDEBAR_QUICK_ACTIONS).toHaveLength(8);
    const labels = AKADEMIE_SIDEBAR_QUICK_ACTIONS.map((a) => a.label).join(' ');
    expect(labels).not.toContain('Klient anlegen');
    expect(labels).not.toContain('Mitarbeiter anlegen');
    expect(labels).not.toContain('Rechnung');
    expect(labels).not.toContain('Bewohner');
    expect(labels).toContain('Kurs anlegen');
    expect(labels).toContain('Pflichtschulung planen');
  });

  it('Schnellzugriff nur Akademie-Routen', () => {
    expect(AKADEMIE_QUICK_ACCESS).toHaveLength(10);
    const routes = AKADEMIE_QUICK_ACCESS.map((a) => a.route).join(' ');
    expect(routes).not.toContain('/office');
    expect(routes).not.toContain('/pflege');
    expect(routes).not.toContain('/assist');
    expect(routes).not.toContain('/stationaer');
    expect(routes).not.toContain('/beratung');
    expect(routes).toContain('/akademie/pflichtschulungen');
    expect(routes).toContain('/akademie/zertifikate');
  });

  it('Heute-Aufgaben für Sidebar aus Stats', () => {
    const tasks = buildAkademieOpenTasks(SAMPLE_STATS);
    expect(tasks).toHaveLength(7);
    expect(tasks.some((t) => t.title === 'Kurse heute')).toBe(true);
    expect(tasks.some((t) => t.title === 'Pflichtschulungen fällig')).toBe(true);
    expect(tasks.some((t) => t.title === 'Materialien zur Prüfung')).toBe(true);
  });

  it('AkademieIndexScreen nutzt Lern-Cockpit statt CareLightModuleDashboard', () => {
    const source = readSrc('src/screens/akademie/AkademieIndexScreen.tsx');
    expect(source).toContain('ModuleDashboardShell');
    expect(source).toContain('AkademieDashboardView');
    expect(source).toContain('Kurse, Pflichtschulungen und Zertifikate im Überblick');
    expect(source).toContain("label: 'Akademie'");
    expect(source).not.toContain('CareLightModuleDashboard');
    expect(source).not.toContain('Klient anlegen');
    expect(source).not.toContain('Mitarbeiter anlegen');
  });

  it('AkademieDashboardView ist Lern-Cockpit', () => {
    const source = readSrc('src/components/dashboard/AkademieDashboardView.tsx');
    expect(source).toContain('Akademiestatus heute');
    expect(source).toContain('Heute in der Akademie wichtig');
    expect(source).toContain('Schnellzugriff');
    expect(source).toContain("section.id === 'courses'");
    expect(source).not.toContain('CareLightModuleDashboard');
    expect(source).not.toContain('Klient anlegen');
  });

  it('platformContextData mappt Akademie-Sidebar-Aktionen', () => {
    const source = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(source).toContain('AKADEMIE_SIDEBAR_QUICK_ACTIONS');
    expect(source).toContain('AKADEMIE_QUICK_ACTIONS');
    expect(source).toContain('buildAkademieOpenTasks');
  });

  it('rightcontextpanel nutzt Akademie-Quick-Actions', () => {
    const source = readSrc('src/components/layout/platform/rightcontextpanel.tsx');
    expect(source).toContain('AKADEMIE_QUICK_ACTIONS');
    expect(source).toContain('useAkademieDashboard');
  });
});

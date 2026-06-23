import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { emptyPflegeDashboardStats } from '@/types/modules/pflege';
import {
  PFLEGE_HEADER_PRIMARY_ACTIONS,
  PFLEGE_HEADER_SECONDARY_ACTIONS,
  PFLEGE_SIDEBAR_QUICK_ACTIONS,
  PFLEGE_WORKSPACE_KPI_COUNT,
  buildPflegeDashboardPriorities,
  buildPflegeDashboardSections,
  buildPflegeWorkspaceKpis,
} from '@/lib/pflege/pflegeDashboardWorkspace';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const SAMPLE_STATS = {
  ...emptyPflegeDashboardStats(),
  totalPlans: 8,
  activePlansCount: 5,
  visitsToday: 4,
  runningNow: 1,
  dueMeasuresCount: 3,
  openDocumentationCount: 2,
  dueVitalsCount: 2,
  abnormalVitalsCount: 1,
  openMedicationCount: 2,
  openWoundDocsCount: 1,
  openHandoversCount: 1,
  openSisAssessmentCount: 1,
  openReportsCount: 2,
  assignedClientsCount: 4,
  alertsCount: 1,
};

describe('Pflege dashboard workspace (UI Reality Fix)', () => {
  it('buildPflegeWorkspaceKpis liefert 12 Pflege-KPIs mit Routen', () => {
    const kpis = buildPflegeWorkspaceKpis(SAMPLE_STATS);
    expect(kpis).toHaveLength(PFLEGE_WORKSPACE_KPI_COUNT);
    expect(kpis[0]?.label).toBe('Pflegeeinsätze heute');
    expect(kpis[1]?.label).toBe('Läuft gerade');
    expect(kpis[11]?.label).toBe('Berichte offen');
    expect(kpis.every((k) => typeof k.route === 'string')).toBe(true);
    expect(kpis.find((k) => k.id === 'pflege-ws-kpi-active-plans')?.route).toBe(
      '/pflege/plans?status=aktiv',
    );
  });

  it('buildPflegeWorkspaceKpis mappt alle 12 Kennzahlen', () => {
    const kpis = buildPflegeWorkspaceKpis(SAMPLE_STATS);
    expect(kpis.some((k) => k.label === 'Auffällige Vitalwerte')).toBe(true);
    expect(kpis.some((k) => k.label === 'SIS/Assessment offen')).toBe(true);
  });

  it('Prioritäten leiten aus Stats ab', () => {
    const priorities = buildPflegeDashboardPriorities(SAMPLE_STATS);
    expect(priorities.length).toBeGreaterThan(0);
    expect(priorities.some((p) => p.label === 'Auffällige Vitalwerte')).toBe(true);
    expect(buildPflegeDashboardPriorities(emptyPflegeDashboardStats())).toHaveLength(0);
  });

  it('Dashboard-Sektionen decken Pflege-Workflow ab', () => {
    const sections = buildPflegeDashboardSections(SAMPLE_STATS, []);
    expect(sections.some((s) => s.title === 'Pflegeeinsätze & Dienstplanung')).toBe(true);
    expect(sections.some((s) => s.title === 'Zugeordnete Klient:innen')).toBe(true);
    expect(sections.length).toBeGreaterThanOrEqual(9);
  });

  it('Header-Aktionen sind pflege-spezifisch', () => {
    expect(PFLEGE_HEADER_PRIMARY_ACTIONS.map((a) => a.label)).toEqual([
      'Pflegeeinsatz planen',
      'Pflegedokumentation',
    ]);
    expect(PFLEGE_HEADER_SECONDARY_ACTIONS.map((a) => a.label)).toEqual([
      'Pflegepläne öffnen',
      'Vitalwerte erfassen',
      'Übergabe schreiben',
    ]);
  });

  it('Sidebar-Schnellaktionen ohne Office/Stationär-Aktionen', () => {
    expect(PFLEGE_SIDEBAR_QUICK_ACTIONS).toHaveLength(8);
    const labels = PFLEGE_SIDEBAR_QUICK_ACTIONS.map((a) => a.label).join(' ');
    expect(labels).not.toContain('Klient anlegen');
    expect(labels).not.toContain('Mitarbeiter anlegen');
    expect(labels).not.toContain('Bewohner');
    expect(labels).not.toContain('Rechnung');
    expect(labels).toContain('Pflegeeinsatz planen');
    expect(labels).toContain('SIS starten');
  });

  it('PflegeIndexScreen nutzt Verwaltungs-Cockpit statt CareLightModuleDashboard', () => {
    const source = readSrc('src/screens/pflege/PflegeIndexScreen.tsx');
    expect(source).toContain('ModuleDashboardShell');
    expect(source).toContain('PflegeDashboardView');
    expect(source).toContain('Pflegeplanung, Dokumentation und Maßnahmensteuerung');
    expect(source).toContain("label: 'Pflege'");
    expect(source).not.toContain('CareLightModuleDashboard');
    expect(source).not.toContain('Bewohner:innen');
    expect(source).not.toContain('/stationaer/bewohner');
  });

  it('PflegeDashboardView ist ambulantes Pflege-Cockpit', () => {
    const source = readSrc('src/components/dashboard/PflegeDashboardView.tsx');
    expect(source).toContain('Heute in der Pflege');
    expect(source).toContain('Heute pflegerisch wichtig');
    expect(source).toContain('Schnellzugriff');
    expect(source).toContain("section.id === 'clients'");
    expect(source).not.toContain('ModuleOverviewDashboard');
    expect(source).not.toContain('Bewohner:innen');
  });

  it('platformContextData mappt Pflege-Sidebar-Aktionen', () => {
    const source = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(source).toContain('PFLEGE_SIDEBAR_QUICK_ACTIONS');
    expect(source).toContain('PFLEGE_QUICK_ACTIONS');
    expect(source).not.toContain('Bewohner:innen');
  });
});

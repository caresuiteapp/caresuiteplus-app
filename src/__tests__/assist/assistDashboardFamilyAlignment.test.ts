import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EMPTY_ASSIST_DASHBOARD_STATS } from '@/lib/assist/assistDashboardService';
import {
  ASSIST_HEADER_PRIMARY_ACTIONS,
  ASSIST_QUICK_ACCESS,
  ASSIST_SIDEBAR_QUICK_ACTIONS,
  ASSIST_WORKSPACE_KPI_COUNT,
  buildAssistOpenTasks,
  buildAssistWorkspaceKpis,
} from '@/lib/assist/assistDashboardWorkspace';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const SAMPLE_STATS = {
  ...EMPTY_ASSIST_DASHBOARD_STATS,
  totalAssignments: 30,
  todayCount: 5,
  activeCount: 3,
  inProgressCount: 2,
  completedTodayCount: 1,
  upcomingCount: 12,
  atRiskCount: 3,
  incompleteCount: 4,
  openProofCount: 2,
  openProofReviewCount: 2,
  openSignatureCount: 1,
  openPortalReleaseCount: 1,
  openTripsCount: 2,
};

describe('Assist dashboard family alignment', () => {
  it('buildAssistWorkspaceKpis liefert 8 Assist-KPIs mit vollen Labels', () => {
    const kpis = buildAssistWorkspaceKpis(SAMPLE_STATS);
    expect(kpis).toHaveLength(ASSIST_WORKSPACE_KPI_COUNT);
    expect(kpis[0]?.label).toBe('Heute geplant');
    expect(kpis[1]?.label).toBe('Läuft gerade');
    expect(kpis[7]?.label).toBe('Fahrten offen');
    expect(kpis.some((k) => k.label.includes('TRACKING'))).toBe(false);
    expect(kpis.some((k) => k.label.includes('/'))).toBe(false);
    expect(kpis.every((k) => typeof k.route === 'string')).toBe(true);
  });

  it('buildAssistOpenTasks liefert heutige Assist-Aufgaben', () => {
    const tasks = buildAssistOpenTasks(SAMPLE_STATS);
    expect(tasks.some((t) => t.title === 'Heutige Einsätze')).toBe(true);
    expect(tasks.some((t) => t.title === 'Laufende Einsätze')).toBe(true);
    expect(tasks.some((t) => t.title === 'Dokumentation offen')).toBe(true);
    expect(tasks.some((t) => t.title === 'Signatur offen')).toBe(true);
    expect(tasks.some((t) => t.title === 'Nachweise zu prüfen')).toBe(true);
  });

  it('Header- und Sidebar-Aktionen sind assist-spezifisch', () => {
    expect(ASSIST_HEADER_PRIMARY_ACTIONS.map((a) => a.label)).toEqual(['Einsatz planen']);
    expect(ASSIST_SIDEBAR_QUICK_ACTIONS.map((a) => a.label)).toEqual([
      'Einsatz planen',
      'Live-Status',
      'Nachweis prüfen',
      'Aufgabenpaket',
    ]);
  });

  it('Schnellzugriff enthält 10 Assist-Bereiche ohne Office-Aktionen', () => {
    expect(ASSIST_QUICK_ACCESS).toHaveLength(10);
    const labels = ASSIST_QUICK_ACCESS.map((a) => a.label).join(' ');
    expect(labels).toContain('Einsätze');
    expect(labels).toContain('Zugeordnete Klient:innen');
    expect(labels).not.toContain('Klient anlegen');
    expect(labels).not.toContain('Mitarbeiter anlegen');
    expect(labels).not.toContain('Rechnung');
    expect(labels).not.toContain('K.6');
  });

  it('AssistIndexScreen nutzt ModuleDashboardShell und AssistDashboardView', () => {
    const source = readSrc('src/screens/assist/AssistIndexScreen.tsx');
    expect(source).toContain('ModuleDashboardShell');
    expect(source).toContain('AssistDashboardView');
    expect(source).toContain('Assist & Alltagsbegleitung');
    expect(source).toContain('Einsatzplanung, Durchführung und Leistungsnachweise');
    expect(source).toContain('ASSIST_HEADER_PRIMARY_ACTIONS');
    expect(source).toContain('Mandantenbezogen');
    expect(source).not.toContain('ScreenShell');
    expect(source).not.toContain('Live-Status öffnen');
    expect(source).not.toContain('Geschäftsführung');
    expect(source).not.toContain('AssistDashboardHero');
  });

  it('AssistDashboardView folgt Modul-Family-Layout', () => {
    const source = readSrc('src/components/dashboard/AssistDashboardView.tsx');
    expect(source).toContain('Kennzahlen');
    expect(source).toContain('Aktuelle Übersicht');
    expect(source).toContain('Heutige Einsätze');
    expect(source).toContain('Schnellzugriff');
    expect(source).toContain('Live-Aktivität');
    expect(source).toContain('AssistDashboardCheckpoints');
    expect(source).toContain('AssistSystemStatusCard compact');
    expect(source).toContain('bodyDesktop');
    expect(source).not.toContain('PremiumListHeroFrame');
  });

  it('platformContextData mappt Assist-Sidebar ohne Fahrtenbuch', () => {
    const source = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(source).toContain('ASSIST_SIDEBAR_QUICK_ACTIONS');
    expect(source).toContain('buildAssistOpenTasks');
    expect(source).not.toContain('Fahrtenbuch');
    expect(source).not.toContain('Klient anlegen');
  });

  it('AssistSystemStatusCard unterstützt kompakte Darstellung', () => {
    const source = readSrc('src/components/assist/AssistSystemStatusCard.tsx');
    expect(source).toContain('compact');
    expect(source).toContain('Systemstatus');
  });

  it('Offene Prüfpunkte-Section ist benannt', () => {
    const source = readSrc('src/components/assist/AssistDashboardCheckpoints.tsx');
    expect(source).toContain('Offene Prüfpunkte');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildAssistOperationsModel,
  pickAssistOperationsReadMetrics,
} from '@/lib/assist/assistOperationsModel';
import type { AssistDashboardStats, ActiveExecutionItem, AssignmentListItem } from '@/types/modules/assist';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const H4_ASSIST_FILES = [
  'src/screens/assist/AssistIndexScreen.tsx',
  'src/components/healthos/assist/HealthOSAssistOperationsView.tsx',
  'src/lib/assist/assistOperationsModel.ts',
];

const FORBIDDEN_IMPORTS = [
  '@/features/assistWorkflow',
  'finalizeVisit',
  'clientBudgetTransactionService',
  'wfmClockService',
  'wfmAssistAdapter',
  'saveVisitDocumentation',
  'fetchAssistExecutionProblems',
];

const RED_ZONE_FILES = [
  'src/features/assistWorkflow/finalizeVisit.ts',
  'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx',
];

const SAMPLE_STATS: AssistDashboardStats = {
  totalAssignments: 30,
  todayCount: 5,
  activeCount: 3,
  inProgressCount: 2,
  completedTodayCount: 4,
  upcomingCount: 12,
  atRiskCount: 2,
  incompleteCount: 3,
  openProofCount: 2,
  openProofReviewCount: 1,
  openSignatureCount: 1,
  openPortalReleaseCount: 1,
  openTripsCount: 0,
};

const SAMPLE_ACTIVE_EXECUTIONS: ActiveExecutionItem[] = [
  {
    assignmentId: 'a1',
    title: 'Morgenpflege Müller',
    clientName: 'Maria Müller',
    location: 'Hauptstraße 1',
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date().toISOString(),
    phase: 'in_progress',
    assignmentStatus: 'gestartet',
  },
  {
    assignmentId: 'a2',
    title: 'Betreuung Schmidt',
    clientName: 'Hans Schmidt',
    location: 'Gartenweg 3',
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date().toISOString(),
    phase: 'checked_in',
    assignmentStatus: 'angekommen',
  },
];

const SAMPLE_TODAY_ASSIGNMENTS: AssignmentListItem[] = [];

describe('HealthOS H4 Assist Operations Dashboard', () => {
  it('AssistIndexScreen uses HealthOSModuleShell and HealthOSAssistOperationsView', () => {
    const source = readSrc('src/screens/assist/AssistIndexScreen.tsx');
    expect(source).toContain('HealthOSModuleShell');
    expect(source).toContain('HealthOSAssistOperationsView');
    expect(source).toContain('testID="healthos-assist-operations-shell"');
    expect(source).toContain('useAssistDashboard');
    expect(source).toContain('useActiveExecutions');
    expect(source).not.toContain('ModuleDashboardShell');
    expect(source).not.toContain('AssistDashboardView');
  });

  it('AssistIndexScreen keeps AssistDataSourceBanner, ActionToolbar, permissions, wp258', () => {
    const source = readSrc('src/screens/assist/AssistIndexScreen.tsx');
    expect(source).toContain('AssistDataSourceBanner');
    expect(source).toContain('ActionToolbar');
    expect(source).toContain('usePermissions');
    expect(source).toContain('wp258A11y');
    expect(source).toContain('ASSIST_HEADER_PRIMARY_ACTIONS');
    expect(source).toContain('Mandantenbezogen');
  });

  it('view has healthos-assist-operations testID and German section titles', () => {
    const source = readSrc('src/components/healthos/assist/HealthOSAssistOperationsView.tsx');
    expect(source).toContain('healthos-assist-operations');
    expect(source).toContain('Einsatzbetrieb heute');
    expect(source).toContain('Live Operations');
    expect(source).toContain('Nachweise & Qualität');
    expect(source).toContain('Budget Assist Summary');
    expect(source).toContain('Blocker / Qualitätszentrale');
    expect(source).toContain('Schnellzugriffe');
  });

  it('view uses HealthOSMetricCard, loading, error, empty states', () => {
    const source = readSrc('src/components/healthos/assist/HealthOSAssistOperationsView.tsx');
    expect(source).toContain('HealthOSMetricCard');
    expect(source).toContain('HealthOSLoadingState');
    expect(source).toContain('HealthOSErrorState');
    expect(source).toContain('HealthOSEmptyState');
    expect(source).toContain('HealthOSStatusBadge');
  });

  it('buildAssistOperationsModel exposes all sections from sample stats', () => {
    const model = buildAssistOperationsModel({
      stats: SAMPLE_STATS,
      todayAssignments: SAMPLE_TODAY_ASSIGNMENTS,
      activeExecutions: SAMPLE_ACTIVE_EXECUTIONS,
      displayName: 'Test Koordination',
    });

    expect(model.einsatzbetriebHeute.length).toBeGreaterThanOrEqual(6);
    expect(model.nachweiseQualitaet.length).toBe(4);
    expect(model.budgetSummary.length).toBe(3);
    expect(model.schnellzugriffe.length).toBeGreaterThan(0);
    expect(model.greetingLine).toContain('Test Koordination');
  });

  it('buildAssistOperationsModel maps live executions with phase labels', () => {
    const model = buildAssistOperationsModel({
      stats: SAMPLE_STATS,
      todayAssignments: SAMPLE_TODAY_ASSIGNMENTS,
      activeExecutions: SAMPLE_ACTIVE_EXECUTIONS,
      displayName: 'Test',
    });

    expect(model.liveOperations.length).toBe(2);
    expect(model.liveOperations[0]?.phaseLabel).toBe('Läuft');
    expect(model.liveOperations[1]?.phaseLabel).toBe('Eingecheckt');
    expect(model.liveOperations[0]?.phaseLabel).not.toBe('in_progress');
    expect(model.liveOperations[1]?.phaseLabel).not.toBe('checked_in');
  });

  it('buildAssistOperationsModel derives blockers from stats counts', () => {
    const model = buildAssistOperationsModel({
      stats: SAMPLE_STATS,
      todayAssignments: SAMPLE_TODAY_ASSIGNMENTS,
      activeExecutions: [],
      displayName: 'Test',
    });

    const ids = model.blockerZentrale.map((b) => b.id);
    expect(ids).toContain('blocker-documentation');
    expect(ids).toContain('blocker-signature');
    expect(ids).toContain('blocker-proof');
    expect(ids).toContain('blocker-at-risk');
  });

  it('buildAssistOperationsModel shows no blockers for clean stats', () => {
    const cleanStats: AssistDashboardStats = {
      ...SAMPLE_STATS,
      incompleteCount: 0,
      openSignatureCount: 0,
      openProofCount: 0,
      atRiskCount: 0,
    };
    const model = buildAssistOperationsModel({
      stats: cleanStats,
      todayAssignments: SAMPLE_TODAY_ASSIGNMENTS,
      activeExecutions: [],
      displayName: 'Test',
    });
    expect(model.blockerZentrale.length).toBe(0);
  });

  it('budget summary uses placeholder "—" values with explanatory subValues', () => {
    const model = buildAssistOperationsModel({
      stats: SAMPLE_STATS,
      todayAssignments: SAMPLE_TODAY_ASSIGNMENTS,
      activeExecutions: [],
      displayName: 'Test',
    });
    for (const metric of model.budgetSummary) {
      expect(metric.value).toBe('—');
      expect(metric.subValue).toBeTruthy();
      expect(metric.subValue).not.toBe('');
    }
  });

  it('labels avoid raw snake_case technical keys', () => {
    const model = buildAssistOperationsModel({
      stats: SAMPLE_STATS,
      todayAssignments: SAMPLE_TODAY_ASSIGNMENTS,
      activeExecutions: [],
      displayName: 'Admin',
    });
    const labels = [
      ...model.einsatzbetriebHeute.map((m) => m.label),
      ...model.nachweiseQualitaet.map((m) => m.label),
      ...model.blockerZentrale.map((b) => b.label),
    ].join(' ');
    expect(labels).not.toMatch(/proof_missing|wfm_sync_failed|ended_missing|execution_status/);
    expect(labels).not.toContain('Coming Soon');
    expect(labels).not.toContain('pending');
    expect(labels).not.toContain('in_progress');
  });

  it('quick access uses existing Assist routes only', () => {
    const model = buildAssistOperationsModel({
      stats: SAMPLE_STATS,
      todayAssignments: SAMPLE_TODAY_ASSIGNMENTS,
      activeExecutions: [],
      displayName: 'Test',
    });
    for (const link of model.schnellzugriffe) {
      expect(link.route.startsWith('/')).toBe(true);
      expect(link.route).not.toContain('redirect');
      expect(link.route).toMatch(/^\/assist|^\/business/);
    }
  });

  it('pickAssistOperationsReadMetrics is read-only passthrough', () => {
    const picked = pickAssistOperationsReadMetrics(SAMPLE_STATS);
    expect(picked.todayCount).toBe(5);
    expect(picked.runningCount).toBe(5); // activeCount(3) + inProgressCount(2)
    expect(picked.completedTodayCount).toBe(4);
    expect(picked.atRiskCount).toBe(2);
    expect(picked.incompleteCount).toBe(3);
    expect(picked.openSignatureCount).toBe(1);
    expect(picked.openProofCount).toBe(2);
    expect(picked.openProofReviewCount).toBe(1);
    expect(picked.openPortalReleaseCount).toBe(1);
  });

  it.each(H4_ASSIST_FILES)('%s exists', (file) => {
    expect(() => readSrc(file)).not.toThrow();
  });

  it('H4 assist layer does not import P0 write services', () => {
    for (const file of H4_ASSIST_FILES) {
      const source = readSrc(file);
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source, `${file} must not import ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('red zone source files are unchanged (do not contain H4 HealthOS strings)', () => {
    for (const file of RED_ZONE_FILES) {
      const source = readSrc(file);
      expect(source).not.toContain('HealthOSAssistOperations');
      expect(source).not.toContain('AssistOperationsModel');
    }
  });

  it('AssistDashboardView legacy file is unchanged (not modified for H4)', () => {
    const source = readSrc('src/components/dashboard/AssistDashboardView.tsx');
    expect(source).toContain('Kennzahlen');
    expect(source).not.toContain('HealthOSAssistOperationsView');
    expect(source).not.toContain('buildAssistOperationsModel');
  });
});

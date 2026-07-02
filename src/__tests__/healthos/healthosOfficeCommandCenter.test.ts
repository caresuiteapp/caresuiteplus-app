import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildOfficeDashboard } from '@/data/demo/officeDashboard';
import {
  buildOfficeCommandCenterModel,
  pickOfficeCommandCenterReadMetrics,
} from '@/lib/office/officeCommandCenterModel';
import { emptyOfficeDashboardMetrics } from '@/lib/office/officeDashboardMetrics';
import { buildLiveOfficeDashboardSnapshot } from '@/lib/dashboard/liveDashboardSnapshot';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const H3_OFFICE_FILES = [
  'src/screens/office/OfficeIndexScreen.tsx',
  'src/components/healthos/office/HealthOSOfficeCommandCenterView.tsx',
  'src/lib/office/officeCommandCenterModel.ts',
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

describe('HealthOS H3 Office Command Center', () => {
  it('OfficeIndexScreen uses HealthOSModuleShell and Command Center view', () => {
    const source = readSrc('src/screens/office/OfficeIndexScreen.tsx');
    expect(source).toContain('HealthOSModuleShell');
    expect(source).toContain('HealthOSOfficeCommandCenterView');
    expect(source).toContain('useOfficeDashboard');
    expect(source).not.toContain('ModuleDashboardShell');
    expect(source).not.toContain('OfficeDashboardView');
  });

  it('command center view renders HealthOS sections', () => {
    const source = readSrc('src/components/healthos/office/HealthOSOfficeCommandCenterView.tsx');
    expect(source).toContain('healthos-office-command-center');
    expect(source).toContain('Betriebsstatus heute');
    expect(source).toContain('Qualitäts- und Blockerzentrum');
    expect(source).toContain('HealthOSMetricCard');
    expect(source).toContain('HealthOSLoadingState');
    expect(source).toContain('HealthOSErrorState');
    expect(source).toContain('HealthOSEmptyState');
  });

  it('buildOfficeCommandCenterModel exposes H3 sections from snapshot', () => {
    const snapshot = buildOfficeDashboard('business_admin');
    const model = buildOfficeCommandCenterModel(snapshot, 'Test Admin');
    expect(model.operationsToday.length).toBeGreaterThanOrEqual(4);
    expect(model.budgetSummary.length).toBe(3);
    expect(model.workforceSummary.length).toBe(2);
    expect(model.proofDocuments.length).toBe(3);
    expect(model.quickAccess.length).toBeGreaterThan(0);
    expect(model.greetingLine).toContain('Test Admin');
  });

  it('live office snapshot includes read-only officeReadMetrics', () => {
    const metrics = {
      ...emptyOfficeDashboardMetrics(),
      assignmentsToday: 5,
      executionBlockers: 1,
      budgetWarnings: 2,
      tableAvailability: {
        ...emptyOfficeDashboardMetrics().tableAvailability,
        assignments: true,
        budgets: true,
      },
    };
    const snapshot = buildLiveOfficeDashboardSnapshot(
      'business_admin',
      'tenant-1',
      'Test GmbH',
      metrics,
    );
    expect(snapshot.officeReadMetrics?.assignmentsToday).toBe(5);
    expect(snapshot.officeReadMetrics?.executionBlockers).toBe(1);
    expect(snapshot.officeReadMetrics?.budgetWarnings).toBe(2);
  });

  it('command center labels avoid raw technical snake_case keys', () => {
    const snapshot = buildOfficeDashboard('business_admin');
    const model = buildOfficeCommandCenterModel(snapshot, 'Admin');
    const labels = [
      ...model.operationsToday.map((m) => m.label),
      ...model.budgetSummary.map((m) => m.label),
      ...model.qualityBlockers.map((b) => b.label),
    ].join(' ');
    expect(labels).not.toMatch(/proof_missing|wfm_sync_failed|ended_missing/);
    expect(labels).not.toContain('Coming Soon');
  });

  it('quick access uses existing routes only', () => {
    const snapshot = buildOfficeDashboard('business_admin');
    const model = buildOfficeCommandCenterModel(snapshot, 'Admin');
    for (const link of model.quickAccess) {
      expect(link.route.startsWith('/')).toBe(true);
      expect(link.route).not.toContain('redirect');
    }
  });

  it.each(H3_OFFICE_FILES)('%s exists', (file) => {
    expect(() => readSrc(file)).not.toThrow();
  });

  it('H3 office layer does not import P0 write services', () => {
    for (const file of H3_OFFICE_FILES) {
      const source = readSrc(file);
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source, `${file} must not import ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('pickOfficeCommandCenterReadMetrics is read-only passthrough', () => {
    const picked = pickOfficeCommandCenterReadMetrics({
      ...emptyOfficeDashboardMetrics(),
      assignmentsToday: 3,
      budgetWarnings: 1,
    });
    expect(picked.assignmentsToday).toBe(3);
    expect(picked.budgetWarnings).toBe(1);
  });

  it('red zone source files were not modified for H3 HealthOS strings', () => {
    for (const file of RED_ZONE_FILES) {
      const source = readSrc(file);
      expect(source).not.toContain('HealthOSOfficeCommandCenter');
    }
  });
});

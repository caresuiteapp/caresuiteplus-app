import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildEmployeePortalTodayModel,
  pickEmployeePortalTodayReadMetrics,
} from '@/lib/portal/employee/employeePortalTodayModel';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const H5_EMPLOYEE_FILES = [
  'src/screens/portal/EmployeePortalDashboardScreen.tsx',
  'src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx',
  'src/lib/portal/employee/employeePortalTodayModel.ts',
];

const FORBIDDEN_IMPORTS = [
  '@/features/assistWorkflow',
  'finalizeVisit',
  'startService',
  'endService',
  'saveVisitDocumentation',
  'wfmClockService',
  'wfmAssistAdapter',
  'clientBudgetTransactionService',
];

const RED_ZONE_FILES = [
  'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx',
];

function makeSampleDashboard(
  overrides: Partial<EmployeePortalDashboardProjection> = {},
): EmployeePortalDashboardProjection {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).toISOString();
  return {
    todayAssignments: [
      {
        assignmentId: 'a1',
        title: 'Morgenpflege Müller',
        clientName: 'Maria Müller',
        clientId: 'c1',
        plannedStartAt: start,
        plannedEndAt: end,
        locationAddress: 'Hauptstraße 1',
        status: 'bestaetigt',
        canonicalStatus: 'bestaetigt',
        documentationPending: false,
        signaturePending: false,
        isLocked: false,
      },
      {
        assignmentId: 'a2',
        title: 'Abendpflege Schmidt',
        clientName: 'Hans Schmidt',
        clientId: 'c2',
        plannedStartAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0).toISOString(),
        plannedEndAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0).toISOString(),
        locationAddress: 'Gartenweg 3',
        status: 'geplant',
        canonicalStatus: 'geplant',
        documentationPending: false,
        signaturePending: false,
        isLocked: false,
      },
    ],
    upcomingAssignments: [],
    openTasks: [],
    openDocumentationCount: 2,
    missingSignatureCount: 1,
    messageCount: 3,
    ...overrides,
  };
}

const SAMPLE_DASHBOARD = makeSampleDashboard();

describe('HealthOS H5 Employee Portal Dashboard', () => {
  it('EmployeePortalDashboardScreen uses HealthOSEmployeePortalTodayView', () => {
    const source = readSrc('src/screens/portal/EmployeePortalDashboardScreen.tsx');
    expect(source).toContain('HealthOSEmployeePortalTodayView');
    expect(source).toContain('useEmployeePortalDashboard');
    expect(source).toContain('usePortalActor');
  });

  it('EmployeePortalDashboardScreen does not use legacy GlassCard or Aurora glass tokens', () => {
    const source = readSrc('src/screens/portal/EmployeePortalDashboardScreen.tsx');
    expect(source).not.toContain('GlassCard');
    expect(source).not.toContain('useAuroraGlassCardStyle');
    expect(source).not.toContain('ModuleDashboardShell');
  });

  it('view has healthos-employee-portal-today testID and German section titles', () => {
    const source = readSrc('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    expect(source).toContain('healthos-employee-portal-today');
    expect(source).toContain('Heute');
    expect(source).toContain('Meine Einsätze');
    expect(source).toContain('Meine Zeiten');
    expect(source).toContain('Offene Aufgaben');
    expect(source).toContain('Schnellzugriffe');
  });

  it('view uses HealthOSMetricCard, loading, error, empty states', () => {
    const source = readSrc('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    expect(source).toContain('HealthOSMetricCard');
    expect(source).toContain('HealthOSLoadingState');
    expect(source).toContain('HealthOSErrorState');
    expect(source).toContain('HealthOSEmptyState');
    expect(source).toContain('HealthOSStatusBadge');
  });

  it('view links to execute route for assignments without modifying execute screen', () => {
    const source = readSrc('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    expect(source).toContain('executeRoute');
    expect(source).toContain('detailRoute');
  });

  it('buildEmployeePortalTodayModel exposes all sections from sample data', () => {
    const model = buildEmployeePortalTodayModel({
      dashboard: SAMPLE_DASHBOARD,
      displayName: 'Test Mitarbeiter:in',
    });

    expect(model.tagesübersicht.length).toBe(4);
    expect(model.meineEinsaetze.length).toBe(2);
    expect(model.schnellzugriffe.length).toBeGreaterThan(0);
    expect(model.greetingLine).toContain('Test Mitarbeiter:in');
  });

  it('buildEmployeePortalTodayModel derives current assignment from today list', () => {
    const model = buildEmployeePortalTodayModel({
      dashboard: SAMPLE_DASHBOARD,
      displayName: 'Test',
    });
    expect(model.currentAssignment).not.toBeNull();
    expect(model.currentAssignment?.assignmentId).toBe('a1');
  });

  it('buildEmployeePortalTodayModel derives open tasks from counts', () => {
    const model = buildEmployeePortalTodayModel({
      dashboard: SAMPLE_DASHBOARD,
      displayName: 'Test',
    });

    const ids = model.offeneAufgaben.map((t) => t.id);
    expect(ids).toContain('task-documentation');
    expect(ids).toContain('task-signature');
  });

  it('buildEmployeePortalTodayModel shows no tasks when counts are zero', () => {
    const cleanDashboard = makeSampleDashboard({
      openDocumentationCount: 0,
      missingSignatureCount: 0,
    });
    const model = buildEmployeePortalTodayModel({
      dashboard: cleanDashboard,
      displayName: 'Test',
    });
    expect(model.offeneAufgaben.length).toBe(0);
  });

  it('tagesübersicht metrics have German labels and no raw technical strings', () => {
    const model = buildEmployeePortalTodayModel({
      dashboard: SAMPLE_DASHBOARD,
      displayName: 'Admin',
    });
    const labels = model.tagesübersicht.map((m) => m.label).join(' ');
    expect(labels).not.toMatch(/proof_missing|wfm_sync_failed|execution_status/);
    expect(labels).not.toContain('pending');
    expect(labels).not.toContain('in_progress');
    expect(labels).not.toContain('Coming Soon');
  });

  it('schnellzugriffe uses existing employee portal routes only', () => {
    const model = buildEmployeePortalTodayModel({
      dashboard: SAMPLE_DASHBOARD,
      displayName: 'Test',
    });
    for (const link of model.schnellzugriffe) {
      expect(link.route.startsWith('/')).toBe(true);
      expect(link.route).not.toContain('redirect');
      expect(link.route).toMatch(/^\/portal\/employee/);
    }
  });

  it('pickEmployeePortalTodayReadMetrics is read-only passthrough', () => {
    const picked = pickEmployeePortalTodayReadMetrics(SAMPLE_DASHBOARD);
    expect(picked.todayCount).toBe(2);
    expect(picked.openDocumentationCount).toBe(2);
    expect(picked.missingSignatureCount).toBe(1);
    expect(picked.messageCount).toBe(3);
    expect(typeof picked.hoursWorked).toBe('string');
    expect(picked.hoursWorked).toContain('Std.');
  });

  it.each(H5_EMPLOYEE_FILES)('%s exists', (file) => {
    expect(() => readSrc(file)).not.toThrow();
  });

  it('H5 employee layer does not import P0 write services', () => {
    for (const file of H5_EMPLOYEE_FILES) {
      const source = readSrc(file);
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source, `${file} must not import ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('red zone execute screen is unchanged (does not contain H5 HealthOS strings)', () => {
    for (const file of RED_ZONE_FILES) {
      const source = readSrc(file);
      expect(source).not.toContain('HealthOSEmployeePortalTodayView');
      expect(source).not.toContain('EmployeePortalTodayModel');
      expect(source).not.toContain('buildEmployeePortalTodayModel');
    }
  });

  it('meineEinsaetze contains execute and detail routes for each assignment', () => {
    const model = buildEmployeePortalTodayModel({
      dashboard: SAMPLE_DASHBOARD,
      displayName: 'Test',
    });
    for (const item of model.meineEinsaetze) {
      expect(item.executeRoute).toContain('/portal/employee/assignments/');
      expect(item.executeRoute).toContain('/execute');
      expect(item.detailRoute).toContain('/portal/employee/assignments/');
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { resetDemoEmployeePersonnelFileCache } from '@/data/demo/employeePersonnelFile';
import { resetAssignmentWorkflowStore } from '@/lib/assist/assignmentWorkflowService';
import { resetCompletionChainStore } from '@/lib/assist/assignmentCompletionChainService';
import { resetEmployeeTimeStore } from '@/lib/office/employeeTime/employeeTimeStore';
import { resetInventoryDemoStore, inventoryDemoRepository } from '@/lib/inventory/inventoryRepository.demo';
import {
  archiveOffboardingPersonnelFile,
  completeOffboardingFinalClearance,
  fetchOffboardingProgress,
  generateOffboardingCompletionProtocol,
  lockOffboardingPortalAccess,
  markOffboardingManualStep,
  prepareOffboardingExternalAccess,
  recordOffboardingReturn,
  resetEmployeeOffboardingStore,
  saveOffboardingExitDetails,
  startOffboardingSession,
} from '@/lib/office/offboarding';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { savePeriod } from '@/lib/office/employeeTime/employeeTimeStore';
import type { EmployeeTimePeriod } from '@/types/modules/employeeTime';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;
const EMPLOYEE = 'employee-001';
const EMPLOYEE_WITH_RETURNS = 'employee-006';
const PORTAL_USER = 'employee_portal' as const;

function seedLockedTimePeriod(employeeId: string): void {
  const now = new Date().toISOString();
  const period: EmployeeTimePeriod = {
    id: `test-period-${employeeId}`,
    tenantId: TENANT,
    employeeId,
    periodKind: 'monthly',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    totalAssignmentMinutes: 1200,
    totalTravelMinutes: 120,
    totalBreakMinutes: 60,
    totalPaidMinutes: 1260,
    totalUnpaidMinutes: 0,
    status: 'locked',
    approvedBy: 'hr-admin',
    approvedAt: now,
    exportedAt: now,
    lockedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  savePeriod(period);
}

function completeManualSteps(employeeId: string): void {
  markOffboardingManualStep(TENANT, employeeId, 'completion_documents', 'completed', undefined, ADMIN);
  markOffboardingManualStep(TENANT, employeeId, 'reference_prepared', 'completed', undefined, ADMIN);
}

describe('Mitarbeiter-Offboarding (Prompt 78)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetEmployeeOffboardingStore();
    resetDemoEmployeePersonnelFileCache();
    resetAssignmentWorkflowStore();
    resetCompletionChainStore();
    resetEmployeeTimeStore();
    resetInventoryDemoStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEmployeeOffboardingStore();
    resetDemoEmployeePersonnelFileCache();
    resetAssignmentWorkflowStore();
    resetCompletionChainStore();
    resetEmployeeTimeStore();
    resetInventoryDemoStore();
  });

  it('1. Offboarding starten setzt Status in_progress', () => {
    const result = startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.session.overallStatus).toBe('in_progress');
    expect(result.data.session.startedAt).toBeTruthy();
    expect(result.data.steps.length).toBe(20);
  });

  it('2. Austrittsdaten werden validiert und gespeichert', () => {
    startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    const invalid = saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '', terminationType: 'voluntary' },
      ADMIN,
    );
    expect(invalid.ok).toBe(false);

    const saved = saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      {
        exitDate: '2026-07-31',
        terminationType: 'voluntary',
        internalReason: 'Umzug',
      },
      ADMIN,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data.session.exitDate).toBe('2026-07-31');
    expect(getDemoEmployeePersonnelFile(EMPLOYEE)?.masterData.exitDate).toBe('2026-07-31');
  });

  it('3. Endfreigabe blockiert bei offenen Rückgaben', async () => {
    startOffboardingSession(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE_WITH_RETURNS,
      { exitDate: '2026-06-30', terminationType: 'contract_end' },
      ADMIN,
    );
    seedLockedTimePeriod(EMPLOYEE_WITH_RETURNS);
    lockOffboardingPortalAccess(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    prepareOffboardingExternalAccess(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    completeManualSteps(EMPLOYEE_WITH_RETURNS);

    const clearance = await completeOffboardingFinalClearance(
      TENANT,
      EMPLOYEE_WITH_RETURNS,
      ADMIN,
    );
    expect(clearance.ok).toBe(false);
    if (clearance.ok) return;
    expect(clearance.error).toContain('Rückgabe');
  });

  it('4. Rückgabe erfassen schließt Inventar-Blocker', () => {
    startOffboardingSession(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE_WITH_RETURNS,
      { exitDate: '2026-06-30', terminationType: 'contract_end' },
      ADMIN,
    );

    const file = getDemoEmployeePersonnelFile(EMPLOYEE_WITH_RETURNS);
    const materialId = file?.workMaterials[0]?.id;
    expect(materialId).toBeTruthy();

    const returned = recordOffboardingReturn(
      TENANT,
      EMPLOYEE_WITH_RETURNS,
      materialId!,
      ADMIN,
    );
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;

    const returnsCheck = returned.data.checks.find((c) => c.checkKey === 'open_returns');
    expect(returnsCheck?.status).toBe('passed');
  });

  it('5. Endfreigabe blockiert ohne gesperrtes Portal', async () => {
    startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '2026-07-31', terminationType: 'voluntary' },
      ADMIN,
    );
    seedLockedTimePeriod(EMPLOYEE);
    completeManualSteps(EMPLOYEE);

    const clearance = await completeOffboardingFinalClearance(TENANT, EMPLOYEE, ADMIN);
    expect(clearance.ok).toBe(false);
    if (clearance.ok) return;
    expect(clearance.error).toContain('Portal');
  });

  it('6. Portal-Sperre und externe Zugänge vorbereiten', () => {
    startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '2026-07-31', terminationType: 'voluntary' },
      ADMIN,
    );

    const portal = lockOffboardingPortalAccess(TENANT, EMPLOYEE, ADMIN);
    expect(portal.ok).toBe(true);
    if (!portal.ok) return;
    expect(getDemoEmployeePersonnelFile(EMPLOYEE)?.portalAccess.portalActive).toBe(false);

    const external = prepareOffboardingExternalAccess(TENANT, EMPLOYEE, ADMIN);
    expect(external.ok).toBe(true);
    if (!external.ok) return;
    expect(
      external.data.accessRevocations.filter((r) =>
        ['email', 'phone', 'cloud'].includes(r.kind),
      ).every((r) => r.status === 'prepared'),
    ).toBe(true);
  });

  it('7. Kein mandantenübergreifender Zugriff', () => {
    startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    const cross = fetchOffboardingProgress(OTHER_TENANT, EMPLOYEE, ADMIN);
    expect(cross.ok).toBe(false);
  });

  it('8. Unberechtigte Rollen sehen keine Personalakte', () => {
    const denied = fetchOffboardingProgress(
      TENANT,
      EMPLOYEE,
      PORTAL_USER,
      { employeeId: 'employee-002' },
    );
    expect(denied.ok).toBe(false);
  });

  it('9. Produktionsmodus blockiert Demo-Fallback', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const result = startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Live-Modus|Demo-Daten im Produktionsmodus/);
  });

  it('10. Vollständiger Abschluss: Protokoll, Endfreigabe, Archivierung', async () => {
    startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '2026-07-31', terminationType: 'retirement' },
      ADMIN,
    );
    seedLockedTimePeriod(EMPLOYEE);
    recordOffboardingReturn(TENANT, EMPLOYEE, `wm-uniform-${EMPLOYEE}`, ADMIN);
    inventoryDemoRepository.updateAssignment(TENANT, 'inv-asg-001', { status: 'returned' });
    lockOffboardingPortalAccess(TENANT, EMPLOYEE, ADMIN);
    prepareOffboardingExternalAccess(TENANT, EMPLOYEE, ADMIN);
    completeManualSteps(EMPLOYEE);

    const protocol = generateOffboardingCompletionProtocol(TENANT, EMPLOYEE, ADMIN);
    expect(protocol.ok).toBe(true);

    const clearance = await completeOffboardingFinalClearance(TENANT, EMPLOYEE, ADMIN);
    expect(clearance.ok).toBe(true);
    if (!clearance.ok) return;
    expect(clearance.data.clearance?.clearedAt).toBeTruthy();

    const archived = archiveOffboardingPersonnelFile(TENANT, EMPLOYEE, ADMIN);
    expect(archived.ok).toBe(true);
    if (!archived.ok) return;
    expect(archived.data.session.overallStatus).toBe('completed');
    expect(getDemoEmployeePersonnelFile(EMPLOYEE)?.employment.employmentStatus).toBe('archived');
  });
});

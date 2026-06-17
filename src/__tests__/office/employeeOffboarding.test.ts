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
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import type { EmployeeTimePeriod } from '@/types/modules/employeeTime';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;
const EMPLOYEE = 'employee-001';
const EMPLOYEE_WITH_RETURNS = 'employee-006';
const PORTAL_USER = 'employee_portal' as const;
const LIVE_TENANT_ID = '22222222-2222-4222-8222-222222222222';
const LIVE_EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111';

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

async function completeManualSteps(employeeId: string): Promise<void> {
  await markOffboardingManualStep(TENANT, employeeId, 'completion_documents', 'completed', undefined, ADMIN);
  await markOffboardingManualStep(TENANT, employeeId, 'reference_prepared', 'completed', undefined, ADMIN);
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

  it('1. Offboarding starten setzt Status in_progress', async () => {
    const result = await startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.session.overallStatus).toBe('in_progress');
    expect(result.data.session.startedAt).toBeTruthy();
    expect(result.data.steps.length).toBe(20);
    expect(result.data.employeeName).toContain('Keller');
  });

  it('2. Austrittsdaten werden validiert und gespeichert', async () => {
    await startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    const invalid = await saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '', terminationType: 'voluntary' },
      ADMIN,
    );
    expect(invalid.ok).toBe(false);

    const saved = await saveOffboardingExitDetails(
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
    await startOffboardingSession(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    await saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE_WITH_RETURNS,
      { exitDate: '2026-06-30', terminationType: 'contract_end' },
      ADMIN,
    );
    seedLockedTimePeriod(EMPLOYEE_WITH_RETURNS);
    await lockOffboardingPortalAccess(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    await prepareOffboardingExternalAccess(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    await completeManualSteps(EMPLOYEE_WITH_RETURNS);

    const clearance = await completeOffboardingFinalClearance(
      TENANT,
      EMPLOYEE_WITH_RETURNS,
      ADMIN,
    );
    expect(clearance.ok).toBe(false);
    if (clearance.ok) return;
    expect(clearance.error).toContain('Rückgabe');
  });

  it('4. Rückgabe erfassen schließt Inventar-Blocker', async () => {
    await startOffboardingSession(TENANT, EMPLOYEE_WITH_RETURNS, ADMIN);
    await saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE_WITH_RETURNS,
      { exitDate: '2026-06-30', terminationType: 'contract_end' },
      ADMIN,
    );

    const file = getDemoEmployeePersonnelFile(EMPLOYEE_WITH_RETURNS);
    const materialId = file?.workMaterials[0]?.id;
    expect(materialId).toBeTruthy();

    const returned = await recordOffboardingReturn(
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
    await startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    await saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '2026-07-31', terminationType: 'voluntary' },
      ADMIN,
    );
    seedLockedTimePeriod(EMPLOYEE);
    await completeManualSteps(EMPLOYEE);

    const clearance = await completeOffboardingFinalClearance(TENANT, EMPLOYEE, ADMIN);
    expect(clearance.ok).toBe(false);
    if (clearance.ok) return;
    expect(clearance.error).toContain('Portal');
  });

  it('6. Portal-Sperre und externe Zugänge vorbereiten', async () => {
    await startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    await saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '2026-07-31', terminationType: 'voluntary' },
      ADMIN,
    );

    const portal = await lockOffboardingPortalAccess(TENANT, EMPLOYEE, ADMIN);
    expect(portal.ok).toBe(true);
    if (!portal.ok) return;
    expect(getDemoEmployeePersonnelFile(EMPLOYEE)?.portalAccess.portalActive).toBe(false);

    const external = await prepareOffboardingExternalAccess(TENANT, EMPLOYEE, ADMIN);
    expect(external.ok).toBe(true);
    if (!external.ok) return;
    expect(
      external.data.accessRevocations.filter((r) =>
        ['email', 'phone', 'cloud'].includes(r.kind),
      ).every((r) => r.status === 'prepared'),
    ).toBe(true);
  });

  it('7. Kein mandantenübergreifender Zugriff', async () => {
    await startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    const cross = await fetchOffboardingProgress(OTHER_TENANT, EMPLOYEE, ADMIN);
    expect(cross.ok).toBe(false);
  });

  it('8. Unberechtigte Rollen sehen keine Personalakte', async () => {
    const denied = await fetchOffboardingProgress(
      TENANT,
      EMPLOYEE,
      PORTAL_USER,
      { employeeId: 'employee-002' },
    );
    expect(denied.ok).toBe(false);
  });

  it('9. Live-Supabase lädt Mitarbeitende über Repository statt Demo-Personalakte', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const getById = vi.spyOn(employeeSupabaseRepository, 'getById').mockResolvedValue({
      ok: true,
      data: {
        id: LIVE_EMPLOYEE_ID,
        tenantId: LIVE_TENANT_ID,
        firstName: 'Mhi Aldeen',
        lastName: 'Al Jlelati',
        jobTitle: 'Pflegefachkraft',
        email: 'mhi@example.com',
        phone: '',
        status: 'active',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    });

    const result = await fetchOffboardingProgress(LIVE_TENANT_ID, LIVE_EMPLOYEE_ID, ADMIN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.employeeName).toBe('Mhi Aldeen Al Jlelati');
    expect(result.data.steps.length).toBe(20);
    expect(getById).toHaveBeenCalledWith(LIVE_TENANT_ID, LIVE_EMPLOYEE_ID);

    getById.mockRestore();
  });

  it('10. Vollständiger Abschluss: Protokoll, Endfreigabe, Archivierung', async () => {
    await startOffboardingSession(TENANT, EMPLOYEE, ADMIN);
    await saveOffboardingExitDetails(
      TENANT,
      EMPLOYEE,
      { exitDate: '2026-07-31', terminationType: 'retirement' },
      ADMIN,
    );
    seedLockedTimePeriod(EMPLOYEE);
    await recordOffboardingReturn(TENANT, EMPLOYEE, `wm-uniform-${EMPLOYEE}`, ADMIN);
    inventoryDemoRepository.updateAssignment(TENANT, 'inv-asg-001', { status: 'returned' });
    await lockOffboardingPortalAccess(TENANT, EMPLOYEE, ADMIN);
    await prepareOffboardingExternalAccess(TENANT, EMPLOYEE, ADMIN);
    await completeManualSteps(EMPLOYEE);

    const protocol = await generateOffboardingCompletionProtocol(TENANT, EMPLOYEE, ADMIN);
    expect(protocol.ok).toBe(true);

    const clearance = await completeOffboardingFinalClearance(TENANT, EMPLOYEE, ADMIN);
    expect(clearance.ok).toBe(true);
    if (!clearance.ok) return;
    expect(clearance.data.clearance?.clearedAt).toBeTruthy();

    const archived = await archiveOffboardingPersonnelFile(TENANT, EMPLOYEE, ADMIN);
    expect(archived.ok).toBe(true);
    if (!archived.ok) return;
    expect(archived.data.session.overallStatus).toBe('completed');
    expect(getDemoEmployeePersonnelFile(EMPLOYEE)?.employment.employmentStatus).toBe('archived');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import {
  resetAssignmentWorkflowStore,
  upsertAssignmentWorkflowRecord,
} from '@/lib/assist/assignmentWorkflowService';
import { validateExecutionTransition } from '@/lib/assist/assignmentStatusMachine';
import { resetWorkspaceAuditStore } from '@/lib/permissions/workspaceAccess';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { resolveEnabledExecutionModules } from '@/lib/portal/employeePortalModuleAccess';
import {
  buildEmployeePortalRoute,
  captureEmployeePortalAssignmentSignature,
  completeEmployeePortalAssignment,
  fetchEmployeePortalAssignmentDetail,
  fetchEmployeePortalOverview,
  resetEmployeePortalExecutionStore,
  submitEmployeePortalDocumentation,
  transitionEmployeePortalAssignment,
  updateEmployeePortalTask,
} from '@/lib/portal/employeePortalExecutionService';
import { resetEmployeePortalSignatureStore } from '@/lib/portal/employeePortalSignatureService';

const TENANT = DEMO_TENANT_ID;
const EMPLOYEE = 'employee_portal' as const;
const EMPLOYEE_ID = 'employee-003';
const OTHER_EMPLOYEE = 'employee-001';

let assignmentSeedCounter = 0;

function seedTestAssignment(
  overrides: Partial<AssignmentWorkflowRecord> = {},
): AssignmentWorkflowRecord {
  assignmentSeedCounter += 1;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const end = new Date(tomorrow);
  end.setHours(11, 0, 0, 0);
  const now = new Date().toISOString();

  const id = `asg-ep-test-${assignmentSeedCounter}`;
  const record: AssignmentWorkflowRecord = {
    id,
    tenantId: TENANT,
    clientId: 'client-001',
    employeeId: EMPLOYEE_ID,
    serviceType: 'Alltagsbegleitung',
    assignmentType: 'single',
    plannedStartAt: tomorrow.toISOString(),
    plannedEndAt: end.toISOString(),
    plannedDurationMinutes: 120,
    actualStartAt: null,
    actualEndAt: null,
    status: 'bestaetigt',
    canonicalStatus: 'confirmed',
    locationAddress: 'Musterstraße 12, Berlin',
    notesForEmployee: '',
    internalNotes: '',
    clientVisibleNotes: '',
    billingRelevant: true,
    requiresSignature: false,
    requiresDocumentation: true,
    requiresRoute: false,
    createdBy: null,
    updatedBy: null,
    cancelledAt: null,
    completedAt: null,
    lockedAt: null,
    title: 'Portal-Einsatz Test',
    tasks: [
      {
        id: `task-ep-${assignmentSeedCounter}`,
        tenantId: TENANT,
        assignmentId: id,
        taskTitle: 'Begleitung Einkauf',
        taskDescription: '',
        taskCategory: 'standard',
        required: true,
        sortOrder: 1,
        status: 'open',
        completionNote: null,
        completedBy: null,
        completedAt: null,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  record.tasks = record.tasks.map((task) => ({ ...task, assignmentId: record.id, tenantId: TENANT }));
  return upsertAssignmentWorkflowRecord(record);
}

function createTestAssignment(overrides: Partial<AssignmentWorkflowRecord> = {}) {
  return { ok: true as const, data: seedTestAssignment(overrides) };
}

async function runExecutionUntilDocumentation(assignmentId: string) {
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'angekommen');
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'beendet');

  const record = await fetchEmployeePortalAssignmentDetail(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE);
  if (!record.ok) throw new Error(record.error);
  const taskId = record.data.tasks[0]?.id;
  if (taskId) {
    await updateEmployeePortalTask(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, taskId, 'done');
  }

  await submitEmployeePortalDocumentation(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, {
    shortDescription: 'Einsatz durchgeführt',
    referralRequired: false,
    emergencyOrProblem: false,
  });
}

async function runFullExecutionFlow(assignmentId: string, withSignature = false) {
  await runExecutionUntilDocumentation(assignmentId);

  if (withSignature) {
    await captureEmployeePortalAssignmentSignature(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, {
      signatureType: 'assignment',
      signerName: 'Helga Schneider',
      signatureDataUrl: 'data:image/png;base64,abc',
    });
  }

  return completeEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE);
}

describe('employee portal execution (Prompt 58)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    assignmentSeedCounter = 0;
    resetAssignmentWorkflowStore();
    resetEmployeePortalExecutionStore();
    resetEmployeePortalSignatureStore();
    resetWorkspaceAuditStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetEmployeePortalExecutionStore();
    resetEmployeePortalSignatureStore();
    resetWorkspaceAuditStore();
  });

  it('1. Übersicht zeigt nur eigene Einsätze', () => {
    const own = createTestAssignment({ employeeId: EMPLOYEE_ID, title: 'Eigener Einsatz' });
    const foreign = createTestAssignment({ employeeId: OTHER_EMPLOYEE, title: 'Fremder Einsatz' });
    expect(own.ok).toBe(true);
    expect(foreign.ok).toBe(true);

    const overview = fetchEmployeePortalOverview(TENANT, EMPLOYEE_ID, EMPLOYEE);
    expect(overview.ok).toBe(true);
    if (overview.ok) {
      const ids = [
        ...overview.data.todayAssignments,
        ...overview.data.nextAssignments,
        ...overview.data.weeklyPlan,
      ].map((a) => a.assignmentId);
      expect(ids.every((id) => id !== (foreign.ok ? foreign.data.id : ''))).toBe(true);
      expect(ids.some((id) => id === (own.ok ? own.data.id : ''))).toBe(true);
    }
  });

  it('2. Fremder Einsatz ist nicht einsehbar', () => {
    const foreign = createTestAssignment({ employeeId: OTHER_EMPLOYEE });
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) return;

    const detail = fetchEmployeePortalAssignmentDetail(
      TENANT,
      foreign.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
    );
    expect(detail.ok).toBe(false);
    if (!detail.ok) {
      expect(detail.error).toMatch(/nicht zugewiesen|Kein Zugriff/i);
    }
  });

  it('3. Start ohne Berechtigung blockiert', async () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const blocked = await transitionEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      'client_portal',
      'unterwegs',
    );
    expect(blocked.ok).toBe(false);
  });

  it('4. Statusfluss unterwegs → angekommen → gestartet', async () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const onWay = await transitionEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
      'unterwegs',
    );
    expect(onWay.ok).toBe(true);
    if (onWay.ok) expect(onWay.data.status).toBe('unterwegs');

    const arrived = await transitionEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
      'angekommen',
    );
    expect(arrived.ok).toBe(true);

    const started = await transitionEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
      'gestartet',
    );
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.data.status).toBe('gestartet');
  });

  it('5. Ungültiger Sprung geplant → abgeschlossen blockiert', async () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const blocked = await transitionEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
      'abgeschlossen',
    );
    expect(blocked.ok).toBe(false);
  });

  it('6. Start ohne Ankunft blockiert', async () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
    const blocked = await transitionEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
      'gestartet',
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/Ankunft/i);
    }

    const machine = validateExecutionTransition('unterwegs', 'gestartet', { requireArrivedBeforeStart: true });
    expect(machine.valid).toBe(false);
    if (!machine.valid) {
      expect(machine.error).toMatch(/Ankunft/i);
    }
  });

  it('7. Pause und Fortsetzen werden gespeichert', () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'angekommen');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'pausiert');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'gestartet');

    const detail = fetchEmployeePortalAssignmentDetail(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
    );
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.data.pauseEvents.length).toBe(1);
      expect(detail.data.pauseEvents[0]?.resumedAt).toBeTruthy();
    }
  });

  it('8. Aufgabe not_possible ohne Notiz blockiert', () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const detail = fetchEmployeePortalAssignmentDetail(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
    );
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;

    const taskId = detail.data.tasks[0]?.id;
    const blocked = updateEmployeePortalTask(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
      taskId,
      'not_possible',
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/Begründung/i);
    }
  });

  it('9. Dokumentation ohne Kurzbeschreibung blockiert', () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'angekommen');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'beendet');

    const blocked = submitEmployeePortalDocumentation(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, {
      shortDescription: '',
      referralRequired: false,
      emergencyOrProblem: false,
    });
    expect(blocked.ok).toBe(false);
  });

  it('10. Abweichungen ohne Begründung blockiert', () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'angekommen');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
    transitionEmployeePortalAssignment(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, 'beendet');

    const blocked = submitEmployeePortalDocumentation(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE, {
      shortDescription: 'Kurz',
      deviations: 'Zeit abweichend',
      referralRequired: false,
      emergencyOrProblem: false,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/begründet/i);
    }
  });

  it('11. Abschluss ohne Unterschrift blockiert wenn Pflicht', async () => {
    const created = createTestAssignment({ requiresSignature: true });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await runExecutionUntilDocumentation(created.data.id);
    const blocked = await completeEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/Unterschrift/i);
    }
  });

  it('12. Module nur bei Rolle und Mandant-Flag sichtbar', () => {
    const employeeModules = resolveEnabledExecutionModules(EMPLOYEE, {
      sis: true,
      vitals: true,
      body_map: true,
    });
    expect(employeeModules).not.toContain('sis');
    expect(employeeModules).not.toContain('vitals');

    const nurseModules = resolveEnabledExecutionModules('nurse', {
      sis: true,
      vitals: true,
      body_map: true,
    });
    expect(nurseModules).toContain('vitals');
  });

  it('13. Vollständiger Abschluss sperrt Einsatz', async () => {
    const created = createTestAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await runFullExecutionFlow(created.data.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('abgeschlossen');
      expect(result.data.serviceProofJobId).toBeTruthy();
    }

    const detail = fetchEmployeePortalAssignmentDetail(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
    );
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.data.isLocked).toBe(true);
      expect(detail.data.documentationStatus).toBe('locked');
    }

    const reOpen = await transitionEmployeePortalAssignment(
      TENANT,
      created.data.id,
      EMPLOYEE_ID,
      EMPLOYEE,
      'gestartet',
    );
    expect(reOpen.ok).toBe(false);
  });

  it('14. Route und Production-Demo-Guard', () => {
    const created = createTestAssignment({ requiresRoute: true });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const route = buildEmployeePortalRoute(TENANT, created.data.id, EMPLOYEE_ID, EMPLOYEE);
    expect(route.ok).toBe(true);
    if (route.ok) {
      expect(route.data.mapUrl).toContain('maps.google.com');
      expect(route.data.internalMapAvailable).toBe(true);
    }

    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const liveBlock = guardLiveDemoFeature(TENANT, 'Mitarbeiterportal-Einsatzübersicht');
    expect(liveBlock?.ok).toBe(false);
  });
});

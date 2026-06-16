import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';
import { listManagementTasks } from '@/lib/assist/managementTaskService';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import {
  approveVacation,
  cancelAbsence,
  createAbsence,
  getVacationBalance,
  listAbsenceAuditTrail,
  listAbsences,
  recordSickLeave,
  rejectVacation,
  requestVacation,
  resetAbsenceStore,
  sanitizeForClientPortal,
  sanitizeForEmployeePortal,
  setVacationEntitlement,
  uploadAuDocument,
} from '@/lib/office/absenceService';
import {
  listAbsenceScheduleEntries,
  listCombinedScheduleEntries,
} from '@/lib/office/absenceScheduleService';
import {
  listReplacementRequired,
  suggestReplacementEmployees,
} from '@/lib/office/replacementPlanningService';
import { detectAssignmentConflicts } from '@/lib/assist/assignmentConflictService';
import { getPlanningBlockAbsences } from '@/lib/office/absenceStore';

import {
  acknowledgeComplianceTraining,
  assignMandatoryComplianceForEmployee,
  evaluateComplianceDeployability,
  markComplianceTrainingViewed,
  resetComplianceTrainingStore,
} from '@/lib/office/complianceTrainingService';
import { listComplianceAssignmentsForTenant } from '@/lib/office/complianceTrainingStore';
import { __resetTrainingServiceForTests, __seedTrainingServiceForTests } from '@/lib/training';
import { TRAINING_STORE } from '@/lib/training/trainingStore';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;
const DISPATCH = 'dispatch' as const;
const EMPLOYEE = 'employee_portal' as const;
const CLIENT = 'client_portal' as const;

const BASE_ASSIGNMENT = {
  tenantId: TENANT,
  clientId: 'client-001',
  employeeId: 'employee-001',
  serviceType: 'Alltagsbegleitung',
  plannedStartAt: '2026-07-15T09:00:00.000Z',
  plannedEndAt: '2026-07-15T11:00:00.000Z',
  locationAddress: 'Musterstraße 12, Berlin',
  title: 'Einsatz Juli',
  tasks: [{ title: 'Begleitung' }],
};

function ensureEmployeeTraining(employeeId: string): void {
  __resetTrainingServiceForTests();
  __seedTrainingServiceForTests();

  const hasDsgvo = TRAINING_STORE.records.some(
    (r) => r.employeeId === employeeId && r.courseId === 'tr-course-dsgvo' && r.status === 'passed',
  );
  if (hasDsgvo) return;

  const now = new Date().toISOString();
  const validUntil = new Date(Date.now() + 500 * 86_400_000).toISOString();
  TRAINING_STORE.records.push({
    id: `tr-rec-${employeeId}-dsgvo`,
    tenantId: TENANT,
    employeeId,
    courseId: 'tr-course-dsgvo',
    status: 'passed',
    assignedAt: now,
    startedAt: now,
    completedAt: now,
    passedAt: now,
    validUntil,
    proofDocumentId: `doc-tr-${employeeId}-dsgvo`,
    verifiedBy: 'profile-admin',
    verifiedAt: now,
    waivedBy: null,
    waivedReason: null,
    progressPercent: 100,
    scorePercent: 95,
    absenceId: null,
    academyEnrollmentId: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  });
  TRAINING_STORE.certificates.push({
    id: `tr-cert-${employeeId}-dsgvo`,
    tenantId: TENANT,
    employeeId,
    trainingRecordId: `tr-rec-${employeeId}-dsgvo`,
    courseId: 'tr-course-dsgvo',
    title: 'Datenschutz & Schweigepflicht',
    certificateNumber: `CS-DSGVO-${employeeId}`,
    issuedAt: now,
    validUntil,
    documentId: `doc-tr-${employeeId}-dsgvo`,
    verificationStatus: 'verified',
    verifiedBy: 'profile-admin',
    verifiedAt: now,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureEmployeeCompliance(employeeId: string): Promise<void> {
  resetComplianceTrainingStore();
  const assigned = await assignMandatoryComplianceForEmployee(TENANT, employeeId, 'caregiver', ADMIN);
  if (!assigned.ok) {
    throw new Error(`Compliance-Zuweisung fehlgeschlagen: ${assigned.error}`);
  }

  for (const assignment of listComplianceAssignmentsForTenant(TENANT, employeeId)) {
    await markComplianceTrainingViewed(TENANT, assignment.id, employeeId, EMPLOYEE);
    const ack = await acknowledgeComplianceTraining(
      {
        tenantId: TENANT,
        assignmentId: assignment.id,
        employeeId,
        signatureName: 'Test Mitarbeiter',
        viewedDocument: true,
        quizScore: 100,
      },
      EMPLOYEE,
    );
    if (!ack.ok) {
      throw new Error(`Compliance-Bestätigung fehlgeschlagen: ${ack.error}`);
    }
  }

  const compliance = evaluateComplianceDeployability(TENANT, employeeId, 'caregiver');
  if (!compliance.ok) {
    throw new Error(`Compliance unvollständig: ${compliance.blockers.join('; ')}`);
  }
}

describe('employee absence management (Prompt 72)', () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    resetAbsenceStore();
    resetAssignmentWorkflowStore();
    resetLiveMonitorStore();
    resetComplianceTrainingStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    setVacationEntitlement(TENANT, 'employee-003', 2026, 30);
    ensureEmployeeTraining('employee-001');
    await ensureEmployeeCompliance('employee-001');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAbsenceStore();
    resetAssignmentWorkflowStore();
    resetLiveMonitorStore();
    resetComplianceTrainingStore();
    __resetTrainingServiceForTests();
  });

  it('1. Mitarbeiter beantragt Urlaub', async () => {
    const result = await requestVacation(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-10T00:00:00.000Z',
        endsAt: '2026-08-14T23:59:59.000Z',
        employeeNote: 'Sommerurlaub',
      },
      EMPLOYEE,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.absence.status).toBe('requested');
      expect(result.data.absence.tenantId).toBe(TENANT);
    }
  });

  it('2. Admin genehmigt Urlaub', async () => {
    const req = await requestVacation(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-10T00:00:00.000Z',
        endsAt: '2026-08-12T23:59:59.000Z',
      },
      EMPLOYEE,
    );
    expect(req.ok).toBe(true);
    if (!req.ok) return;

    const approved = await approveVacation(TENANT, req.data.absence.id, ADMIN, 'profile-admin');
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(['approved', 'requires_review']).toContain(approved.data.status);
    }
  });

  it('3. Admin lehnt Urlaub ab', async () => {
    const req = await requestVacation(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-05T23:59:59.000Z',
      },
      EMPLOYEE,
    );
    if (!req.ok) return;

    const rejected = await rejectVacation(TENANT, req.data.absence.id, 'Personaleinsatz', ADMIN);
    expect(rejected.ok).toBe(true);
    if (rejected.ok) expect(rejected.data.status).toBe('rejected');
  });

  it('4. Krankmeldung erfassen', async () => {
    const sick = await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-04T00:00:00.000Z',
        endsAt: '2026-08-06T23:59:59.000Z',
        sickDetails: 'Grippe',
      },
      DISPATCH,
    );
    expect(sick.ok).toBe(true);
    if (sick.ok) {
      expect(sick.data.absenceType).toBe('sick_leave');
      expect(sick.data.status).toBe('active');
    }
  });

  it('5. Krankmeldung blockiert Einsatzplanung', async () => {
    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-07-15T00:00:00.000Z',
        endsAt: '2026-07-17T23:59:59.000Z',
      },
      DISPATCH,
    );

    const blocked = createAssignmentWorkflow(BASE_ASSIGNMENT, ADMIN);
    expect(blocked.ok).toBe(false);
  });

  it('6. Abwesenheit erscheint im Dienstplan', async () => {
    await createAbsence(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        absenceType: 'vacation',
        startsAt: '2026-08-20T00:00:00.000Z',
        endsAt: '2026-08-22T23:59:59.000Z',
        status: 'approved',
      },
      ADMIN,
    );

    const schedule = listAbsenceScheduleEntries(TENANT);
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule[0]?.source).toBe('absence_sync');

    const combined = listCombinedScheduleEntries(TENANT);
    expect(combined.some((e) => e.kind === 'absence')).toBe(true);
  });

  it('7. Konflikt mit bestehendem Einsatz erkannt', async () => {
    const created = createAssignmentWorkflow(BASE_ASSIGNMENT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const sick = await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-07-15T00:00:00.000Z',
        endsAt: '2026-07-17T23:59:59.000Z',
      },
      DISPATCH,
    );
    expect(sick.ok).toBe(true);
    if (sick.ok) expect(sick.data.replacementRequired).toBe(true);
  });

  it('8. Vertretung erforderlich markiert', async () => {
    const created = createAssignmentWorkflow(BASE_ASSIGNMENT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-07-15T00:00:00.000Z',
        endsAt: '2026-07-17T23:59:59.000Z',
      },
      DISPATCH,
    );

    const open = listReplacementRequired(TENANT);
    expect(open.length).toBeGreaterThan(0);
  });

  it('9. Management-Task bei Konflikt', async () => {
    const created = createAssignmentWorkflow(BASE_ASSIGNMENT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-07-15T00:00:00.000Z',
        endsAt: '2026-07-17T23:59:59.000Z',
      },
      DISPATCH,
    );

    const tasks = listManagementTasks(TENANT);
    expect(tasks.some((t) => t.taskType === 'absence_replacement')).toBe(true);
  });

  it('10. Mitarbeiter sieht nur eigene Abwesenheiten', async () => {
    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-02T23:59:59.000Z',
      },
      DISPATCH,
    );
    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-03T00:00:00.000Z',
        endsAt: '2026-08-04T23:59:59.000Z',
      },
      DISPATCH,
    );

    const own = listAbsences(TENANT, undefined, EMPLOYEE, 'employee-003');
    expect(own.ok).toBe(true);
    if (own.ok) {
      expect(own.data.every((a) => a.employeeId === 'employee-003')).toBe(true);
    }
  });

  it('11. Krankdetails für andere verborgen', async () => {
    const sick = await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-05T23:59:59.000Z',
        sickDetails: 'Vertrauliche Diagnose',
      },
      DISPATCH,
    );
    if (!sick.ok) return;

    const adminView = listAbsences(TENANT, { employeeId: 'employee-001' }, ADMIN, 'employee-003');
    expect(adminView.ok).toBe(true);
    if (adminView.ok) {
      expect(adminView.data[0]?.sickDetails).toBe('Vertrauliche Diagnose');
    }

    const portalView = sanitizeForEmployeePortal(sick.data, 'employee-003');
    expect(portalView).toBeNull();
  });

  it('12. Klient sieht keine Abwesenheitsgründe', async () => {
    const sick = await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-02T23:59:59.000Z',
        sickDetails: 'Intern',
      },
      DISPATCH,
    );
    if (!sick.ok) return;

    const clientHint = sanitizeForClientPortal(sick.data);
    expect(clientHint.category).toBe('unavailable');
    expect(clientHint).not.toHaveProperty('sickDetails');
    expect(clientHint).not.toHaveProperty('reason');

    const clientList = listAbsences(TENANT, undefined, CLIENT);
    expect(clientList.ok).toBe(false);
  });

  it('13. Cross-Tenant-Zugriff blockiert', async () => {
    const created = await createAbsence(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        absenceType: 'other',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-01T23:59:59.000Z',
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const foreign = listAbsences('00000000-0000-4000-8000-000000000099', undefined, ADMIN);
    expect(foreign.ok).toBe(false);
  });

  it('14. Audit-Event bei Änderung', async () => {
    const created = await createAbsence(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        absenceType: 'training',
        startsAt: '2026-08-15T00:00:00.000Z',
        endsAt: '2026-08-15T23:59:59.000Z',
      },
      ADMIN,
    );
    if (!created.ok) return;

    const trail = listAbsenceAuditTrail(TENANT, created.data.id);
    expect(trail.some((e) => e.action === 'absence_created')).toBe(true);

    await cancelAbsence(TENANT, created.data.id, ADMIN);
    const afterCancel = listAbsenceAuditTrail(TENANT, created.data.id);
    expect(afterCancel.some((e) => e.action === 'absence_cancelled')).toBe(true);
  });

  it('15. Produktionsmodus ohne Demo-Fallback blockiert', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const block = guardLiveDemoFeature(TENANT, 'Abwesenheitsverwaltung');
    expect(block).not.toBeNull();
    expect(block?.ok).toBe(false);

    const result = await requestVacation(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-10T00:00:00.000Z',
        endsAt: '2026-08-12T23:59:59.000Z',
      },
      EMPLOYEE,
    );
    expect(result.ok).toBe(false);
  });

  it('Urlaubssaldo wird berechnet', async () => {
    await requestVacation(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-10T00:00:00.000Z',
        endsAt: '2026-08-12T23:59:59.000Z',
      },
      EMPLOYEE,
    );

    const balance = getVacationBalance(TENANT, 'employee-003', 2026, EMPLOYEE);
    expect(balance.ok).toBe(true);
    if (balance.ok && balance.data) {
      expect(balance.data.entitledDays).toBe(30);
      expect(balance.data.pendingDays).toBeGreaterThan(0);
    }
  });

  it('Einsatzkonflikttyp bei Krankmeldung', async () => {
    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-07-15T00:00:00.000Z',
        endsAt: '2026-07-17T23:59:59.000Z',
      },
      DISPATCH,
    );

    const conflicts = detectAssignmentConflicts({
      assignment: {
        id: 'test',
        tenantId: TENANT,
        clientId: 'client-001',
        employeeId: 'employee-001',
        plannedStartAt: '2026-07-15T09:00:00.000Z',
        plannedEndAt: '2026-07-15T11:00:00.000Z',
        locationAddress: 'Berlin',
        serviceType: 'Alltagsbegleitung',
        tasks: [],
      },
      existing: [],
      employeeAbsences: getPlanningBlockAbsences(TENANT),
    });
    expect(conflicts.some((c) => c.code === 'employee_sick')).toBe(true);
  });

  it('Vertretungsvorschläge schließen abwesende MA aus', async () => {
    const created = createAssignmentWorkflow(BASE_ASSIGNMENT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        startsAt: '2026-07-15T00:00:00.000Z',
        endsAt: '2026-07-17T23:59:59.000Z',
      },
      DISPATCH,
    );
    await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-07-15T00:00:00.000Z',
        endsAt: '2026-07-17T23:59:59.000Z',
      },
      DISPATCH,
    );

    const open = listReplacementRequired(TENANT);
    expect(open.length).toBeGreaterThan(0);
    const suggestions = suggestReplacementEmployees(TENANT, open[0]?.assignmentId ?? '');
    expect(suggestions.every((s) => s.employeeId !== 'employee-001')).toBe(true);
    expect(suggestions.every((s) => s.employeeId !== 'employee-003')).toBe(true);
  });

  it('AU-Upload nur mit Berechtigung', async () => {
    const sick = await recordSickLeave(
      {
        tenantId: TENANT,
        employeeId: 'employee-003',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-03T23:59:59.000Z',
      },
      DISPATCH,
    );
    if (!sick.ok) return;

    const denied = await uploadAuDocument(TENANT, sick.data.id, 'doc-au-1', EMPLOYEE, null, 'employee-001');
    expect(denied.ok).toBe(false);

    const allowedOwn = await uploadAuDocument(TENANT, sick.data.id, 'doc-au-1', EMPLOYEE, null, 'employee-003');
    expect(allowedOwn.ok).toBe(true);
  });
});

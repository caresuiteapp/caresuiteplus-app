import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  archiveAndLockCompletion,
  attemptEditFinalizedServiceRecord,
  captureAssignmentSignature,
  fetchCompletionChainProductionSafe,
  finishAssignmentWithChecks,
  generateServiceRecord,
  getCompletionAuditTrail,
  getCompletionChainStatus,
  getServiceRecord,
  listCompletionMonitorItems,
  prepareBillingFromServiceRecord,
  requestServiceRecordCorrection,
  requestSignatureException,
  resetCompletionChainStore,
  reviewServiceRecord,
  reviewSignatureException,
  submitAssignmentDocumentation,
} from '@/lib/assist/assignmentCompletionChainService';
import {
  createAssignmentWorkflow,
  getAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;
const EMPLOYEE = 'caregiver' as const;

const BASE_INPUT = {
  tenantId: TENANT,
  clientId: 'client-001',
  employeeId: 'employee-001',
  serviceType: 'Alltagsbegleitung',
  plannedStartAt: '2026-07-01T09:00:00.000Z',
  plannedEndAt: '2026-07-01T11:00:00.000Z',
  locationAddress: 'Musterstraße 12, Berlin',
  title: 'Abschluss Test',
  tasks: [{ title: 'Begleitung' }],
  requiresDocumentation: true,
  requiresSignature: true,
};

function createReadyAssignment() {
  const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
  expect(created.ok).toBe(true);
  return created.ok ? created.data : null;
}

function submitDoc(assignmentId: string) {
  return submitAssignmentDocumentation({
    tenantId: TENANT,
    assignmentId,
    clientId: 'client-001',
    employeeId: 'employee-001',
    summary: 'Einsatz durchgeführt',
    performedTasks: 'Begleitung Einkauf',
    observations: 'Alles unauffällig',
    deviations: 'Keine',
    followUpRequired: false,
    actorRoleKey: EMPLOYEE,
  });
}

describe('assignment completion chain (Prompt 62)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetCompletionChainStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetCompletionChainStore();
  });

  it('1. Beenden ohne Ist-Zeiten blockiert', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    const result = finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '',
      actualEndAt: '',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });
    expect(result.ok).toBe(false);
  });

  it('2. Beenden setzt documentation_pending wenn Doku fehlt', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    const result = finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.nextStatus).toBe('documentation_pending');
    }
  });

  it('3. Dokumentation mit Pflichtfeldern erforderlich', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    const missing = submitAssignmentDocumentation({
      tenantId: TENANT,
      assignmentId: assignment.id,
      clientId: 'client-001',
      employeeId: 'employee-001',
      summary: '',
      performedTasks: 'Aufgabe',
      observations: 'Ok',
      deviations: 'Keine',
      followUpRequired: false,
      actorRoleKey: EMPLOYEE,
    });
    expect(missing.ok).toBe(false);
  });

  it('4. Nach Doku folgt signature_pending bei Pflicht-Signatur', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    const doc = submitDoc(assignment.id);
    expect(doc.ok).toBe(true);
    if (doc.ok) {
      expect(getCompletionChainStatus(assignment.id)).toBe('signature_pending');
    }
  });

  it('5. Unterschrift erfassen setzt review_pending', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;
    submitDoc(assignment.id);

    const sig = captureAssignmentSignature({
      tenantId: TENANT,
      assignmentId: assignment.id,
      clientId: 'client-001',
      signatureType: 'assignment',
      signerName: 'Frau Müller',
      signerRole: 'Klientin',
      signatureData: 'base64-signature-data',
      capturedBy: 'employee-003',
      actorRoleKey: EMPLOYEE,
    });
    expect(sig.ok).toBe(true);
    expect(getCompletionChainStatus(assignment.id)).toBe('review_pending');
  });

  it('6. Ausnahme ohne Unterschrift erfordert Begründung und Admin-Prüfung', async () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;
    submitDoc(assignment.id);

    const noReason = requestSignatureException({
      tenantId: TENANT,
      assignmentId: assignment.id,
      reason: '',
      requestedBy: 'employee-003',
      actorRoleKey: EMPLOYEE,
    });
    expect(noReason.ok).toBe(false);

    const exc = requestSignatureException({
      tenantId: TENANT,
      assignmentId: assignment.id,
      reason: 'Klientin nicht anwesend',
      requestedBy: 'employee-003',
      actorRoleKey: EMPLOYEE,
    });
    expect(exc.ok).toBe(true);
    expect(getCompletionChainStatus(assignment.id)).toBe('review_pending_exception');

    if (exc.ok) {
      const reviewed = reviewSignatureException({
        tenantId: TENANT,
        exceptionId: exc.data.id,
        approved: true,
        reviewerId: 'admin-001',
        actorRoleKey: ADMIN,
      });
      expect(reviewed.ok).toBe(true);
    }
  });

  it('7. Leistungsnachweis benötigt Einsatzdaten und Dokumentation', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    const blocked = generateServiceRecord({
      tenantId: TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    expect(blocked.ok).toBe(false);

    submitDoc(assignment.id);
    finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });

    const record = generateServiceRecord({
      tenantId: TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    expect(record.ok).toBe(true);
  });

  it('8. Abrechnungsvorbereitung nur bei freigegebenem Nachweis', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;
    submitDoc(assignment.id);
    finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });

    const generated = generateServiceRecord({
      tenantId: TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    if (!generated.ok) return;

    const blocked = prepareBillingFromServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      rateCents: 4500,
      taxRatePercent: 0,
      invoiceRecipient: 'Pflegekasse Nord',
      actorRoleKey: ADMIN,
    });
    expect(blocked.ok).toBe(false);

    reviewServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      decision: 'approved',
      reviewerId: 'admin-001',
      internalNote: 'OK',
      actorRoleKey: ADMIN,
    });

    const billing = prepareBillingFromServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      rateCents: 4500,
      taxRatePercent: 0,
      invoiceRecipient: 'Pflegekasse Nord',
      actorRoleKey: ADMIN,
    });
    expect(billing.ok).toBe(true);
    expect(getCompletionAuditTrail(TENANT).some((e) => e.action === 'billing_prepared')).toBe(true);
  });

  it('9. Finalisierter Nachweis nicht direkt editierbar', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;
    submitDoc(assignment.id);
    finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });

    const generated = generateServiceRecord({
      tenantId: TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    if (!generated.ok) return;

    reviewServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      decision: 'approved',
      reviewerId: 'admin-001',
      internalNote: 'OK',
      actorRoleKey: ADMIN,
    });

    prepareBillingFromServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      rateCents: 4500,
      taxRatePercent: 0,
      invoiceRecipient: 'Pflegekasse Nord',
      actorRoleKey: ADMIN,
    });

    archiveAndLockCompletion({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      pdfPath: '/archive/proof.pdf',
      actorRoleKey: ADMIN,
    });

    const edit = attemptEditFinalizedServiceRecord(TENANT, generated.data.id, ADMIN);
    expect(edit.ok).toBe(false);
  });

  it('10. Korrekturanfrage statt Direktbearbeitung', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;
    submitDoc(assignment.id);
    finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });

    const generated = generateServiceRecord({
      tenantId: TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    if (!generated.ok) return;

    const correction = requestServiceRecordCorrection({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      reason: 'Zeiten korrigieren',
      assignedToEmployeeId: 'employee-003',
      requestedBy: 'admin-001',
      actorRoleKey: ADMIN,
    });
    expect(correction.ok).toBe(true);
    expect(getCompletionChainStatus(assignment.id)).toBe('correction_requested');
  });

  it('11. Archivierung sperrt Einsatz und Nachweis', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;
    submitDoc(assignment.id);
    finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });

    const generated = generateServiceRecord({
      tenantId: TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    if (!generated.ok) return;

    reviewServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      decision: 'approved',
      reviewerId: 'admin-001',
      internalNote: 'OK',
      actorRoleKey: ADMIN,
    });

    prepareBillingFromServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      rateCents: 4500,
      taxRatePercent: 0,
      invoiceRecipient: 'Pflegekasse Nord',
      actorRoleKey: ADMIN,
    });

    const archived = archiveAndLockCompletion({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      pdfPath: '/archive/proof.pdf',
      actorRoleKey: ADMIN,
    });
    expect(archived.ok).toBe(true);
    if (archived.ok) {
      expect(archived.data.record.lockedAt).toBeTruthy();
      expect(getCompletionChainStatus(assignment.id)).toBe('locked');
      const wf = getAssignmentWorkflow(TENANT, assignment.id);
      expect(wf?.lockedAt).toBeTruthy();
    }
  });

  it('12. Admin-Monitor listet offene Bereiche', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });

    const monitor = listCompletionMonitorItems(TENANT, 'missing_doc');
    expect(monitor.some((m) => m.assignmentId === assignment.id)).toBe(true);
  });

  it('13. Cross-Tenant blockiert', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    const record = generateServiceRecord({
      tenantId: OTHER_TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    expect(record.ok).toBe(false);
  });

  it('14. Ablehnung setzt rejected-Status', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;
    submitDoc(assignment.id);
    finishAssignmentWithChecks({
      tenantId: TENANT,
      assignmentId: assignment.id,
      actualStartAt: '2026-07-01T09:05:00.000Z',
      actualEndAt: '2026-07-01T11:00:00.000Z',
      tasksHandled: true,
      actorRoleKey: EMPLOYEE,
    });

    const generated = generateServiceRecord({
      tenantId: TENANT,
      assignmentId: assignment.id,
      careLevel: '2',
      payer: 'Pflegekasse',
      budgetAllocation: 'SGB XI §45b',
      billingAmountCents: 4500,
      actorRoleKey: ADMIN,
    });
    if (!generated.ok) return;

    reviewServiceRecord({
      tenantId: TENANT,
      serviceRecordId: generated.data.id,
      decision: 'rejected',
      reviewerId: 'admin-001',
      internalNote: 'Unvollständig',
      actorRoleKey: ADMIN,
    });

    const record = getServiceRecord(TENANT, generated.data.id);
    expect(record?.status).toBe('rejected');
  });

  it('15. Produktionsmodus ohne Demo-Fallbacks', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    const result = await fetchCompletionChainProductionSafe(TENANT);
    expect(result.ok).toBe(false);
  });

  it('16. Jede relevante Aktion erzeugt Audit-Event', () => {
    const assignment = createReadyAssignment();
    if (!assignment) return;

    submitDoc(assignment.id);
    const trail = getCompletionAuditTrail(TENANT, assignment.id);
    expect(trail.some((e) => e.action === 'documentation_submitted')).toBe(true);
  });
});

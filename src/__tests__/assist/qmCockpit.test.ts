import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';
import { createClientVisitRequest, resetClientVisitRequestStore } from '@/lib/assist/clientVisitRequestService';
import {
  createServiceRecord,
  listCorrectionRequests,
  requestCorrection,
  resolveCorrection,
} from '@/lib/assist/correctionRequestService';
import { listManagementTasks, updateManagementTaskStatus } from '@/lib/assist/managementTaskService';
import { MANAGEMENT_TASK_AUTOMATION_RULES } from '@/lib/assist/managementTaskAutomationService';
import { transitionAssignmentLiveStatus } from '@/lib/assist/liveMonitorService';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import {
  countOpenEmergenciesWithoutFollowUp,
  fetchQmCockpitSnapshot,
  registerClientDocument,
  syncBillingBlockerTasks,
} from '@/lib/assist/qmCockpitService';
import { resetQmCockpitStore, listQmAuditEvents } from '@/lib/assist/qmCockpitStore';
import { reportEmergency, reportProblem } from '@/lib/assist/problemReportService';
import { reviewServiceRecord } from '@/lib/assist/serviceRecordReviewService';
import { resetCareBillingStore, saveBillableItem } from '@/lib/careBilling/careBillingStore';
import type { BillableItem } from '@/types/careBilling';
import { QM_COCKPIT_AREA_LABELS } from '@/types/modules/qmCockpit';

const TENANT = DEMO_TENANT_ID;
const FOREIGN = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;
const EMPLOYEE = 'caregiver' as const;
const CLIENT = 'client_portal' as const;

function todayRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    start: `${y}-${m}-${d}T09:00:00.000Z`,
    end: `${y}-${m}-${d}T11:00:00.000Z`,
  };
}

function createTodayAssignment() {
  const { start, end } = todayRange();
  return createAssignmentWorkflow(
    {
      tenantId: TENANT,
      clientId: 'client-001',
      employeeId: 'employee-003',
      serviceType: 'Alltagsbegleitung',
      plannedStartAt: start,
      plannedEndAt: end,
      locationAddress: 'Musterstraße 12',
      title: 'QM Cockpit Test',
      requiresSignature: true,
      requiresDocumentation: true,
      tasks: [{ title: 'Test' }],
    },
    ADMIN,
  );
}

function sampleBillable(status: BillableItem['status']): BillableItem {
  const now = new Date().toISOString();
  return {
    id: `bi-${status}`,
    tenantId: TENANT,
    clientId: 'client-001',
    serviceProofId: 'proof-001',
    serviceRecordId: null,
    serviceAreaKey: 'alltagsbegleitung',
    servicePeriodFrom: '2026-06-01',
    servicePeriodTo: '2026-06-30',
    durationMinutes: 120,
    billableMinutes: 120,
    hourlyRateNetCents: 3500,
    netAmountCents: 7000,
    taxMode: 'standard_vat_19',
    taxAmountCents: 1330,
    grossAmountCents: 8330,
    budgetType: 'paragraph_45b',
    budgetPeriodId: null,
    selfPayerAmountCents: 0,
    costCarrierProfileId: null,
    billingRecipientProfileId: null,
    invoiceDraftId: null,
    invoiceId: null,
    status,
    validationRunId: null,
    description: `Position ${status}`,
    careGrade: 'PG3',
    createdAt: now,
    updatedAt: now,
  };
}

describe('QM Cockpit (Prompt 65)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetLiveMonitorStore();
    resetQmCockpitStore();
    resetCareBillingStore(TENANT);
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetLiveMonitorStore();
    resetQmCockpitStore();
    resetCareBillingStore(TENANT);
  });

  it('1. Cockpit liefert alle 9 Bereiche für Admin', () => {
    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.data.areas).toHaveLength(9);
    for (const area of snapshot.data.areas) {
      expect(QM_COCKPIT_AREA_LABELS[area.area]).toBeTruthy();
    }
  });

  it('2. Kein Cross-Tenant im Cockpit', () => {
    createTodayAssignment();
    expect(listManagementTasks(FOREIGN).length).toBe(0);
    const own = fetchQmCockpitSnapshot(TENANT, ADMIN);
    expect(own.ok).toBe(true);
    if (own.ok) {
      expect(own.data.tenantId).toBe(TENANT);
    }
  });

  it('3. Fehlende Doku erscheint in Bereich doku_fehlt', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;
    const id = created.data.id;

    for (const status of ['unterwegs', 'angekommen', 'gestartet', 'beendet', 'dokumentation_offen'] as const) {
      transitionAssignmentLiveStatus(TENANT, id, status, {
        userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
      });
    }

    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    const doku = snapshot.data.areas.find((a) => a.area === 'doku_fehlt');
    expect(doku?.items.some((i) => i.assignmentId === id)).toBe(true);
  });

  it('4. Fehlende Signatur erscheint in Bereich signatur_fehlt', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;
    const id = created.data.id;

    for (const status of ['unterwegs', 'angekommen', 'gestartet', 'beendet', 'dokumentation_offen', 'unterschrift_offen'] as const) {
      transitionAssignmentLiveStatus(TENANT, id, status, {
        userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
      });
    }

    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    if (!snapshot.ok) return;
    const sig = snapshot.data.areas.find((a) => a.area === 'signatur_fehlt');
    expect(sig?.items.some((i) => i.assignmentId === id)).toBe(true);
  });

  it('5. Notfall erzeugt Follow-up-Aufgabe', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    reportEmergency({
      tenantId: TENANT,
      assignmentId: created.data.id,
      employeeId: 'employee-003',
      description: 'Sturz',
      actorRoleKey: EMPLOYEE,
    });

    const tasks = listManagementTasks(TENANT, { assignmentId: created.data.id });
    expect(tasks.some((t) => t.taskType === 'emergency_follow_up')).toBe(true);
    expect(countOpenEmergenciesWithoutFollowUp(TENANT)).toBe(0);
  });

  it('6. Problem erscheint in heute_kritisch', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    reportProblem({
      tenantId: TENANT,
      assignmentId: created.data.id,
      employeeId: 'employee-003',
      reportType: 'access_denied',
      description: 'Kein Zutritt',
      actorRoleKey: EMPLOYEE,
    });

    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    if (!snapshot.ok) return;
    const kritisch = snapshot.data.areas.find((a) => a.area === 'heute_kritisch');
    expect(kritisch?.items.some((i) => i.assignmentId === created.data.id)).toBe(true);
  });

  it('7. Korrekturanfrage erzeugt Audit-Event', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const result = requestCorrection({
      tenantId: TENANT,
      assignmentId: created.data.id,
      requestedBy: 'admin-001',
      assignedToEmployeeId: 'employee-003',
      affectedArea: 'documentation',
      reason: 'Pflichtfelder unvollständig',
      requiredResponse: 'Doku ergänzen',
      actorRoleKey: ADMIN,
    });
    expect(result.ok).toBe(true);

    const audit = listQmAuditEvents(TENANT);
    expect(audit.some((e) => e.action === 'correction.requested')).toBe(true);
  });

  it('8. Mitarbeiter sieht nur eigene Korrekturaufgaben', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    requestCorrection({
      tenantId: TENANT,
      assignmentId: created.data.id,
      requestedBy: 'admin-001',
      assignedToEmployeeId: 'employee-003',
      affectedArea: 'times',
      reason: 'Zeiten prüfen',
      requiredResponse: 'Korrigieren',
      actorRoleKey: ADMIN,
    });

    requestCorrection({
      tenantId: TENANT,
      assignmentId: created.data.id,
      requestedBy: 'admin-001',
      assignedToEmployeeId: 'employee-999',
      affectedArea: 'times',
      reason: 'Fremde Aufgabe',
      requiredResponse: 'Korrigieren',
      actorRoleKey: ADMIN,
    });

    const own = listCorrectionRequests(TENANT, { employeeId: 'employee-003' });
    const foreign = listCorrectionRequests(TENANT, { employeeId: 'employee-999' });
    expect(own.length).toBe(1);
    expect(foreign.length).toBe(1);

    const denied = resolveCorrection(TENANT, foreign[0].id, 'employee-003', EMPLOYEE, 'employee-003');
    expect(denied.ok).toBe(false);
  });

  it('9. Klient sieht QM-Cockpit nicht', () => {
    const snapshot = fetchQmCockpitSnapshot(TENANT, CLIENT);
    expect(snapshot.ok).toBe(false);
    if (!snapshot.ok) {
      expect(snapshot.error).toContain('Klient');
    }
  });

  it('10. Freigabe erzeugt Review- und Audit-Event', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const record = createServiceRecord({
      tenantId: TENANT,
      assignmentId: created.data.id,
      clientId: 'client-001',
      employeeId: 'employee-003',
      serviceType: 'Alltagsbegleitung',
      deploymentDate: '2026-06-16',
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      documentationId: 'doc-001',
    });
    expect(record.ok).toBe(true);
    if (!record.ok) return;

    const review = reviewServiceRecord({
      tenantId: TENANT,
      serviceRecordId: record.data.id,
      reviewerId: 'admin-001',
      decision: 'approved',
      internalNote: 'Alles korrekt',
      actorRoleKey: ADMIN,
    });
    expect(review.ok).toBe(true);

    const audit = listQmAuditEvents(TENANT, review.ok ? review.data.id : undefined);
    expect(audit.some((e) => e.action === 'service_record.reviewed')).toBe(true);
    if (review.ok) expect(review.data.billingReady).toBe(true);
  });

  it('11. Ablehnung hält Prüfung offen', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const record = createServiceRecord({
      tenantId: TENANT,
      assignmentId: created.data.id,
      clientId: 'client-001',
      employeeId: 'employee-003',
      serviceType: 'Alltagsbegleitung',
      deploymentDate: '2026-06-16',
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      documentationId: 'doc-002',
    });
    if (!record.ok) return;

    reviewServiceRecord({
      tenantId: TENANT,
      serviceRecordId: record.data.id,
      reviewerId: 'admin-001',
      decision: 'rejected',
      internalNote: 'Unvollständig',
      actorRoleKey: ADMIN,
    });

    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    if (!snapshot.ok) return;
    const pruefung = snapshot.data.areas.find((a) => a.area === 'pruefung_offen');
    expect(pruefung?.openCount).toBeGreaterThan(0);
  });

  it('12. Abrechnungsbereite Positionen im Bereich abrechnungsbereit', () => {
    saveBillableItem(TENANT, sampleBillable('ready'));
    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    if (!snapshot.ok) return;
    const bereit = snapshot.data.areas.find((a) => a.area === 'abrechnungsbereit');
    expect(bereit?.items.some((i) => i.relatedEntityId === 'bi-ready')).toBe(true);
  });

  it('13. Abrechnungsblocker werden erkannt', () => {
    saveBillableItem(TENANT, sampleBillable('missing_data'));
    syncBillingBlockerTasks(TENANT, 'client-001', {
      tenantId: TENANT,
      clientId: 'client-001',
      billableItemId: 'bi-missing_data',
      hasServiceProof: false,
    });

    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    if (!snapshot.ok) return;
    const blocker = snapshot.data.areas.find((a) => a.area === 'abrechnungsblocker');
    expect(blocker?.items.length).toBeGreaterThan(0);
    expect(listManagementTasks(TENANT, { taskType: 'billing_blocker' }).length).toBeGreaterThan(0);
  });

  it('14. Finalisierte Dokumente werden nicht überschrieben', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const record = createServiceRecord({
      tenantId: TENANT,
      assignmentId: created.data.id,
      clientId: 'client-001',
      employeeId: 'employee-003',
      serviceType: 'Alltagsbegleitung',
      deploymentDate: '2026-06-16',
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      documentationId: 'doc-003',
    });
    if (!record.ok) return;

    reviewServiceRecord({
      tenantId: TENANT,
      serviceRecordId: record.data.id,
      reviewerId: 'admin-001',
      decision: 'approved',
      actorRoleKey: ADMIN,
    });

    const correction = requestCorrection({
      tenantId: TENANT,
      assignmentId: created.data.id,
      serviceRecordId: record.data.id,
      requestedBy: 'admin-001',
      assignedToEmployeeId: 'employee-003',
      affectedArea: 'service_proof',
      reason: 'Nachkorrektur',
      requiredResponse: 'Neue Version',
      actorRoleKey: ADMIN,
    });
    expect(correction.ok).toBe(true);
    if (correction.ok) {
      expect(correction.data.documentVersion).toBeGreaterThan(1);
      expect(correction.data.correctedFromDocumentId).toBe(record.data.id);
    }
  });

  it('15. Production Mode blockiert Demo-Fallbacks', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    expect(snapshot.ok).toBe(false);
    if (!snapshot.ok) {
      expect(snapshot.error).toMatch(/Produktionsmodus|QM-Cockpit/);
    }
  });

  it('16. Automatische Aufgaben werden dedupliziert', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;
    const id = created.data.id;

    transitionAssignmentLiveStatus(TENANT, id, 'dokumentation_offen', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });
    transitionAssignmentLiveStatus(TENANT, id, 'beendet', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });
    transitionAssignmentLiveStatus(TENANT, id, 'dokumentation_offen', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });

    const tasks = listManagementTasks(TENANT, { taskType: 'missing_documentation', assignmentId: id });
    expect(tasks.length).toBe(1);

    const task = tasks[0];
    updateManagementTaskStatus(TENANT, task.id, 'archived', 'admin-001');
    expect(MANAGEMENT_TASK_AUTOMATION_RULES.length).toBe(13);
  });

  it('Dokumente fehlen erscheinen im Bereich dokumente', () => {
    registerClientDocument({
      tenantId: TENANT,
      clientId: 'client-001',
      documentType: 'contract',
      title: 'Pflegevertrag',
      status: 'missing',
      version: 0,
      finalizedAt: null,
      contentHash: null,
    });

    const snapshot = fetchQmCockpitSnapshot(TENANT, ADMIN);
    if (!snapshot.ok) return;
    const docs = snapshot.data.areas.find((a) => a.area === 'dokumente');
    expect(docs?.items.some((i) => i.title.includes('Pflegevertrag'))).toBe(true);
  });
});

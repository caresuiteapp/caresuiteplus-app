import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resetAssignmentWorkflowStore, upsertAssignmentWorkflowRecord } from '@/lib/assist/assignmentWorkflowService';
import {
  applyEmployeePortalTrackingForStatus,
  grantEmployeePortalLocationConsent,
  resetEmployeePortalVisitTrackingStore,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { resetEmployeePortalExecutionStore } from '@/lib/portal/employeePortalExecutionService';
import { getAssistLiveMonitoring } from '@/features/assistLive/getAssistLiveMonitoring';

const TENANT = DEMO_TENANT_ID;

describe('getAssistLiveMonitoring', () => {
  beforeEach(() => {
    resetAssignmentWorkflowStore();
    resetEmployeePortalExecutionStore();
    resetEmployeePortalVisitTrackingStore();
  });

  it('liefert read-only Overview mit Tracking aus Mitarbeiterportal (Demo-Pfad)', async () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    const end = new Date(now);
    end.setHours(12, 0, 0, 0);

    const record = upsertAssignmentWorkflowRecord({
      id: 'asg-live-monitor-1',
      tenantId: TENANT,
      clientId: 'client-001',
      employeeId: 'employee-003',
      serviceType: 'Test',
      assignmentType: 'single',
      plannedStartAt: now.toISOString(),
      plannedEndAt: end.toISOString(),
      plannedDurationMinutes: 120,
      actualStartAt: null,
      actualEndAt: null,
      status: 'unterwegs',
      canonicalStatus: 'confirmed',
      locationAddress: 'Berlin',
      notesForEmployee: '',
      internalNotes: '',
      clientVisibleNotes: '',
      billingRelevant: false,
      requiresSignature: false,
      requiresDocumentation: false,
      requiresRoute: false,
      createdBy: null,
      updatedBy: null,
      cancelledAt: null,
      completedAt: null,
      lockedAt: null,
      title: 'Live Monitor Test',
      tasks: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    grantEmployeePortalLocationConsent(TENANT, record.id);
    applyEmployeePortalTrackingForStatus(TENANT, record.id, 'bestaetigt', 'unterwegs');

    const result = await getAssistLiveMonitoring(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.readOnlyNotice).toContain('Mitarbeiterportal');
    expect(result.data.todayCount).toBe(1);
    expect(result.data.runningCount).toBeGreaterThanOrEqual(1);
    expect(result.data.rows.length).toBe(1);

    const row = result.data.rows.find((r) => r.assignmentId === record.id);
    expect(row?.tracking?.consent.granted).toBe(true);
    expect(row?.tracking?.trackingActive).toBe(true);
    expect(row?.tracking?.warnings).not.toContain(
      'Standort-Einwilligung ausstehend — Tracking startet erst nach Bestätigung.',
    );
  });

  it('todayCount und runningCount stimmen mit rows überein', async () => {
    const now = new Date();
    now.setHours(14, 0, 0, 0);
    const end = new Date(now);
    end.setHours(16, 0, 0, 0);

    upsertAssignmentWorkflowRecord({
      id: 'asg-live-monitor-2',
      tenantId: TENANT,
      clientId: 'client-001',
      employeeId: 'employee-001',
      serviceType: 'Test',
      assignmentType: 'single',
      plannedStartAt: now.toISOString(),
      plannedEndAt: end.toISOString(),
      plannedDurationMinutes: 120,
      actualStartAt: null,
      actualEndAt: null,
      status: 'gestartet',
      canonicalStatus: 'started',
      locationAddress: 'Berlin',
      notesForEmployee: '',
      internalNotes: '',
      clientVisibleNotes: '',
      billingRelevant: false,
      requiresSignature: false,
      requiresDocumentation: false,
      requiresRoute: false,
      createdBy: null,
      updatedBy: null,
      cancelledAt: null,
      completedAt: null,
      lockedAt: null,
      title: 'Laufender Einsatz',
      tasks: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const result = await getAssistLiveMonitoring(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.todayCount).toBe(result.data.rows.length);
    expect(result.data.runningCount).toBeGreaterThanOrEqual(1);
  });
});

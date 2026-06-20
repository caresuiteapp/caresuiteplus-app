import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resetAssignmentWorkflowStore, upsertAssignmentWorkflowRecord } from '@/lib/assist/assignmentWorkflowService';
import { fetchAssistLiveStatusOverview } from '@/lib/assist/assistLiveTrackingViewService';
import {
  applyEmployeePortalTrackingForStatus,
  grantEmployeePortalLocationConsent,
  resetEmployeePortalVisitTrackingStore,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { resetEmployeePortalExecutionStore } from '@/lib/portal/employeePortalExecutionService';

const TENANT = DEMO_TENANT_ID;

describe('assistLiveTrackingViewService', () => {
  beforeEach(() => {
    resetAssignmentWorkflowStore();
    resetEmployeePortalExecutionStore();
    resetEmployeePortalVisitTrackingStore();
  });

  it('fetchAssistLiveStatusOverview markiert read-only und Tracking aus Mitarbeiterportal', async () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    const end = new Date(now);
    end.setHours(12, 0, 0, 0);

    const record = upsertAssignmentWorkflowRecord({
      id: 'asg-live-gps-1',
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
      title: 'Live GPS Test',
      tasks: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    grantEmployeePortalLocationConsent(TENANT, record.id);
    applyEmployeePortalTrackingForStatus(TENANT, record.id, 'bestaetigt', 'unterwegs');

    const result = await fetchAssistLiveStatusOverview(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.readOnlyNotice).toContain('Mitarbeiterportal');
    const row = result.data.rows.find((r) => r.assignmentId === record.id);
    expect(row?.tracking?.consent.granted).toBe(true);
    expect(row?.status).toBe('unterwegs');
    expect(row?.tracking?.trackingActive).toBe(true);
  });
});

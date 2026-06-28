import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resetAssignmentWorkflowStore, upsertAssignmentWorkflowRecord } from '@/lib/assist/assignmentWorkflowService';
import {
  projectClientPortalAssistLiveVisit,
  sanitizeClientPortalLiveVisitPayload,
} from '@/lib/portal/clientPortalAssistLiveVisitService';
import {
  applyEmployeePortalTrackingForStatus,
  grantEmployeePortalLocationConsent,
  peekEmployeePortalTrackingEntry,
  resetEmployeePortalVisitTrackingStore,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { resetEmployeePortalExecutionStore } from '@/lib/portal/employeePortalExecutionService';

const TENANT = DEMO_TENANT_ID;

describe('clientPortalAssistLiveVisitService', () => {
  beforeEach(() => {
    resetAssignmentWorkflowStore();
    resetEmployeePortalExecutionStore();
    resetEmployeePortalVisitTrackingStore();
  });

  it('strippt GPS-Verlauf und liefert nur letzte Position', () => {
    const sanitized = sanitizeClientPortalLiveVisitPayload({
      mapVisible: true,
      statusLabel: 'Unterwegs',
      lastPosition: {
        latitude: 52.52,
        longitude: 13.4,
        accuracyMeters: 12,
        capturedAt: '2026-06-23T10:00:00.000Z',
      },
      fallbackMessage: null,
      assignmentId: '00000000-0000-0000-0000-000000000099',
      visitId: '00000000-0000-0000-0000-000000000099',
    });

    expect(Object.keys(sanitized)).toEqual([
      'mapVisible',
      'statusLabel',
      'lastPosition',
      'fallbackMessage',
      'assignmentId',
    ]);
    expect(sanitized.lastPosition).toEqual({
      latitude: 52.52,
      longitude: 13.4,
      accuracyMeters: 12,
      capturedAt: '2026-06-23T10:00:00.000Z',
    });
  });

  it('blendet Karte außerhalb aktiver Einsatzphase aus', async () => {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 3_600_000);

    upsertAssignmentWorkflowRecord({
      id: 'asg-done',
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
      status: 'abgeschlossen',
      canonicalStatus: 'completed',
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
      completedAt: now.toISOString(),
      lockedAt: null,
      title: 'Abgeschlossen',
      tasks: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const result = await projectClientPortalAssistLiveVisit({
      tenantId: TENANT,
      clientId: 'client-001',
      assignmentId: 'asg-done',
      status: 'abgeschlossen',
      plannedStartAt: now.toISOString(),
      plannedEndAt: end.toISOString(),
      portalReleaseEnabled: true,
    });

    expect(result.mapVisible).toBe(false);
    expect(result.lastPosition).toBeNull();
    expect(result.fallbackMessage).toContain('laufenden Einsatzes');
  });

  it('zeigt letzte Position nur für den eigenen Einsatz im Demo-Store', async () => {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 3_600_000);

    const record = upsertAssignmentWorkflowRecord({
      id: 'asg-portal-live-1',
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
      title: 'Portal Live Map',
      tasks: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    grantEmployeePortalLocationConsent(TENANT, record.id);
    applyEmployeePortalTrackingForStatus(TENANT, record.id, 'bestaetigt', 'unterwegs');
    const entry = peekEmployeePortalTrackingEntry(TENANT, record.id);
    entry.lastPosition = {
      latitude: 52.51,
      longitude: 13.39,
      accuracyMeters: 20,
      capturedAt: now.toISOString(),
    };

    const ownVisit = await projectClientPortalAssistLiveVisit({
      tenantId: TENANT,
      clientId: 'client-001',
      assignmentId: record.id,
      status: 'unterwegs',
      plannedStartAt: now.toISOString(),
      plannedEndAt: end.toISOString(),
      portalReleaseEnabled: true,
    });

    expect(ownVisit.mapVisible).toBe(true);
    expect(ownVisit.lastPosition?.latitude).toBe(52.51);

    const otherClient = await projectClientPortalAssistLiveVisit({
      tenantId: TENANT,
      clientId: 'client-999',
      assignmentId: record.id,
      status: 'unterwegs',
      plannedStartAt: now.toISOString(),
      plannedEndAt: end.toISOString(),
      portalReleaseEnabled: true,
    });

    expect(otherClient.mapVisible).toBe(false);
    expect(otherClient.lastPosition).toBeNull();
  });
});

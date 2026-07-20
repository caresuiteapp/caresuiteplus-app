import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mergeVisitDispositionWithExecution } from '@/lib/assist/visitDispositionExecutionEnrichment';
import { applySnapshotToVisitListItem } from '@/lib/assist/overlayVisitDispositionFromAssignment';
import type { VisitDispositionDetail, VisitDispositionListItem } from '@/lib/assist/visitTypes';
import type { AssignmentExecutionSnapshot } from '@/lib/assist/resolveAssignmentExecutionSnapshot';

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => null,
}));

const TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const ASSIGNMENT_ID = '70f800b8-a04f-44ae-846f-dcc7f6f6497a';

function staleVisitDetail(): VisitDispositionDetail {
  return {
    id: ASSIGNMENT_ID,
    tenantId: TENANT,
    clientId: 'client-1',
    employeeId: 'employee-1',
    title: 'Hauswirtschaftliche Unterstützung',
    serviceName: 'Entlastungsleistung §45b SGB XI',
    scheduledStart: '2026-07-01T14:00:00.000Z',
    scheduledEnd: '2026-07-01T17:00:00.000Z',
    durationMinutes: 180,
    status: 'aktiv',
    assignmentStatus: 'bestaetigt',
    planningStatus: 'confirmed',
    proofStatus: 'none',
    billingStatus: 'preview',
    location: 'Ringstraße 3, Herne',
    clientName: 'Heinz-Peter Reinhardt',
    employeeName: 'Mhi Aldeen Al Jlelati',
    isAtRisk: false,
    isIncomplete: true,
    updatedAt: '2026-07-01T18:32:39.416487Z',
    serviceKey: null,
    description: null,
    notes: null,
    employeeNotes: null,
    executionStatus: 'pending',
    documentationStatus: 'none',
    portalStatus: 'scheduled',
    allowedStatusTransitions: [],
    tasks: [
      { id: 't1', title: 'Küche reinigen', status: 'open', isRequired: true, notDoneReason: null },
    ],
    budget: null,
    portalReleaseEnabled: true,
    employeePortalVisible: true,
    errorCode: null,
    errorMessage: null,
    onTheWayAt: null,
    arrivedAt: null,
    finishedAt: null,
    actualStartAt: null,
    actualEndAt: null,
    createdAt: '2026-07-01T12:00:00.000Z',
  };
}

function staleListItem(): VisitDispositionListItem {
  const detail = staleVisitDetail();
  return {
    id: detail.id,
    tenantId: detail.tenantId,
    clientId: detail.clientId,
    title: detail.title,
    serviceName: detail.serviceName,
    scheduledStart: detail.scheduledStart,
    scheduledEnd: detail.scheduledEnd,
    durationMinutes: detail.durationMinutes,
    status: detail.status,
    assignmentStatus: detail.assignmentStatus,
    planningStatus: detail.planningStatus,
    proofStatus: detail.proofStatus,
    billingStatus: detail.billingStatus,
    location: detail.location,
    clientName: detail.clientName,
    employeeId: detail.employeeId,
    employeeName: detail.employeeName,
    isAtRisk: detail.isAtRisk,
    isIncomplete: detail.isIncomplete,
    updatedAt: detail.updatedAt,
  };
}

function portalSnapshot(status: AssignmentExecutionSnapshot['assignmentStatus']): AssignmentExecutionSnapshot {
  return {
    assignmentId: ASSIGNMENT_ID,
    visitId: ASSIGNMENT_ID,
    assignmentStatus: status,
    hasDocumentation: true,
    documentationNotes: 'Alles erledigt',
    hasSignature: status === 'unterschrift_offen' || status === 'abgeschlossen',
    hasProof: false,
    proofStatus: null,
    tasks: [
      { id: 'a1', title: 'Küche reinigen', status: 'done', isRequired: true, notDoneReason: null },
    ],
    openRequiredTasks: 0,
    documentationMissing: false,
    signatureMissing: status === 'beendet' || status === 'dokumentation_offen',
    isIncomplete: status !== 'abgeschlossen' && status !== 'unterschrift_offen',
    visitTimes: null,
    photoReferences: [],
  };
}

describe('portal execution sync consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('office list and detail agree on assignment status after portal completion', () => {
    const snapshot = portalSnapshot('beendet');
    const listItem = applySnapshotToVisitListItem(staleListItem(), snapshot);
    const officeDetail = mergeVisitDispositionWithExecution({
      detail: staleVisitDetail(),
      assignmentStatus: snapshot.assignmentStatus,
      assignmentTasks: snapshot.tasks,
      documentationText: snapshot.documentationNotes,
      visitTimes: null,
      executionStateStatus: snapshot.assignmentStatus,
      hasSignature: snapshot.hasSignature,
      hasProof: snapshot.hasProof,
      persistedSignature: null,
      assignmentOnTheWayAt: null,
      assignmentArrivedAt: null,
      assignmentActualStartAt: '2026-07-01T15:30:50.188Z',
      assignmentActualEndAt: '2026-07-01T18:32:30.804Z',
      assignmentFinishedAt: null,
    });

    expect(listItem.assignmentStatus).toBe('unterschrift_offen');
    expect(officeDetail.assignmentStatus).toBe('unterschrift_offen');
    expect(listItem.assignmentStatus).toBe(officeDetail.assignmentStatus);
    expect(officeDetail.tasks.find((t) => t.title === 'Küche reinigen')?.status).toBe('done');
    expect(officeDetail.documentationStatus).toBe('complete');
    expect(officeDetail.employeeNotes).toBe('Alles erledigt');
  });

  it('employee portal list overlay matches completed assignment status', () => {
    const snapshot = portalSnapshot('abgeschlossen');
    const listItem = applySnapshotToVisitListItem(staleListItem(), snapshot);
    expect(listItem.assignmentStatus).toBe('abgeschlossen');
    expect(listItem.status).toBe('abgeschlossen');
    expect(listItem.isIncomplete).toBe(false);
  });

  it('shows persisted arrival and start times while the visit is still running', () => {
    const snapshot = portalSnapshot('gestartet');
    snapshot.visitTimes = {
      driveSeconds: 600,
      serviceSeconds: 300,
      pauseSeconds: null,
      totalSeconds: 900,
      driveStartedAt: '2026-07-20T06:50:00.000Z',
      arrivedAt: '2026-07-20T07:00:00.000Z',
      serviceStartedAt: '2026-07-20T07:01:00.000Z',
      serviceEndedAt: null,
      pauseStartedAt: null,
      activeTimer: 'service',
    };

    const listItem = applySnapshotToVisitListItem(staleListItem(), snapshot);

    expect(listItem.onTheWayAt).toBe('2026-07-20T06:50:00.000Z');
    expect(listItem.arrivedAt).toBe('2026-07-20T07:00:00.000Z');
    expect(listItem.actualStartAt).toBe('2026-07-20T07:01:00.000Z');
    expect(listItem.actualEndAt).toBeUndefined();
  });
});

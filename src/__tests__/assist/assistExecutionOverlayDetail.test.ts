import { describe, expect, it } from 'vitest';
import { applySnapshotToDetail } from '@/lib/assist/overlayVisitDispositionFromAssignment';
import type { AssignmentExecutionSnapshot } from '@/lib/assist/resolveAssignmentExecutionSnapshot';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

const TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const VISIT_ID = '11111111-1111-4111-8111-111111111111';
const ASSIGNMENT_ID = 'da96df00-a106-4b1c-9185-123790dea5d6';

function staleVisitDetail(): VisitDispositionDetail {
  return {
    id: VISIT_ID,
    tenantId: TENANT,
    clientId: 'client-1',
    employeeId: 'employee-1',
    title: 'Hauswirtschaft',
    serviceName: 'Entlastungsleistung',
    scheduledStart: '2026-07-07T08:00:00.000Z',
    scheduledEnd: '2026-07-07T10:00:00.000Z',
    durationMinutes: 120,
    status: 'aktiv',
    assignmentStatus: 'bestaetigt',
    planningStatus: 'confirmed',
    proofStatus: 'none',
    billingStatus: 'preview',
    location: 'Musterstraße 1',
    clientName: 'Doris Niemeyer',
    employeeName: 'Kathrin Pott',
    isAtRisk: false,
    isIncomplete: true,
    updatedAt: '2026-07-07T10:00:00.000Z',
    serviceKey: null,
    description: null,
    notes: null,
    employeeNotes: 'Bitte den Wohnungsschlüssel anschließend zurücklegen.',
    executionStatus: 'pending',
    documentationStatus: 'none',
    portalStatus: 'scheduled',
    allowedStatusTransitions: [],
    tasks: [],
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
    createdAt: '2026-07-07T06:00:00.000Z',
  };
}

function deferredSignatureSnapshot(): AssignmentExecutionSnapshot {
  return {
    assignmentId: ASSIGNMENT_ID,
    visitId: VISIT_ID,
    assignmentStatus: 'unterschrift_offen',
    executionStateStatus: 'abgeschlossen',
    executionStatus: 'completed',
    documentationStatus: 'complete',
    proofStatus: 'pending',
    serviceEnded: true,
    hasDocumentation: true,
    documentationNotes: 'Einsatz dokumentiert',
    hasSignature: false,
    hasProof: true,
    tasks: [],
    openRequiredTasks: 0,
    documentationMissing: false,
    signatureMissing: true,
    isIncomplete: true,
    visitTimes: {
      driveSeconds: 600,
      serviceSeconds: 7200,
      pauseSeconds: null,
      totalSeconds: 7800,
      driveStartedAt: '2026-07-07T08:05:00.000Z',
      arrivedAt: null,
      serviceStartedAt: '2026-07-07T08:20:00.000Z',
      pauseStartedAt: null,
      serviceEndedAt: '2026-07-07T10:15:00.000Z',
      activeTimer: null,
    },
    photoReferences: [],
  };
}

describe('assist execution overlay detail', () => {
  it('merges deferred-signature portal execution into stale assist visit detail', () => {
    const merged = applySnapshotToDetail(staleVisitDetail(), deferredSignatureSnapshot());

    expect(merged.executionStatus).toBe('completed');
    expect(merged.assignmentStatus).toBe('unterschrift_offen');
    expect(merged.onTheWayAt).toBe('2026-07-07T08:05:00.000Z');
    expect(merged.actualStartAt).toBe('2026-07-07T08:20:00.000Z');
    expect(merged.actualEndAt).toBe('2026-07-07T10:15:00.000Z');
    expect(merged.documentationStatus).toBe('complete');
    expect(merged.proofStatus).toBe('pending');
    expect(merged.documentationNotes).toBe('Einsatz dokumentiert');
    expect(merged.employeeNotes).toBe(
      'Bitte den Wohnungsschlüssel anschließend zurücklegen.',
    );
  });
});

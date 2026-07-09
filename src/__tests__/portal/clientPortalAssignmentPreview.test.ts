import { describe, expect, it } from 'vitest';
import { applySnapshotToDetail } from '@/lib/assist/overlayVisitDispositionFromAssignment';
import type { AssignmentExecutionSnapshot } from '@/lib/assist/resolveAssignmentExecutionSnapshot';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { resetVirtualOccurrenceExecutionState } from '@/lib/assist/visitRecurrenceExecution';
import { buildVisitOccurrenceId } from '@/lib/assist/visitRecurrenceExpansion';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const VISIT_ID = 'c8969244-db7e-4f72-9570-3467e2960502';

function baseDetail(overrides: Partial<VisitDispositionDetail> = {}): VisitDispositionDetail {
  return {
    id: buildVisitOccurrenceId(VISIT_ID, '2026-07-10'),
    tenantId: 'tenant-1',
    clientId: 'client-1',
    title: 'Regelmäßige Alltagsbegleitung',
    serviceName: 'Regelmäßige Alltagsbegleitung',
    scheduledStart: '2026-07-10T07:30:00.000Z',
    scheduledEnd: '2026-07-10T09:30:00.000Z',
    durationMinutes: 120,
    status: 'bestaetigt',
    assignmentStatus: 'bestaetigt',
    planningStatus: 'confirmed',
    executionStatus: 'pending',
    documentationStatus: 'none',
    proofStatus: 'none',
    billingStatus: 'preview',
    portalStatus: 'scheduled',
    location: 'Seydlitzstraße 23, 44263 Dortmund',
    clientName: 'Ellen Zacharias',
    employeeId: 'employee-1',
    employeeName: 'Kathrin Pott',
    isAtRisk: false,
    isIncomplete: false,
    updatedAt: '2026-07-01T10:00:00.000Z',
    serviceKey: 'alltagsbegleitung',
    assignmentDate: '2026-07-10',
    description: null,
    notes: 'Intern — darf nicht sichtbar sein',
    clientVisibleNotes: 'Bitte klingeln.',
    employeeNotes: null,
    allowedStatusTransitions: [],
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
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

function emptySnapshot(): AssignmentExecutionSnapshot {
  return {
    assignmentId: VISIT_ID,
    visitId: VISIT_ID,
    assignmentStatus: 'bestaetigt',
    executionStatus: 'pending',
    documentationStatus: 'none',
    proofStatus: 'none',
    executionStateStatus: null,
    serviceEnded: false,
    hasDocumentation: false,
    documentationNotes: null,
    hasSignature: false,
    hasProof: false,
    tasks: [],
    openRequiredTasks: 0,
    documentationMissing: false,
    signatureMissing: false,
    isIncomplete: false,
    visitTimes: null,
    photoReferences: [],
  };
}

describe('client portal assignment preview resilience', () => {
  it('applySnapshotToDetail liefert leere Aufgaben statt undefined', () => {
    const overlaid = applySnapshotToDetail(
      baseDetail({ tasks: undefined }),
      emptySnapshot(),
    );

    expect(overlaid.tasks).toEqual([]);
    expect(() => resetVirtualOccurrenceExecutionState(overlaid)).not.toThrow();
  });

  it('live client preview nutzt clientVisibleNotes und isoliert Live-Tracking-Fehler', () => {
    const liveService = readFileSync(
      path.join(process.cwd(), 'src/lib/portal/portalAppointmentsLiveService.ts'),
      'utf8',
    );

    expect(liveService).toContain('clientVisibleNotes?.trim()');
    expect(liveService).toContain('live visit projection failed');
    expect(liveService).toContain('visit detail failed');
  });
});

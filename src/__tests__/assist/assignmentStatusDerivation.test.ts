import { describe, expect, it } from 'vitest';
import { applySnapshotToVisitListItem } from '@/lib/assist/overlayVisitDispositionFromAssignment';
import {
  deriveAssignmentStatusFromVisitDimensions,
  pickAdvancedAssignmentStatus,
} from '@/lib/assist/visitWorkflow';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import type { AssignmentExecutionSnapshot } from '@/lib/assist/resolveAssignmentExecutionSnapshot';

describe('assignment status derivation', () => {
  it('derives dokumentation_offen when execution completed but documentation open', () => {
    expect(
      deriveAssignmentStatusFromVisitDimensions({
        canonicalStatus: 'bestaetigt',
        executionStatus: 'completed',
        documentationStatus: 'open',
        proofStatus: 'none',
      }),
    ).toBe('dokumentation_offen');
  });

  it('derives unterschrift_offen when documentation complete but proof pending', () => {
    expect(
      deriveAssignmentStatusFromVisitDimensions({
        canonicalStatus: 'bestaetigt',
        executionStatus: 'completed',
        documentationStatus: 'complete',
        proofStatus: 'pending',
      }),
    ).toBe('unterschrift_offen');
  });

  it('derives abgeschlossen when execution and proof are complete', () => {
    expect(
      deriveAssignmentStatusFromVisitDimensions({
        canonicalStatus: 'bestaetigt',
        executionStatus: 'completed',
        documentationStatus: 'complete',
        proofStatus: 'verified',
      }),
    ).toBe('abgeschlossen');
  });

  it('pickAdvancedAssignmentStatus keeps the more advanced status', () => {
    expect(pickAdvancedAssignmentStatus('bestaetigt', 'abgeschlossen')).toBe('abgeschlossen');
    expect(pickAdvancedAssignmentStatus('abgeschlossen', 'bestaetigt')).toBe('abgeschlossen');
  });

  it('list overlay prefers visit-derived status over stale assignment snapshot', () => {
    const item: VisitDispositionListItem = {
      id: 'visit-1',
      tenantId: 'tenant-1',
      title: 'Entlastungsleistung',
      serviceName: 'Entlastungsleistung § 45b SGB XI',
      scheduledStart: '2026-07-07T10:30:00.000Z',
      scheduledEnd: '2026-07-07T13:00:00.000Z',
      durationMinutes: 150,
      status: 'aktiv',
      assignmentStatus: 'unterschrift_offen',
      planningStatus: 'confirmed',
      proofStatus: 'pending',
      billingStatus: 'ready',
      location: 'Berlin',
      clientName: 'Ramona König',
      employeeId: 'employee-1',
      employeeName: 'Mhi Aldeen Al Jlelati',
      isAtRisk: false,
      isIncomplete: true,
      updatedAt: '2026-07-07T15:32:00.000Z',
    };

    const snapshot: AssignmentExecutionSnapshot = {
      assignmentId: 'visit-1',
      visitId: 'visit-1',
      assignmentStatus: 'bestaetigt',
      hasDocumentation: true,
      documentationNotes: 'Erledigt',
      hasSignature: false,
      hasProof: false,
      proofStatus: null,
      tasks: [],
      openRequiredTasks: 0,
      documentationMissing: false,
      signatureMissing: true,
      isIncomplete: true,
      visitTimes: null,
    };

    const overlaid = applySnapshotToVisitListItem(item, snapshot);
    expect(overlaid.assignmentStatus).toBe('unterschrift_offen');
    expect(overlaid.status).toBe('in_bearbeitung');
  });
});

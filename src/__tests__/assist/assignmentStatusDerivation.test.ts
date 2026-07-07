import { describe, expect, it } from 'vitest';
import {
  buildAssignmentFooterChips,
  resolveAssignmentCardBadge,
} from '@/lib/assist/assignmentCardPresentation';
import { applySnapshotToVisitListItem } from '@/lib/assist/overlayVisitDispositionFromAssignment';
import {
  deriveAssignmentStatusFromVisitDimensions,
  pickAdvancedAssignmentStatus,
  resolveAssignmentStatusFromExecutionContext,
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

  it('does not let stale canonical abgeschlossen override missing signature', () => {
    expect(
      deriveAssignmentStatusFromVisitDimensions({
        canonicalStatus: 'abgeschlossen',
        executionStatus: 'completed',
        documentationStatus: 'complete',
        proofStatus: 'pending',
      }),
    ).toBe('unterschrift_offen');
  });

  it('pickAdvancedAssignmentStatus keeps the more advanced status', () => {
    expect(pickAdvancedAssignmentStatus('bestaetigt', 'abgeschlossen')).toBe('abgeschlossen');
    expect(pickAdvancedAssignmentStatus('abgeschlossen', 'bestaetigt')).toBe('abgeschlossen');
  });

  it('resolveAssignmentStatusFromExecutionContext uses portal artifacts when assignment row lags', () => {
    expect(
      resolveAssignmentStatusFromExecutionContext({
        assignmentStatus: 'bestaetigt',
        executionStatus: 'completed',
        documentationStatus: 'complete',
        proofStatus: 'pending',
        hasDocumentation: true,
        hasSignature: false,
        serviceEnded: true,
      }),
    ).toBe('unterschrift_offen');
  });

  it('Ramona König scenario: completed visit, doc done, signature open, assignment confirmed', () => {
    const item: VisitDispositionListItem = {
      id: 'visit-ramona',
      tenantId: 'tenant-1',
      title: 'Entlastungsleistung',
      serviceName: 'Entlastungsleistung § 45b SGB XI',
      scheduledStart: '2026-07-07T10:30:00.000Z',
      scheduledEnd: '2026-07-07T13:00:00.000Z',
      durationMinutes: 150,
      status: 'aktiv',
      assignmentStatus: 'unterschrift_offen',
      planningStatus: 'confirmed',
      executionStatus: 'completed',
      documentationStatus: 'complete',
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
      assignmentId: 'visit-ramona',
      visitId: 'visit-ramona',
      assignmentStatus: 'bestaetigt',
      executionStatus: 'completed',
      documentationStatus: 'complete',
      proofStatus: 'pending',
      hasDocumentation: true,
      documentationNotes: 'Erledigt',
      hasSignature: false,
      hasProof: false,
      serviceEnded: true,
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

    const badge = resolveAssignmentCardBadge({
      id: item.id,
      tenantId: item.tenantId,
      employeeId: item.employeeId ?? '',
      title: item.title,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
      status: overlaid.status,
      assignmentStatus: overlaid.assignmentStatus,
      proofStatus: overlaid.proofStatus,
      documentationStatus: overlaid.documentationStatus,
      executionStatus: overlaid.executionStatus,
      location: item.location,
      clientName: item.clientName,
      employeeName: item.employeeName,
      updatedAt: item.updatedAt,
      isIncomplete: overlaid.isIncomplete,
    });
    expect(badge.label).toBe('Unterschrift offen');
    expect(badge.variant).toBe('orange');

    const chips = buildAssignmentFooterChips({
      id: item.id,
      tenantId: item.tenantId,
      employeeId: item.employeeId ?? '',
      title: item.title,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
      status: overlaid.status,
      assignmentStatus: overlaid.assignmentStatus,
      proofStatus: overlaid.proofStatus,
      documentationStatus: overlaid.documentationStatus,
      executionStatus: overlaid.executionStatus,
      location: item.location,
      clientName: item.clientName,
      employeeName: item.employeeName,
      updatedAt: item.updatedAt,
      isIncomplete: overlaid.isIncomplete,
    });
    expect(chips.find((chip) => chip.id === 'docs')?.variant).toBe('green');
    expect(chips.find((chip) => chip.id === 'signature')?.label).toBe('Unterschrift offen');
    expect(chips.find((chip) => chip.id === 'signature')?.variant).toBe('orange');
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
      proofStatus: 'pending',
      serviceEnded: true,
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

  it('does not show green Abgeschlossen when assignments row says completed but signature missing', () => {
    const status = resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: 'abgeschlossen',
      executionStatus: 'completed',
      documentationStatus: 'complete',
      proofStatus: 'pending',
      hasDocumentation: true,
      hasSignature: false,
      serviceEnded: true,
    });
    expect(status).toBe('unterschrift_offen');
  });
});

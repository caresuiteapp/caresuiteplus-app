import { describe, expect, it } from 'vitest';
import { applySnapshotToVisitListItem } from '@/lib/assist/overlayVisitDispositionFromAssignment';
import { expandVisitRowToListItems } from '@/lib/assist/visitRecurrenceExpansion';
import { buildVisitOccurrenceId } from '@/lib/assist/visitRecurrenceExpansion';
import {
  neutralizeFutureOccurrenceListItem,
  resetVirtualOccurrenceListItem,
} from '@/lib/assist/visitRecurrenceExecution';
import type { AssignmentExecutionSnapshot } from '@/lib/assist/resolveAssignmentExecutionSnapshot';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';

const ELLEN_MASTER_ID = 'c8969244-db7e-4f72-9570-3467e2960502';
const DAGMAR_MASTER_ID = '78ea2672-73cc-439b-99ae-1b53fb8bf966';

function completedMasterListItem(
  overrides: Partial<VisitDispositionListItem> = {},
): VisitDispositionListItem {
  return {
    id: ELLEN_MASTER_ID,
    tenantId: '56180c22-b894-4fab-b55e-a563c94dd6e7',
    clientId: 'client-ellen',
    title: 'Regelmäßige Alltagsbegleitung',
    serviceName: 'Regelmäßige Alltagsbegleitung',
    scheduledStart: '2026-07-03T07:30:00.000Z',
    scheduledEnd: '2026-07-03T09:30:00.000Z',
    durationMinutes: 120,
    status: 'abgeschlossen',
    assignmentStatus: 'abgeschlossen',
    planningStatus: 'confirmed',
    proofStatus: 'signed',
    billingStatus: 'preview',
    location: 'Seydlitzstraße 23',
    clientName: 'Ellen Zacharias',
    employeeId: 'employee-1',
    employeeName: 'Kathrin Pott',
    isAtRisk: false,
    isIncomplete: false,
    updatedAt: '2026-07-03T10:00:00.000Z',
    ...overrides,
  };
}

const completedMasterSnapshot: AssignmentExecutionSnapshot = {
  assignmentId: ELLEN_MASTER_ID,
  visitId: ELLEN_MASTER_ID,
  assignmentStatus: 'abgeschlossen',
  hasDocumentation: true,
  documentationNotes: 'Erledigt',
  hasSignature: true,
  hasProof: true,
  proofStatus: 'signed',
  tasks: [],
  openRequiredTasks: 0,
  documentationMissing: false,
  signatureMissing: false,
  isIncomplete: false,
  visitTimes: null,
};

describe('series occurrence list pipeline', () => {
  it('keeps completed master anchor while resetting future Ellen occurrences', () => {
    const expanded = expandVisitRowToListItems(
      {
        assignment_date: '2026-07-03',
        planned_start_at: '2026-07-03T07:30:00.000Z',
        planned_end_at: '2026-07-03T09:30:00.000Z',
        recurrence_json: { pattern: 'weekly', weekdays: ['fr'], occurrenceCount: 5 },
      },
      completedMasterListItem(),
    );

    const anchor = expanded.find((item) => item.id === ELLEN_MASTER_ID);
    const july10 = expanded.find((item) => item.id === buildVisitOccurrenceId(ELLEN_MASTER_ID, '2026-07-10'));
    const july17 = expanded.find((item) => item.id === buildVisitOccurrenceId(ELLEN_MASTER_ID, '2026-07-17'));
    const july24 = expanded.find((item) => item.id === buildVisitOccurrenceId(ELLEN_MASTER_ID, '2026-07-24'));
    const july31 = expanded.find((item) => item.id === buildVisitOccurrenceId(ELLEN_MASTER_ID, '2026-07-31'));

    expect(anchor?.status).toBe('abgeschlossen');
    for (const future of [july10, july17, july24, july31]) {
      expect(future?.status).toBe('bestaetigt');
      expect(future?.assignmentStatus).toBe('bestaetigt');
      expect(future?.proofStatus).toBe('none');
    }
  });

  it('neutralizes overlay leak from master snapshot onto future virtual occurrences', () => {
    const futureItem = resetVirtualOccurrenceListItem(
      completedMasterListItem({
        id: buildVisitOccurrenceId(ELLEN_MASTER_ID, '2026-07-10'),
        scheduledStart: '2026-07-10T07:30:00.000Z',
        scheduledEnd: '2026-07-10T09:30:00.000Z',
      }),
    );

    const leaked = applySnapshotToVisitListItem(futureItem, completedMasterSnapshot);
    const fixed = neutralizeFutureOccurrenceListItem(leaked);

    expect(leaked.status).toBe('abgeschlossen');
    expect(fixed.status).toBe('bestaetigt');
    expect(fixed.proofStatus).toBe('none');
  });

  it('resets future Dagmar Ritzenhoff occurrences after expansion', () => {
    const expanded = expandVisitRowToListItems(
      {
        assignment_date: '2026-07-06',
        planned_start_at: '2026-07-06T07:00:00.000Z',
        planned_end_at: '2026-07-06T09:00:00.000Z',
        recurrence_json: { pattern: 'weekly', weekdays: ['mo'], occurrenceCount: 4 },
      },
      completedMasterListItem({
        id: DAGMAR_MASTER_ID,
        title: 'Hauswirtschaftliche Unterstützung',
        clientName: 'Dagmar Ritzenhoff',
        scheduledStart: '2026-07-06T07:00:00.000Z',
        scheduledEnd: '2026-07-06T09:00:00.000Z',
      }),
    );

    for (const date of ['2026-07-13', '2026-07-20', '2026-07-27']) {
      const item = expanded.find((row) => row.id === buildVisitOccurrenceId(DAGMAR_MASTER_ID, date));
      expect(item?.status).toBe('bestaetigt');
      expect(item?.assignmentStatus).toBe('bestaetigt');
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fetchAssignmentExecutionSnapshotBatch } from '@/lib/assist/resolveAssignmentExecutionSnapshot';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitTaskItem } from '@/lib/assist/visitTypes';

vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }));

const tasks: VisitTaskItem[] = Array.from({ length: 11 }, (_, index) => ({
  id: `task-${index}`, title: `Aufgabe ${index + 1}`, status: 'open',
  isRequired: true, notDoneReason: null,
}));

async function snapshot(status: AssignmentStatus, fallbackTasks = tasks) {
  const result = await fetchAssignmentExecutionSnapshotBatch('tenant-a', [{
    assignmentId: 'assignment-a', visitId: 'visit-a', fallbackStatus: status, fallbackTasks,
  }]);
  return result.get('assignment-a')!;
}

describe('expected task progress versus incomplete visit results', () => {
  it.each(['geplant', 'bestaetigt', 'unterwegs', 'angekommen', 'gestartet', 'pausiert'] as const)(
    'does not mark %s incomplete just because planned work is still open', async status => {
      const result = await snapshot(status);
      expect(result.isIncomplete).toBe(false);
      expect(result.openRequiredTasks).toBe(11);
      expect(result.tasks).toEqual(tasks);
      expect(result.documentationMissing).toBe(false);
      expect(result.signatureMissing).toBe(false);
    },
  );

  it.each(['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'] as const)(
    'retains incomplete results and open-task counts after execution: %s', async status => {
      const result = await snapshot(status);
      expect(result.isIncomplete).toBe(true);
      expect(result.openRequiredTasks).toBe(11);
    },
  );

  it.each(['storniert', 'nicht_erschienen'] as const)(
    'does not turn unperformed tasks into an incomplete-results warning for %s', async status => {
      const result = await snapshot(status);
      expect(result.isIncomplete).toBe(false);
      expect(result.openRequiredTasks).toBe(11);
    },
  );

  it.each([true, false])('keeps required-task results distinct from optional work after verified completion: required=%s', async required => {
    const results = await fetchAssignmentExecutionSnapshotBatch('tenant-a', [{
      assignmentId: 'assignment-a', visitId: 'visit-a', fallbackStatus: 'abgeschlossen',
      fallbackTasks: tasks.map(task => ({ ...task, isRequired: required })),
      executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'verified',
    }]);
    const result = results.get('assignment-a')!;
    expect(result.isIncomplete).toBe(required);
    expect(result.openRequiredTasks).toBe(required ? 11 : 0);
    expect(result.documentationMissing).toBe(false);
    expect(result.signatureMissing).toBe(false);
  });
});

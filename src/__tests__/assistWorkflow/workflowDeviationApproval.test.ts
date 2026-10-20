import { describe, expect, it } from 'vitest';
import { isValidWorkflowDeviationApproval } from '@/features/assistWorkflow/startService';

describe('workflow deviation approval binding', () => {
  it('unblocks the exact visit and phase after a valid written justification', () => {
    expect(isValidWorkflowDeviationApproval({
      deviationApproved: true,
      deviationPhase: 'start',
      deviationVisitId: 'visit-1',
      deviationActualAt: '2026-08-03T10:00:00.000Z',
      deviationJustification: 'Der vorherige Einsatz dauerte länger als geplant.',
    }, 'visit-1', 'start')).toBe(true);
  });

  it('rejects stale, cross-visit, cross-phase and empty approvals', () => {
    const base = {
      deviationApproved: true,
      deviationPhase: 'start' as const,
      deviationVisitId: 'visit-1',
      deviationActualAt: '2026-08-03T10:00:00.000Z',
      deviationJustification: 'Ausführliche und nachvollziehbare Begründung.',
    };
    expect(isValidWorkflowDeviationApproval(base, 'visit-2', 'start')).toBe(false);
    expect(isValidWorkflowDeviationApproval(base, 'visit-1', 'end')).toBe(false);
    expect(isValidWorkflowDeviationApproval({ ...base, deviationJustification: 'zu kurz' }, 'visit-1', 'start')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { isStaleWorkflowTransitionError } from '@/features/assistWorkflow/internal/isStaleWorkflowTransitionError';

describe('isStaleWorkflowTransitionError', () => {
  it('detects duplicate status error', () => {
    expect(isStaleWorkflowTransitionError('Status ist bereits gesetzt.')).toBe(true);
  });

  it('ignores invalid transition errors', () => {
    expect(
      isStaleWorkflowTransitionError('Statuswechsel von „unterwegs“ nach „beendet“ ist nicht erlaubt.'),
    ).toBe(false);
  });
});

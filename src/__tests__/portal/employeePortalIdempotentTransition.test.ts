import { describe, expect, it } from 'vitest';
import { validateAssignmentTransition } from '@/lib/assist/assignmentStatusMachine';
import { validateWorkflowTransition } from '@/features/assistWorkflow/assistVisitStateMachine';

describe('employee portal idempotent status transitions', () => {
  it('validateAssignmentTransition rejects same status (office guard)', () => {
    const result = validateAssignmentTransition('unterwegs', 'unterwegs');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Status ist bereits gesetzt.');
    }
  });

  it('validateWorkflowTransition rejects same status at validation layer', () => {
    const result = validateWorkflowTransition('unterwegs', 'unterwegs');
    expect(result.valid).toBe(false);
  });

  it('forward transitions remain valid', () => {
    expect(validateWorkflowTransition('unterwegs', 'angekommen').valid).toBe(true);
    expect(validateWorkflowTransition('angekommen', 'gestartet', { hasTravelEnded: true }).valid).toBe(
      true,
    );
  });
});

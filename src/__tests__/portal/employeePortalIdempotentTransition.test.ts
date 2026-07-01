import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateAssignmentTransition } from '@/lib/assist/assignmentStatusMachine';
import { validateWorkflowTransition } from '@/features/assistWorkflow/assistVisitStateMachine';

function readSrc(relativePath: string): string {
  return readFileSync(path.join(__dirname, '..', '..', '..', relativePath), 'utf8');
}

describe('employee portal idempotent status transitions', () => {
  it('validateAssignmentTransition rejects same status (office guard)', () => {
    const result = validateAssignmentTransition('unterwegs', 'unterwegs');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Status ist bereits gesetzt.');
    }
  });

  it('updateStatus short-circuits when DB status already matches target', () => {
    const source = readSrc('src/lib/assist/repositories/assignmentRepository.supabase.ts');
    expect(source).toMatch(/if \(fromStatus === toStatus\) \{\s*return \{ ok: true, data: existing\.data \};/);
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

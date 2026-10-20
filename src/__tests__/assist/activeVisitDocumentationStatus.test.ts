import { describe, expect, it } from 'vitest';
import { resolveAssignmentStatusFromExecutionContext } from '@/lib/assist/visitWorkflow';

describe('documentation never substitutes for a recorded service end', () => {
  it.each([
    ['geplant', 'pending'], ['unterwegs', 'on_way'], ['angekommen', 'arrived'],
    ['gestartet', 'in_progress'], ['pausiert', 'paused'],
  ] as const)('keeps %s active when documentation is already saved', (status, execution) => {
    expect(resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: status, executionStatus: execution, hasDocumentation: true,
      hasSignature: false, serviceEnded: false, executionStateStatus: status,
    })).toBe(status);
  });
  it('does not infer an end even from a signature artifact', () => {
    expect(resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: 'gestartet', hasDocumentation: true, hasSignature: true, serviceEnded: false,
    })).toBe('gestartet');
  });
  it('shows signature open after an independently recorded end', () => {
    expect(resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: 'gestartet', hasDocumentation: true, hasSignature: false, serviceEnded: true,
    })).toBe('unterschrift_offen');
  });
  it.each(['assignment', 'execution-state'])('respects a persisted %s end status without time anchors', (source) => {
    expect(resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: source === 'assignment' ? 'beendet' : 'gestartet',
      executionStateStatus: source === 'execution-state' ? 'beendet' : null,
      hasDocumentation: true, hasSignature: false,
    })).toBe('unterschrift_offen');
  });
  it('keeps cancellation terminal despite documents from an earlier state', () => {
    expect(resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: 'storniert', hasDocumentation: true, hasSignature: true, serviceEnded: true,
    })).toBe('storniert');
  });
  it('does not mark an ended visit completed merely because a signature was saved', () => {
    expect(resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: 'unterschrift_offen', hasDocumentation: true,
      hasSignature: true, serviceEnded: true, proofStatus: 'pending',
    })).toBe('unterschrift_offen');
  });
  it('preserves the separately recorded finalization of a signed visit', () => {
    expect(resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: 'abgeschlossen', hasDocumentation: true,
      hasSignature: true, serviceEnded: true,
    })).toBe('abgeschlossen');
  });
});

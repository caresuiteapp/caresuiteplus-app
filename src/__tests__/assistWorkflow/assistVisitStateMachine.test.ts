import { describe, expect, it } from 'vitest';
import {
  assignmentStatusToWorkflowStep,
  getPrimaryWorkflowAction,
  getWorkflowTimelineSteps,
  isWorkflowStepComplete,
  validateWorkflowTransition,
} from '@/features/assistWorkflow/assistVisitStateMachine';

describe('assistVisitStateMachine (ASSIST.WORKFLOW.1)', () => {
  it('maps assignment status to workflow step', () => {
    expect(assignmentStatusToWorkflowStep('unterwegs')).toBe('en_route');
    expect(assignmentStatusToWorkflowStep('gestartet')).toBe('in_service');
    expect(assignmentStatusToWorkflowStep('abgeschlossen')).toBe('completed');
  });

  it('returns primary next action', () => {
    expect(getPrimaryWorkflowAction('angekommen')).toBe('gestartet');
    expect(getPrimaryWorkflowAction('beendet')).toBe('dokumentation_offen');
  });

  it('builds timeline with signature when required', () => {
    const steps = getWorkflowTimelineSteps('geplant', { requiresSignature: true });
    expect(steps).toContain('signature');
    expect(steps).toContain('finalize');
  });

  it('marks completed steps', () => {
    expect(isWorkflowStepComplete('consent', 'angekommen')).toBe(true);
    expect(isWorkflowStepComplete('in_service', 'angekommen')).toBe(false);
  });

  it('requires note for no_show', () => {
    const r = validateWorkflowTransition('geplant', 'nicht_erschienen', { noShowNote: '' });
    expect(r.valid).toBe(false);
    const ok = validateWorkflowTransition('geplant', 'nicht_erschienen', { noShowNote: 'Klient nicht da' });
    expect(ok.valid).toBe(true);
  });

  it('validates arrived before start', () => {
    const r = validateWorkflowTransition('unterwegs', 'gestartet', { requireArrivedBeforeStart: true });
    expect(r.valid).toBe(false);
  });
});

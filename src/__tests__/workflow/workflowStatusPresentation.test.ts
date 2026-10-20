import { describe, expect, it } from 'vitest';
import {
  resolveWorkflowStatusLabel,
  resolveWorkflowStatusVariant,
} from '@/lib/workflow/workflowStatusPresentation';

describe('workflowStatusPresentation', () => {
  it('mappt in_bearbeitung auf deutsches Label und orange Badge', () => {
    expect(resolveWorkflowStatusLabel('in_bearbeitung')).toBe('In Bearbeitung');
    expect(resolveWorkflowStatusVariant('in_bearbeitung')).toBe('orange');
  });

  it('mappt aktiv auf grünes Badge', () => {
    expect(resolveWorkflowStatusLabel('aktiv')).toBe('Aktiv');
    expect(resolveWorkflowStatusVariant('aktiv')).toBe('green');
  });
});

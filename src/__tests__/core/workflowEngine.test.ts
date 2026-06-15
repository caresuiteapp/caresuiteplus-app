import { describe, expect, it } from 'vitest';
import {
  validateTransition,
  getNextActions,
  getStatusTransitions,
} from '@/lib/services/workflow/workflowEngine';

describe('Workflow Engine', () => {
  it('erlaubt entwurf → aktiv', () => {
    expect(validateTransition('entwurf', 'aktiv').valid).toBe(true);
  });

  it('verweigert identischen Status', () => {
    const result = validateTransition('aktiv', 'aktiv');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('bereits gesetzt');
  });

  it('liefert nächste Aktionen für aktiv', () => {
    const actions = getNextActions('aktiv');
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].label).toBeTruthy();
  });

  it('liefert Status-Übergänge mit Labels', () => {
    const transitions = getStatusTransitions('entwurf');
    expect(transitions.some((t) => t.to === 'aktiv')).toBe(true);
  });
});

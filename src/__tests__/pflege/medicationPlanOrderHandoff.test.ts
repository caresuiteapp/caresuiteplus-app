import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discardMedicationPlanOrderHandoff, startMedicationPlanOrderHandoff, takeMedicationPlanOrderHandoff } from '@/lib/pflege/medicationPlanOrderHandoff';

vi.mock('expo-crypto', async () => ({ randomUUID: (await import('node:crypto')).randomUUID }));

const scope = { tenantId: '10000000-0000-0000-0000-000000000001', actorId: '10000000-0000-0000-0000-000000000002' };
const coordinates = { ...scope, clientId: '10000000-0000-0000-0000-000000000003', importId: '10000000-0000-0000-0000-000000000004', rowIndex: 7 };

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

describe('Einmalige Übergabe aus dem BMP', () => {
  it('is bound to the same tenant and actor, and cannot be retried in a different session', () => {
    for (const different of [{ ...scope, tenantId: coordinates.clientId }, { ...scope, actorId: coordinates.clientId }]) {
      const token = startMedicationPlanOrderHandoff(coordinates);
      expect(takeMedicationPlanOrderHandoff(token, different)).toBeNull();
      expect(takeMedicationPlanOrderHandoff(token, scope)).toBeNull();
    }
  });

  it('expires or discards unsent tickets and refuses malformed coordinates', () => {
    const expired = startMedicationPlanOrderHandoff(coordinates);
    vi.advanceTimersByTime(5 * 60_000);
    expect(takeMedicationPlanOrderHandoff(expired, scope)).toBeNull();
    const abandoned = startMedicationPlanOrderHandoff(coordinates);
    discardMedicationPlanOrderHandoff(abandoned);
    expect(takeMedicationPlanOrderHandoff(abandoned, scope)).toBeNull();
    expect(() => startMedicationPlanOrderHandoff({ ...coordinates, rowIndex: 200 })).toThrow();
    expect(() => startMedicationPlanOrderHandoff({ ...coordinates, clientId: 'wrong' })).toThrow();
  });

  it('keeps at most eight independent tickets', () => {
    const tokens = Array.from({ length: 9 }, (_, rowIndex) => startMedicationPlanOrderHandoff({ ...coordinates, rowIndex }));
    expect(takeMedicationPlanOrderHandoff(tokens[0], scope)).toBeNull();
    for (let i = 1; i < tokens.length; i++) expect(takeMedicationPlanOrderHandoff(tokens[i], scope)?.rowIndex).toBe(i);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isVisitExecutionRoute,
  visitExecutionRouteMatchesSnapshot,
} from '@/lib/portal/visitExecutionRoute';

describe('visitExecutionRoute', () => {
  it('detects employee visit execution routes', () => {
    expect(isVisitExecutionRoute('/portal/employee/assignments/abc/execute')).toBe(true);
    expect(isVisitExecutionRoute('/portal/employee/assignments/abc/execute/')).toBe(true);
    expect(isVisitExecutionRoute('/portal/employee/assignments/abc/execute?step=signature')).toBe(
      true,
    );
    expect(isVisitExecutionRoute('/portal/employee/appointments')).toBe(false);
    expect(isVisitExecutionRoute('/portal/employee/assignments/abc')).toBe(false);
  });

  it('matches snapshot route on same execute path', () => {
    const route = '/portal/employee/assignments/abc/execute';
    expect(visitExecutionRouteMatchesSnapshot(route, route)).toBe(true);
    expect(
      visitExecutionRouteMatchesSnapshot(`${route}?step=signature`, route),
    ).toBe(true);
    expect(
      visitExecutionRouteMatchesSnapshot('/portal/employee/appointments', route),
    ).toBe(false);
  });
});

describe('visit workflow persistence merge', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  it('clears stale signatureModalOpen unless explicitly set in partial', async () => {
    const { mergeVisitWorkflowSnapshot, writeVisitWorkflowSnapshot, readVisitWorkflowSnapshot } =
      await import('@/lib/portal/visitWorkflowPersistence');

    writeVisitWorkflowSnapshot(
      mergeVisitWorkflowSnapshot('v1', '/portal/employee/assignments/v1/execute', {
        step: 'signature',
        signatureModalOpen: true,
      }),
    );

    const cleared = mergeVisitWorkflowSnapshot(
      'v1',
      '/portal/employee/assignments/v1/execute',
      { step: 'signature', awaitingSignature: true },
    );
    expect(cleared.signatureModalOpen).toBe(false);

    const explicit = mergeVisitWorkflowSnapshot(
      'v1',
      '/portal/employee/assignments/v1/execute',
      { signatureModalOpen: true },
    );
    expect(explicit.signatureModalOpen).toBe(true);

    writeVisitWorkflowSnapshot(cleared);
    expect(readVisitWorkflowSnapshot('v1')?.signatureModalOpen).toBe(false);
  });
});

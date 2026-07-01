import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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

describe('signature overlay touch targets', () => {
  function readSrc(relativePath: string): string {
    return readFileSync(path.join(__dirname, '..', '..', '..', relativePath), 'utf8');
  }

  it('keeps touch-action:none scoped to canvas only so footer buttons receive taps', () => {
    const overlay = readSrc('src/components/ui/FullscreenOverlay.tsx');
    const modal = readSrc('src/components/inputs/CareSignatureModal.tsx');
    const canvas = readSrc('src/components/inputs/CareSignatureCanvas.tsx');

    expect(overlay).not.toContain("document.body.style.touchAction = 'none'");
    expect(modal).not.toMatch(/fullscreenRoot:[\s\S]*touchAction:\s*'none'/);
    expect(canvas).toContain("touchAction: 'manipulation'");
    expect(canvas).toMatch(/<canvas[\s\S]*touchAction:\s*'none'/);
  });
});

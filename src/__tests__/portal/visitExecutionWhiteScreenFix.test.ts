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

describe('signature capture modal open stability', () => {
  function readSrc(relativePath: string): string {
    return readFileSync(path.join(__dirname, '..', '..', '..', relativePath), 'utf8');
  }

  it('opens modal from button without closeModal effect churn on parent re-render', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitSignaturePanel.tsx');
    expect(panel).toContain('onModalOpenChangeRef');
    expect(panel).toContain('openSignatureModal');
    expect(panel).toContain('onPress={openSignatureModal}');
    expect(panel).not.toMatch(
      /useEffect\(\(\) => \{\s*return \(\) => \{\s*closeModal\(\);\s*\};\s*\}, \[closeModal\]\);/,
    );
    expect(panel).toMatch(/const closeModal = useCallback\([\s\S]*\[\s*\]/);
  });

  it('opens modal from button without browser requestFullscreen (avoids Android white screen)', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitSignaturePanel.tsx');
    expect(panel).toContain('onModalOpenChangeRef');
    expect(panel).toContain('openSignatureModal');
    expect(panel).toContain('onPress={openSignatureModal}');
    expect(panel).not.toContain('tryFullscreen: true');
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
    expect(overlay).not.toMatch(/applyWebPortalHostStyles[\s\S]*touchAction:\s*'none'/);
    expect(modal).not.toMatch(/fullscreenRoot:[\s\S]*touchAction:\s*'none'/);
    expect(canvas).toContain("touchAction: 'manipulation'");
    expect(canvas).toMatch(/<canvas[\s\S]*touchAction:\s*'none'/);
  });

  it('applies fixed viewport styles on web portal host for true fullscreen', () => {
    const overlay = readSrc('src/components/ui/FullscreenOverlay.tsx');
    expect(overlay).toContain('applyWebPortalHostStyles');
    expect(overlay).toContain("host.style.position = 'fixed'");
    expect(overlay).toContain("host.style.height = '100dvh'");
    expect(overlay).toContain('applyWebPortalHostStyles(host, zIndex)');
  });

  it('requests fullscreen before landscape lock when tryFullscreen is set', () => {
    const orientation = readSrc('src/lib/orientation/requestLandscapeLock.ts');
    expect(orientation).toMatch(
      /if \(options\?\.tryFullscreen\) \{\s*return tryFullscreenThenLock\(\);\s*\}/,
    );
  });
});

describe('EmployeePortalVisitExecutionScreen isServiceEnded wiring', () => {
  function readSrc(relativePath: string): string {
    return readFileSync(path.join(__dirname, '..', '..', '..', relativePath), 'utf8');
  }

  it('passes isServiceEnded from hook to resolveVisitExecutionUiState (no ReferenceError)', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('isServiceEnded,');
    expect(screen).toContain('hasServiceEnded: isServiceEnded');
    expect(screen).not.toMatch(/\bhasServiceEnded,\s*\n\s*\]\);/);
  });

  it('uses effectiveStatus from hook instead of local derivedStatus fallback', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const hook = readSrc('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain('effectiveStatus,');
    expect(screen).toContain('effectiveStatus: hookEffectiveStatus');
    expect(screen).not.toMatch(
      /const effectiveStatus: AssignmentStatus = derivedStatus \?\? visit\?\.status/,
    );
  });

  it('imports ScreenShell (missing import caused immediate ReferenceError white screen)', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain("import { ScreenShell } from '@/components/layout';");
  });
});

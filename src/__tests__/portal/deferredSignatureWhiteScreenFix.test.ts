import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSrc(relativePath: string): string {
  return readFileSync(path.join(__dirname, '..', '..', '..', relativePath), 'utf8');
}

describe('deferred signature white screen fix', () => {
  it('releaseSignatureCaptureEnvironment helper exits fullscreen on web', () => {
    const helper = readSrc('src/lib/dom/releaseSignatureCaptureEnvironment.ts');
    expect(helper).toContain('cleanupOrphanedFullscreenOverlays');
    expect(helper).toContain('resolveActiveFullscreenElement');
    expect(helper).toContain('exitBrowserFullscreen');
    expect(helper).toContain('unlockOrientationIfPossible');
  });

  it('syncAfterWorkflow preserves abgeschlossen terminal status', () => {
    const hook = readSrc('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain("terminalStatuses: AssignmentStatus[] = ['abgeschlossen', 'storniert', 'nicht_erschienen']");
    expect(hook).toContain('const syncedAssignmentStatus: AssignmentStatus = terminalStatus');
    expect(hook).not.toMatch(
      /ended\s*\?\s*'beendet'\s*:\s*ctx\.assignmentStatus[\s\S]*abgeschlossen/,
    );
  });

  it('deferred finalize releases signature UI and navigates back on web', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('releaseSignatureCaptureEnvironment');
    expect(screen).toContain('handleFinalizeDeferredSignature');
    expect(screen).toContain('router.back()');
    expect(screen).toMatch(/onFinalizeDeferred=\{\(\) => \{[\s\S]*handleFinalizeDeferredSignature/);
  });

  it('does not auto-open signature modal when deferred finalize is available', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain("!allowedActions.includes('finalize_visit_deferred_signature')");
  });

  it('signature modal disables browser requestFullscreen via OrientationGate', () => {
    const modal = readSrc('src/components/inputs/CareSignatureModal.tsx');
    expect(modal).toContain('tryFullscreenOnRequest: false');
  });

  it('signature panel releases capture environment on modal close', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitSignaturePanel.tsx');
    expect(panel).toContain('releaseSignatureCaptureEnvironment');
    expect(panel).toMatch(/const closeModal = useCallback\([\s\S]*releaseSignatureCaptureEnvironment\(\)/);
  });
});

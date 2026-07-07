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
    expect(helper).toContain('document.fullscreenElement');
    expect(helper).toContain('exitFullscreen');
  });

  it('syncAfterWorkflow preserves abgeschlossen terminal status', () => {
    const hook = readSrc('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain("terminalStatuses: AssignmentStatus[] = ['abgeschlossen', 'storniert', 'nicht_erschienen']");
    expect(hook).toContain('const syncedAssignmentStatus: AssignmentStatus = terminalStatus');
    expect(hook).not.toMatch(
      /ended\s*\?\s*'beendet'\s*:\s*ctx\.assignmentStatus[\s\S]*abgeschlossen/,
    );
  });

  it('deferred finalize releases signature UI before and after workflow', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('releaseSignatureCaptureEnvironment');
    expect(screen).toContain('releaseSignatureUi();');
    expect(screen).toContain('const r = await finalizeVisitDeferred();');
    expect(screen).toMatch(/onFinalizeDeferred=\{async \(\) => \{[\s\S]*releaseSignatureUi\(\)/);
  });

  it('signature panel releases capture environment on modal close', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitSignaturePanel.tsx');
    expect(panel).toContain('releaseSignatureCaptureEnvironment');
    expect(panel).toMatch(/const closeModal = useCallback\([\s\S]*releaseSignatureCaptureEnvironment\(\)/);
  });
});

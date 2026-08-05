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
    expect(hook).toMatch(
      /const syncedAssignmentStatus: AssignmentStatus = terminalStatus\s*\?\s*terminalStatus[\s\S]*:\s*ended\s*\?\s*'beendet'/,
    );
  });

  it('deferred finalize catches errors and stays on execution screen', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const match = screen.match(
      /const handleFinalizeDeferredSignature = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[finalizeVisitDeferred/,
    );
    expect(match).not.toBeNull();
    const handler = match![1];
    expect(handler).toContain('catch (error)');
    expect(handler).not.toContain('router.back()');
  });

  it('does not auto-open signature modal when deferred finalize is available', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain("!allowedActions.includes('finalize_visit_deferred_signature')");
  });

  it('never writes the technical submitted token into a client proof', () => {
    const service = readSrc('src/lib/portal/deferredVisitClientSignatureService.ts');
    expect(service).toContain('ctx.detail.documentationNotes?.trim()');
    expect(service).not.toContain("? 'submitted' : ''");
    expect(service).toContain('releaseAdministrativeDeferredClientSignatureRequest');
    expect(service).toContain('resolveAdministrativeActorProfileId');
    expect(service).toContain("supabase.rpc('resolve_current_profile_id'");
    expect(service).toContain('profileId: actor.data');
    expect(service).toContain("'admin_upsert_deferred_signature_client_document'");
    expect(service).toContain('administrative: true');
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

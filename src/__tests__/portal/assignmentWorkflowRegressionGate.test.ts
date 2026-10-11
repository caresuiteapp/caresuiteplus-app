import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASSIGNMENT_WORKFLOW_CRITICAL_FILES,
  ASSIGNMENT_WORKFLOW_INVARIANTS,
  ASSIGNMENT_WORKFLOW_PHASES,
} from '@/lib/portal/assignmentWorkflowCriticalPath';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function matchesPattern(source: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source);
}

describe('assignment workflow regression gate', () => {
  it('documents the full execution phases end-to-end', () => {
    expect(ASSIGNMENT_WORKFLOW_PHASES).toEqual([
      'consent',
      'travel_selection',
      'travel_recording',
      'travel_confirmation',
      'arrive',
      'start_service',
      'service_trips',
      'tasks',
      'end_service',
      'documentation',
      'signature',
      'completion_destination',
      'completion_travel',
      'completion_confirmation',
      'completed',
    ]);
  });

  it.each(ASSIGNMENT_WORKFLOW_CRITICAL_FILES)('critical file exists: %s', (filePath) => {
    expect(existsSync(path.join(root, filePath))).toBe(true);
  });

  it.each(
    ASSIGNMENT_WORKFLOW_INVARIANTS.map((invariant) => [invariant.id, invariant] as const),
  )('invariant %s', (_id, invariant) => {
    if (invariant.id === 'document-signature-no-browser-fullscreen') {
      // Both platform entry points now share the capture core. PDF embedding is
      // split separately so a browser iframe can never reach native rendering.
      for (const entrypoint of [
        'src/components/portal/PortalSignatureCapturePanel.tsx',
        'src/components/portal/PortalSignatureCapturePanel.web.tsx',
      ]) {
        expect(readSrc(entrypoint).trim()).toBe("export * from './PortalSignatureCapturePanelCore';");
      }
      const core = readSrc('src/components/portal/PortalSignatureCapturePanelCore.tsx');
      const nativeFrame = readSrc('src/components/portal/PortalSignaturePdfFrame.tsx');
      const webFrame = readSrc('src/components/portal/PortalSignaturePdfFrame.web.tsx');
      expect(matchesPattern(core, invariant.mustContain)).toBe(true);
      expect(core).toContain("import { PortalSignaturePdfFrame } from './PortalSignaturePdfFrame'");
      expect(core).toContain('<PortalSignaturePdfFrame');
      expect(core).not.toContain('<iframe');
      expect(nativeFrame).toMatch(/function PortalSignaturePdfFrame\([^)]*\)\s*\{\s*return null;/);
      expect(nativeFrame).not.toContain('<iframe');
      expect(webFrame).toContain('<iframe');
      expect(webFrame).toContain('src={url}');
      for (const source of [core, nativeFrame, webFrame]) {
        expect(matchesPattern(source, invariant.mustNotContain!)).toBe(false);
        expect(source).not.toMatch(/\b(?:requestFullscreen|webkitRequestFullscreen)\s*\(/);
      }
      return;
    }
    for (const filePath of invariant.files) {
      const source = readSrc(filePath);
      if (invariant.matchAllFiles || invariant.files.length === 1) {
        expect(matchesPattern(source, invariant.mustContain)).toBe(true);
      }
      if (invariant.mustNotContain) {
        expect(matchesPattern(source, invariant.mustNotContain)).toBe(false);
      }
    }
    if (!invariant.matchAllFiles && invariant.files.length > 1) {
      const combined = invariant.files.map((f) => readSrc(f)).join('\n');
      expect(matchesPattern(combined, invariant.mustContain)).toBe(true);
    }
  });

  it('forbids nested PlatformModal stacks in visit documentation AI flow', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitDocumentationPanel.tsx');
    const aiModal = readSrc('src/components/portal/EmployeePortalVisitDocumentationAiModal.tsx');
    expect(panel).toContain('PlatformModal');
    expect(aiModal).toContain('PlatformModal');
    expect(panel).not.toMatch(/<PlatformModal[\s\S]*<PlatformModal/);
  });

  it('keeps finalize and deferred-signature paths in execution hook', () => {
    const hook = readSrc('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain('finalizeVisit');
    expect(hook).toContain('finalizeVisitDeferred');
    expect(hook).toContain('saveDocumentation');
    expect(hook).toContain('saveClientSignature');
    expect(hook).toContain('saveTask');
  });

  it('preserves post-service phase detection for documentation and signature', () => {
    const phase = readSrc('src/lib/portal/resolveVisitExecutionPhase.ts');
    const ui = readSrc('src/lib/portal/resolveVisitExecutionUiState.ts');
    expect(phase).toContain('post_service');
    expect(phase).toContain('showLiveBottomBar');
    expect(ui).toContain('showDocumentationForm');
    expect(ui).toContain('showSignature');
    expect(ui).toContain('showFinalize');
  });

  it('routes the execution message action through the authenticated portal messenger', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const modal = readSrc('src/components/portal/PortalNewChatModal.tsx');
    expect(screen).toContain("label: 'Interne Nachricht'");
    expect(screen).toContain('setMessageModalOpen(true)');
    expect(screen).toContain('<PortalNewChatModal');
    expect(screen).toContain('initialSubject={`Einsatz: ${visit.clientName}`}');
    expect(screen).toContain('router.push(`/portal/employee/messages/${threadId}` as never)');
    expect(modal).toContain("ensurePortalWriteSession(portalSession, 'messages')");
    expect(modal).toContain('createPortalOfficeThread');
  });

  it('keeps untouched tasks optional but confirms edited drafts before either finalization path', () => {
    const drafts = readSrc('src/hooks/useTaskResultDrafts.ts');
    const execution = readSrc('src/hooks/useEmployeePortalVisitExecution.ts');
    const finalize = readSrc('src/features/assistWorkflow/finalizeVisit.ts');
    const deferred = readSrc('src/features/assistWorkflow/finalizeVisitWithDeferredClientSignature.ts');
    const legacyCompletion = readSrc('src/lib/portal/employeePortalExecutionService.ts');
    const tasksPanel = readSrc('src/components/portal/EmployeePortalVisitTasksPanel.tsx');
    expect(drafts).toContain("employee-execution-task-drafts:${ctx.tenantId}");
    expect(drafts).toContain('AsyncStorage.setItem');
    expect(drafts).toContain('AsyncStorage.getItem');
    for (const [handler, nextHandler, finalizeCall] of [
      ['handleFinalize', 'handleFinalizeDeferred', 'finalizeVisit(ctx)'],
      ['handleFinalizeDeferred', 'handleNoShow', 'finalizeVisitWithDeferredClientSignature(ctx, null, approvalReason)'],
    ]) {
      const callback = execution.slice(
        execution.indexOf(`const ${handler} = useCallback(`),
        execution.indexOf(`const ${nextHandler} = useCallback(`),
      );
      expect(callback).toMatch(/if\s*\(!await flushTaskDrafts\(\)\)\s*return\s*\{\s*ok:\s*false,/);
      expect(callback).toContain('Ihre Auswahl bleibt erhalten.');
      expect(callback).toContain(`return runWorkflow((ctx) => ${finalizeCall}`);
      expect(callback.indexOf('await flushTaskDrafts()')).toBeLessThan(callback.indexOf('return runWorkflow('));
    }
    expect(drafts).toContain('if (Object.keys(pending).length === 0) return true;');
    expect(drafts).toMatch(/if\s*\(!result\.ok\)\s*\{[\s\S]*?await persistPending\(scope\.pending\);\s*return false;/);
    expect(drafts).toMatch(/catch\s*\{[\s\S]*?await persistPending\(scope\.pending\);\s*return false;/);
    expect(finalize).toContain('isRequired: false');
    expect(deferred).toContain('isRequired: false');
    expect(legacyCompletion).not.toContain("error: 'Pflichtaufgaben sind noch offen.'");
    expect(tasksPanel).not.toContain("task.required ? '★ '");
  });

  it('restores the complete documentation draft before allowing Android persistence writes', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const panel = readSrc('src/components/portal/EmployeePortalVisitDocumentationPanel.tsx');
    const persistence = readSrc('src/lib/portal/visitWorkflowPersistence.ts');
    for (const [field, setter, initialProp, draftField] of [
      ['documentationDraftText', 'setDocumentationDraftText', 'initialShortDescription', 'shortDescription'],
      ['documentationSpecialNotes', 'setDocumentationSpecialNotes', 'initialSpecialNotes', 'specialNotes'],
      ['documentationDeviations', 'setDocumentationDeviations', 'initialDeviations', 'deviations'],
      ['documentationDeviationJustification', 'setDocumentationDeviationJustification', 'initialDeviationJustification', 'deviationJustification'],
    ]) {
      expect(persistence).toContain(field);
      expect(screen).toContain(`${setter}(snapshot.${field})`);
      expect(screen).toContain(`${initialProp}={${field}}`);
      expect(screen).toContain(`${setter}(draft.${draftField})`);
    }
    expect(panel).toMatch(/if\s*\(!editedRef\.current\s*\|\|\s*!dirty\)\s*return;\s*onDraftChangeRef\.current\?\.\(\{\s*shortDescription,\s*specialNotes,\s*deviations,\s*deviationJustification,\s*\}\)/);
    expect(screen).toMatch(/if\s*\(!id\s*\|\|\s*!visit\s*\|\|\s*workflowHydratedAssignmentId !== id\)\s*return;\s*workflowPersistence\.persist\(\{/);
    expect(screen).toContain('setWorkflowHydratedAssignmentId(id)');
    expect(screen.indexOf('setDocumentationDeviationJustification(snapshot.documentationDeviationJustification)'))
      .toBeLessThan(screen.indexOf('setWorkflowHydratedAssignmentId(id)'));
  });

  it('makes on-site signature persistence idempotent and prevents parallel capture submits', () => {
    const persistence = readSrc('src/lib/assist/assistVisitSignaturePersistenceService.ts');
    const panel = readSrc('src/components/portal/EmployeePortalVisitSignaturePanel.tsx');
    expect(persistence).toContain('existing.data.signatureHash === input.signatureHash');
    expect(persistence).toContain('return { ok: true, data: existing.data }');
    expect(persistence).toContain('.remove([storagePath])');
    expect(persistence).toContain('Durch eine neu erfasste Unterschrift ersetzt.');
    // The released app also blocks pending confirmation, disabled and loading states.
    expect(panel).toMatch(/if\s*\(captureSubmittingRef\.current\s*\|\|\s*confirmationPending\s*\|\|\s*disabled\s*\|\|\s*loading\)\s*return/);
    expect(panel).toContain('captureSubmittingRef.current = false');
  });

  it('requires only documentation plus either on-site or client-portal signature', () => {
    const deferred = readSrc('src/features/assistWorkflow/finalizeVisitWithDeferredClientSignature.ts');
    const completion = readSrc('src/components/portal/EmployeePortalVisitCompletionPanel.tsx');
    const release = readSrc('src/lib/portal/deferredVisitClientSignatureService.ts');
    expect(deferred).not.toContain('approvalReason.trim().length < 10');
    expect(completion).toContain('Hinweis zur Weiterleitung (optional)');
    expect(completion).not.toContain('approvalReason.trim().length < 10');
    expect(release).toContain('signatureDeferredReason:');
    expect(readSrc('src/features/assistWorkflow/finalizeVisit.ts')).toContain(
      'requireSignature: true',
    );
    expect(readSrc('src/lib/portal/employeePortalExecutionLiveService.ts')).toContain(
      'const fallbackRequiresSignature = true',
    );
    expect(readSrc('src/lib/portal/resolveEmployeePortalSignatureRequirement.ts')).not.toContain(
      'requiresSignature = Boolean(catalogRow.requires_signature)',
    );
  });

  it('releases deferred signatures through an assignment-scoped atomic RPC', () => {
    const service = readSrc('src/lib/portal/deferredVisitClientSignatureService.ts');
    const migration = readSrc(
      'supabase/migrations/20260905170000_employee_direct_deferred_signature_release.sql',
    );
    expect(service).toContain("'employee_portal_release_deferred_signature'");
    expect(service).toContain('Vorhandener Leistungsnachweis konnte nicht geprüft werden.');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('public.is_employee_portal_rls_context(p_tenant_id)');
    expect(migration).toContain('a.employee_id = v_employee_id');
    expect(migration).toContain('v_actor_profile_id := public.resolve_current_profile_id()');
    expect(migration).toContain('proof already signed');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('AND signature_id IS NULL');
    expect(migration).toContain("portal_release_status = 'pending_client_signature'");
    expect(migration).toContain('ON CONFLICT (id) DO UPDATE');
    expect(migration).toContain("client_documents.source = 'assist_visit_proof'");
    expect(migration).not.toContain('p_actor_profile_id');
    expect(migration).not.toContain('CREATE POLICY assist_visit_proofs_portal_employee_update');
  });
});

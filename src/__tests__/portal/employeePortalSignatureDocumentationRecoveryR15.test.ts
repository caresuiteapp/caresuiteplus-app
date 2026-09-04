import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Mitarbeitendenportal Signatur- und Dokumentationswiederherstellung R15', () => {
  it('rekonstruiert einen fehlenden Workflowkontext aus bereits geladenen Einsatzdaten', () => {
    const hook = read('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain('const buildFallbackExecutionContext = useCallback');
    expect(hook).toContain('const fallbackDetail = preloadedDetail ?? query.data ?? null');
    expect(hook).toContain('setExecutionContext(fallback)');
    expect(hook).toContain('resolveVisitMasterId(detail.assignmentId || assignmentId)');
  });

  it('speichert Dokumentation über denselben wiederherstellbaren Workflowrunner', () => {
    const hook = read('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain("recoveryAction: 'save_documentation'");
    expect(hook).not.toContain("return { ok: false, error: 'Einsatzkontext fehlt.' };");
  });

  it('erkennt eine dauerhaft gespeicherte Dokumentation beim Readback', () => {
    const recovery = read('src/features/assistWorkflow/workflowRecoveryVerification.ts');
    expect(recovery).toContain("| 'save_documentation'");
    expect(recovery).toContain("case 'save_documentation':");
    expect(recovery).toContain("after.detail.documentationStatus === 'submitted'");
  });

  it('hält die Prüfschleife bis zum bestätigten Server-Readback aktiv', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const successBranch = screen.slice(
      screen.indexOf('if (r.ok) {', screen.indexOf('const r = await saveSignature(sig);')),
      screen.indexOf('} else if (isWorkflowConfirmationPending', screen.indexOf('const r = await saveSignature(sig);')),
    );
    expect(successBranch).toContain('setSignatureConfirmationPending(true)');
    expect(successBranch).toContain('setAwaitingSignature(true)');
    expect(successBranch).toContain('signatureConfirmationPending: true');
  });

  it('öffnet die Dokumentation auf Web-Tablets ohne kollabierendes Bottom-Sheet', () => {
    const panel = read('src/components/portal/EmployeePortalVisitDocumentationPanel.tsx');
    expect(panel).toContain("const useBottomSheet = Platform.OS !== 'web' && isMobile");
    expect(panel).toContain("variant={useBottomSheet ? 'bottomSheet' : 'center'}");
    expect(panel).toContain('dismissOnBackdrop={false}');
    expect(panel).toContain('surfaceScope="personal"');
  });

  it('hält gespeicherte Dokumentation bis zum Abschluss erreichbar', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('const documentationAccessible = Boolean(');
    expect(screen).toContain('!isLocked && (showDocumentationForm || documentationSubmitted)');
    expect(screen).toContain('{documentationAccessible ? (');
    expect(screen).toContain('disabled={documentationSubmitted && (signatureCaptured || signatureDeferred)}');
    expect(screen).toContain('visit?.documentationNotes?.trim()');
    expect(screen).toContain('setDocumentationDraftText(doc.shortDescription)');
  });
});

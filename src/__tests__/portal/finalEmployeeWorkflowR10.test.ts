import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inferMimeTypeFromFileName } from '@/lib/assist/visitInternalAttachmentService';
import { resolveVisitProofDocumentationText } from '@/lib/assist/visitProofTaskPresentation';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('final employee workflow R10', () => {
  it('keeps internal notes and deviations out of client-visible proof documentation', () => {
    expect(
      resolveVisitProofDocumentationText({
        special_notes: 'Nur Verwaltung',
        deviations: 'Interne Abweichung',
        notes: 'Interner Altbestand',
      }),
    ).toBe('Keine zusätzliche Dokumentation erfasst.');

    expect(
      resolveVisitProofDocumentationText({
        documentationNote: 'Wohnung gesaugt und Bad gereinigt.',
        special_notes: 'Nur Verwaltung',
      }),
    ).toBe('Wohnung gesaugt und Bad gereinigt.');
  });

  it('blocks internal notes and media from portal proof snapshots', () => {
    const proofPayload = read('src/lib/assist/assistProofPdfPayload.ts');
    for (const privateKey of [
      'special_notes',
      'deviation_justification',
      'photo_references',
      'internalAttachments',
    ]) {
      expect(proofPayload).toContain(`'${privateKey}'`);
    }
  });

  it('labels documentation and internal communication as separate UI areas', () => {
    const panel = read('src/components/portal/EmployeePortalVisitDocumentationPanel.tsx');
    expect(panel).toContain('Klientensichtbare Dokumentation');
    expect(panel).toContain('Interne Nachricht an die Verwaltung');
    expect(panel).toContain('niemals klientensichtbar');
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toMatch(/resolveDocumentationAiSourceText\(\s*documentationDraftText,\s*'',/);
  });

  it('makes photo and video a permanent workflow action', () => {
    const dashboard = read('src/components/portal/EmployeePortalVisitLiveDashboard.tsx');
    const modal = read('src/components/portal/EmployeePortalVisitPhotoModal.tsx');
    expect(dashboard).toContain('title="Foto & Video"');
    expect(dashboard).toContain("status={attachmentCount > 0 ? `${attachmentCount} intern gespeichert` : 'Jetzt hinzufügen'}");
    expect(modal).toContain("type: ['image/*', 'video/*', 'application/pdf']");
    expect(inferMimeTypeFromFileName('einsatz.mp4')).toBe('video/mp4');
  });

  it('animates the employee marker on the active workflow step', () => {
    const progress = read('src/components/portal/EmployeePortalVisitProgressSteps.tsx');
    expect(progress).toContain('Animated.loop');
    expect(progress).toContain('Aktueller Schritt:');
    expect(progress).toContain("from '@expo/vector-icons'");
    expect(progress).toContain('name="person"');
    expect(progress).not.toContain('👤');
  });

  it('opens execution as a distraction-free full-viewport workspace', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    const tab = read('src/screens/portal/PortalTabScreen.tsx');
    const signature = read('src/components/portal/EmployeePortalVisitSignaturePanel.tsx');
    expect(shell).toContain('desktopChrome && !visitExecutionFocus');
    expect(shell).toContain('visitExecutionFocus && styles.contentFrameFocus');
    expect(tab).toContain('employee-visit-focus-screen');
    expect(signature.match(/forceFullscreen/g)).toHaveLength(3);
  });

  it('guides employees through next steps, omissions and runtime errors', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const header = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    expect(screen).toContain('guideActionLabel');
    expect(screen).toContain('Status erneut prüfen');
    expect(screen).toContain('Pflichtaufgabe');
    expect(screen).toContain('Bitte jetzt die Klient:innen-Unterschrift erfassen.');
    expect(header).toContain('accessibilityLiveRegion');
    expect(header).toContain('Animierter Einsatzbegleiter');
  });
});

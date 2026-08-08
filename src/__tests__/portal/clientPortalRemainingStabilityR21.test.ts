import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('client portal remaining stability R21', () => {
  it('never replaces unavailable budget data with calculated example amounts', () => {
    const budget = readSrc('app/portal/client/budget/index.tsx');
    const cards = readSrc('src/components/office/ClientBudgetVisualCards.tsx');

    expect(budget).not.toContain('buildClientBudgetVisualPlaceholders');
    expect(cards).not.toContain('buildClientBudgetVisualPlaceholders');
    expect(budget).toContain('isLinkedReady');
    expect(budget).toContain('Es werden keine Ersatzbeträge angezeigt');
    expect(cards).toContain('Ersatzbeträge oder Beispielwerte berechnet');
    expect(budget).toContain('<LoadingState');
    expect(budget).toContain('<ErrorState');
    expect(budget).toContain('<EmptyState');
  });

  it('waits for the verified client link before loading personal records', () => {
    for (const file of [
      'src/hooks/usePortalDocuments.ts',
      'src/hooks/usePortalDocumentDetail.ts',
      'src/hooks/usePortalClientAppointmentDetail.ts',
      'src/hooks/useClientPortalProfile.ts',
      'src/hooks/usePortalClientLiveTracking.ts',
    ]) {
      const source = readSrc(file);
      expect(source, file).toContain('isLinkedReady');
      expect(source, file).toContain('isResolvingClientLink');
    }
  });

  it('does not expose technical backend errors in client-facing details', () => {
    for (const file of [
      'src/hooks/usePortalDocumentDetail.ts',
      'src/hooks/usePortalClientAppointmentDetail.ts',
      'src/hooks/usePortalClientLiveTracking.ts',
      'src/screens/documents/CsDocumentRequestDetailScreen.tsx',
      'src/components/portal/AdaptivePortalOverview.tsx',
    ]) {
      expect(readSrc(file), file).toContain('toPortalUserFacingError');
    }
  });

  it('does not show false empty states while the client assignment is resolving', () => {
    const proofs = readSrc('src/screens/portal/ClientPortalProofsScreen.tsx');
    const documents = readSrc('src/hooks/usePortalDocuments.ts');

    expect(proofs).toContain('isResolvingClientLink');
    expect(proofs).toContain('isLinkedReady');
    expect(documents).toMatch(/isEmpty:\s+isLinkedReady/);
  });

  it('keeps all secondary client areas reachable through the mobile more menu', () => {
    const catalog = readSrc('src/liquid-command/navigation/portalCatalog.ts');

    for (const route of [
      '/portal/client/live',
      '/portal/client/documents/signatures',
      '/portal/client/proofs',
      '/portal/client/announcements',
      '/portal/client/budget',
      '/portal/client/help',
      '/portal/client/profile',
    ]) {
      expect(catalog).toContain(route);
    }
  });

  it('regenerates the PDF after a client signature instead of silently accepting stale output', () => {
    const signatureService = readSrc(
      'src/lib/portal/clientPortalAssistProofSignatureService.ts',
    );
    const pdfService = readSrc('src/lib/assist/assistProofPdfService.ts');

    expect(signatureService).toContain('generateAssistProofPdf');
    expect(signatureService).toContain('finishSignedProofDelivery');
    expect(signatureService).not.toContain('PDF / mirror is best-effort');
    expect(pdfService).toContain('upsert: true');
    expect(pdfService).toContain('buildEnrichedAssistProofPdfPayload');
  });
});

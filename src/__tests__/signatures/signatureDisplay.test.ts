import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  formatSignatureMetadataLine,
  pickSignatureImageUrl,
  resolveSignatureFieldStatus,
} from '@/lib/assist/visitSignatureImageService';
import { buildAssistProofPdfPayload } from '@/lib/assist/assistProofPdfPayload';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { pngDataUrl } from '@/__tests__/signatures/signatureTestFixtures';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('SignatureDisplay helpers', () => {
  it('A — prefers explicit image URL over inline data URL', () => {
    expect(
      pickSignatureImageUrl('https://storage.example/sig.png', 'data:image/png;base64,abc'),
    ).toBe('https://storage.example/sig.png');
  });

  it('B — metadata-only status when record exists without drawn image', () => {
    expect(
      resolveSignatureFieldStatus({ hasSignatureRecord: true, hasDrawnImage: false }),
    ).toBe('Metadaten ohne Signaturbild');
  });

  it('C — not required state label', () => {
    expect(
      resolveSignatureFieldStatus({
        hasSignatureRecord: false,
        hasDrawnImage: false,
        notRequired: true,
      }),
    ).toBe('Nicht erforderlich');
  });

  it('D — refused state label', () => {
    expect(
      resolveSignatureFieldStatus({
        hasSignatureRecord: false,
        hasDrawnImage: false,
        refusedReason: 'Klient:in nicht anwesend',
      }),
    ).toBe('Nicht möglich (begründet)');
  });

  it('E — drawn image present status', () => {
    expect(
      resolveSignatureFieldStatus({ hasSignatureRecord: true, hasDrawnImage: true }),
    ).toBe('Gezeichnete Unterschrift vorhanden');
  });

  it('formats signer metadata line with role and timestamp', () => {
    const line = formatSignatureMetadataLine({
      signerName: 'Ellen Zacharias',
      signedAt: '2026-07-03T09:29:00.000Z',
      signatureType: 'service_proof',
    });
    expect(line).toContain('Ellen Zacharias');
    expect(line).toContain('(service_proof)');
    expect(line).toContain('·');
  });
});

describe('SignatureDisplay component wiring', () => {
  it('exports image + metadata rendering without faking text as signature', () => {
    const source = readSrc('src/components/signatures/SignatureDisplay.tsx');
    expect(source).toContain('pickSignatureImageUrl');
    expect(source).toContain('formatSignatureMetadataLine');
    expect(source).toContain('Keine gezeichnete Unterschrift gespeichert');
    expect(source).toContain('Signaturbild konnte nicht geladen werden');
    expect(source).toContain('Unterschrift nicht erforderlich');
  });

  it('VisitProofPreviewPanel uses SignatureDisplay instead of text-only row', () => {
    const panel = readSrc('src/components/assist/VisitProofPreviewPanel.tsx');
    expect(panel).toContain('SignatureDisplay');
    expect(panel).toContain('Unterschrift Klient:in');
    expect(panel).not.toContain('signerName} (${');
  });

  it('SignatureDisplay corrects tall signature buffers on load', () => {
    const source = readSrc('src/components/signatures/SignatureDisplay.tsx');
    expect(source).toContain('needsSignatureOrientationCorrection');
    expect(source).toContain("rotate: '90deg'");
  });
});

describe('PDF signature rendering', () => {
  function sampleProof(): AssistVisitProofRow {
    return {
      id: 'proof-1',
      tenantId: 'tenant-1',
      visitId: 'visit-1',
      signatureId: 'sig-1',
      proofNumber: 'LN-001',
      status: 'pending_review',
      storagePath: null,
      payloadSnapshot: {
        clientName: 'Ellen Zacharias',
        signerName: 'Ellen Zacharias',
        signedAt: '2026-07-03T09:29:00.000Z',
        signerRole: 'service_proof',
      },
      payloadHash: null,
      generatedAt: '2026-07-03T10:00:00.000Z',
      generatedBy: null,
      approvedAt: null,
      approvedBy: null,
      billingReleased: false,
      portalVisible: false,
      releasedToPortalAt: null,
      portalReleaseStatus: 'none',
      approvalNote: null,
      rejectionReason: null,
      pdfStoragePath: null,
      pdfHash: null,
      createdAt: '2026-07-03T10:00:00.000Z',
      updatedAt: '2026-07-03T10:00:00.000Z',
    };
  }

  it('embeds drawn signature image with metadata below when enrichment provides URL', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      signatureImageUrl: 'data:image/png;base64,abc',
    });

    expect(payload.html).toContain('data:image/png;base64,abc');
    expect(payload.html).toContain('Ellen Zacharias');
    expect(payload.html).toContain('service_proof');
    expect(payload.html).not.toMatch(/Unterschrift Klient:in[\s\S]*Ellen Zacharias ·[\s\S]*<\/p>\s*<p class="footer"/);
  });

  it('shows legacy metadata-only message when image missing but signer recorded', () => {
    const payload = buildAssistProofPdfPayload(sampleProof());

    expect(payload.html).toContain('Keine gezeichnete Unterschrift gespeichert');
    expect(payload.html).toContain('Ellen Zacharias');
    expect(payload.html).not.toContain('<img');
  });

  it('rotates portrait signature buffers in PDF HTML for horizontal readability', () => {
    const portraitSignature = pngDataUrl(240, 480);
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      signatureImageUrl: portraitSignature,
      signatureImageWidth: 240,
      signatureImageHeight: 480,
    });

    expect(payload.html).toContain(portraitSignature);
    expect(payload.html).toContain('rotate(90deg)');
    expect(payload.html).toContain('object-fit:contain');
  });

  it('keeps landscape signature buffers unchanged in PDF HTML', () => {
    const landscapeSignature = pngDataUrl(640, 320);
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      signatureImageUrl: landscapeSignature,
      signatureImageWidth: 640,
      signatureImageHeight: 320,
    });

    expect(payload.html).toContain(landscapeSignature);
    expect(payload.html).not.toContain('rotate(90deg)');
    expect(payload.html).toContain('max-width:280px');
  });
});

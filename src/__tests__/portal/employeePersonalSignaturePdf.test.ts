import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalSignatureCapture, PortalSignatureDocument } from '@/types/portal/documentSignatures';
const h = vi.hoisted(() => ({ render: vi.fn(), upload: vi.fn(), signedUrl: vi.fn() }));
vi.mock('@/lib/assist/assistProofPdfService', () => ({ renderHtmlToPdfBytes: h.render }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ createSignedUrl: h.signedUrl, upload: h.upload }) } }) }));
import { finalizePortalSignatureDocumentPdf } from '@/lib/portal/portalDocumentSignaturePdfService';
import { sha256BinaryHex } from '@/lib/crypto/sha256Hex';
const document = { id: 'document', tenantId: 'tenant', title: 'Vertrag', versionNumber: 1, documentSourceType: 'template', previewHtml: '<p>Alle Vertragsinhalte</p>', signatureFields: [] } as unknown as PortalSignatureDocument;
const captures = [{ id: 'capture', signerRole: 'employee', signerName: 'Testperson', signedAt: '2026-10-10T10:00:00Z', storagePath: 'capture.png', auditId: 'audit' }] as PortalSignatureCapture[];
const input = { tenantId: 'tenant', document, captures };
beforeEach(() => { vi.clearAllMocks(); h.render.mockResolvedValue(new Uint8Array([37, 80, 68, 70])); h.signedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.test/signature.png' }, error: null }); h.upload.mockResolvedValue({ error: null }); });
describe('final personal signature PDFs', () => {
  it('uses the platform-compatible renderer and preserves contents and signature images in the native binary upload', async () => {
    const finalized = await finalizePortalSignatureDocumentPdf(input);
    expect(finalized.ok).toBe(true); expect(h.render.mock.calls[0][0]).toContain('Alle Vertragsinhalte'); expect(h.render.mock.calls[0][0]).toContain('https://example.test/signature.png');
    expect(h.upload.mock.calls[0][1]).toBeInstanceOf(ArrayBuffer); expect(new Uint8Array(h.upload.mock.calls[0][1])).toEqual(new Uint8Array([37, 80, 68, 70]));
  });
  it('hashes actual PDF bytes rather than only their length', async () => {
    const first = await finalizePortalSignatureDocumentPdf(input);
    h.render.mockResolvedValue(new Uint8Array([37, 80, 68, 71]));
    const second = await finalizePortalSignatureDocumentPdf(input);
    if (!first.ok || !second.ok) throw new Error('finalization failed');
    expect(first.data.pdfHash).not.toBe(second.data.pdfHash);
    expect(sha256BinaryHex(new Uint8Array([97, 98, 99]))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('refuses PDF composition and unavailable signature images before rendering a false final document', async () => {
    expect((await finalizePortalSignatureDocumentPdf({ ...input, document: { ...document, documentSourceType: 'pdf_upload' } })).ok).toBe(false);
    h.signedUrl.mockResolvedValue({ data: null, error: { message: 'denied' } });
    expect((await finalizePortalSignatureDocumentPdf(input)).ok).toBe(false);
    expect(h.render).not.toHaveBeenCalled(); expect(h.upload).not.toHaveBeenCalled();
  });
});

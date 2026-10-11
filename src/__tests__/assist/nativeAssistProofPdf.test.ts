import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ print: vi.fn(), remove: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-print', () => ({ printToFileAsync: f.print }));
vi.mock('expo-file-system', () => ({ File: class { delete = f.remove; } }));
vi.mock('@/lib/assist/assistExecutionHashService', () => ({ computeSha256Hex: vi.fn() }));
vi.mock('@/lib/assist/assistProofPdfPayload', () => ({ buildAssistProofPdfPayload: vi.fn() }));
vi.mock('@/lib/assist/visitProofBranding', () => ({ loadVisitProofBrandingForTenant: vi.fn(), resolveVisitProofBranding: vi.fn(), resolveVisitProofEmployeeName: vi.fn(), VISIT_PROOF_EMPLOYEE_UNKNOWN: 'unknown', VISIT_PROOF_TENANT_NAME_FALLBACK: 'unknown' }));
vi.mock('@/lib/assist/visitProofSnapshotPreviewService', () => ({ enrichVisitProofForPreview: vi.fn(), mergeVisitProofEnrichment: vi.fn() }));
vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({ fetchVisitProofById: vi.fn(), updateVisitProofRow: vi.fn() }));
vi.mock('@/lib/assist/assistStoragePaths', () => ({ ASSIST_EXECUTION_STORAGE_BUCKET: 'office-documents', buildAssistVisitProofStoragePath: vi.fn() }));
vi.mock('@/lib/assist/visitSignatureImageService', () => ({ pickSignatureImageUrl: vi.fn() }));
vi.mock('@/lib/signatures/signatureOrientation', () => ({ normalizeSignatureImageForProof: vi.fn() }));
vi.mock('@/lib/assist/visitProofTaskPresentation', () => ({ resolveVisitProofDocumentationText: vi.fn() }));
import { renderHtmlToPdfBytes } from '@/lib/assist/assistProofPdfService';
beforeEach(() => { vi.clearAllMocks(); f.print.mockResolvedValue({ uri: 'file:///cache/proof.pdf', base64: 'JVBERg==' }); });
it('uses the installed native PDF renderer and returns binary upload bytes', async () => {
  const html = '<html><body>Vollständiger Nachweis<img src="data:image/png;base64,AAAA" /></body></html>';
  expect([...await renderHtmlToPdfBytes(html)]).toEqual([37, 80, 68, 70]);
  expect(f.print).toHaveBeenCalledWith({ html, base64: true });
  expect(f.remove).toHaveBeenCalledOnce();
});
it('does not return an empty PDF when native rendering has no bytes', async () => {
  f.print.mockResolvedValue({ uri: 'file:///cache/proof.pdf' });
  await expect(renderHtmlToPdfBytes('<p>Nachweis</p>')).rejects.toThrow('nicht als PDF');
  expect(f.remove).toHaveBeenCalledOnce();
});

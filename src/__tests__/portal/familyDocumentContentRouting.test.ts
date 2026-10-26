import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ detail: vi.fn(), download: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/portal/portalDocumentsLiveService', () => ({ fetchLivePortalDocumentDetail: f.detail, downloadLivePortalDocument: f.download, fetchLivePortalDocumentsForClient: vi.fn() }));
import { fetchPortalDocumentDetail, downloadPortalDocument } from '@/lib/portal/documentService';
beforeEach(() => { vi.clearAllMocks(); f.detail.mockResolvedValue({ ok: true, data: { downloadReady: true } }); f.download.mockResolvedValue({ ok: true, data: { fileName: 'scoped.pdf' } }); });
const ctx = { tenantId: 'tenant-a', clientId: 'client-a' };
describe('family document service content selection', () => {
  it('keeps an unmarked family document request on the document-only reader and download path', async () => {
    await fetchPortalDocumentDetail('document-a', 'account-a', 'family_portal', ctx);
    await downloadPortalDocument('document-a', 'account-a', 'family_portal', ctx);
    expect(f.detail).toHaveBeenCalledWith('tenant-a', 'client-a', 'document-a', { documentOnly: true });
    expect(f.download).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 'document-a', { documentOnly: true });
  });
  it('keeps the explicitly proof-marked family request on the proof-only reader and download path', async () => {
    const proof = { ...ctx, contentKind: 'service-proof' as const };
    await fetchPortalDocumentDetail('proof-a', 'account-a', 'family_portal', proof);
    await downloadPortalDocument('proof-a', 'account-a', 'family_portal', proof);
    expect(f.detail).toHaveBeenCalledWith('tenant-a', 'client-a', 'proof-a', { proofOnly: true });
    expect(f.download).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 'proof-a', { proofOnly: true });
  });
  it('retains the normal client generic document path for existing links', async () => {
    await fetchPortalDocumentDetail('document-a', 'account-a', 'client_portal', ctx);
    expect(f.detail).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 'document-a');
  });
});

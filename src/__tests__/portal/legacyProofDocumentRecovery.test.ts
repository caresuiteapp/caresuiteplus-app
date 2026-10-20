import { beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ legacy: vi.fn(), signed: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ createSignedUrl: f.signed }) } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const query = { select: () => query, eq: () => query, in: () => query, not: () => query,
    maybeSingle: async () => ({ data: null, error: null }) };
  return query;
} }));
vi.mock('@/lib/portal/assist/portalServiceProofService', () => ({ fetchLegacyPortalServiceProof: f.legacy }));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({
  fetchAssistProofPortalDocumentDetail: async () => ({ ok: false, error: 'not an Assist proof' }),
  getProofPdfForClientPortal: async () => ({ ok: false, error: 'not an Assist proof' }),
}));
import { downloadLivePortalDocument, fetchLivePortalDocumentDetail } from '@/lib/portal/portalDocumentsLiveService';

beforeEach(() => {
  vi.clearAllMocks();
  f.legacy.mockResolvedValue({ ok: true, data: { id: 'record', title: 'Leistungsnachweis 2026-05', fileName: 'original.pdf',
    mimeType: 'application/pdf', storagePath: 'tenant/tenant/service-records/original.pdf',
    createdAt: '2026-05-01T10:00:00Z', signatureRequired: false } });
  f.signed.mockResolvedValue({ data: { signedUrl: 'https://example.test/private.pdf' }, error: null });
});

describe('historical released proof detail', () => {
  it('opens the scoped original as a readable document without offering a new signature', async () => {
    const detail = await fetchLivePortalDocumentDetail('tenant', 'client', 'record');
    expect(detail).toMatchObject({ ok: true, data: { documentSource: 'service_record', downloadReady: true, canSign: false } });
    expect(f.legacy).toHaveBeenCalledWith('tenant', 'client', 'record');
  });
  it('downloads the original only after the release has been checked again', async () => {
    expect(await downloadLivePortalDocument('tenant', 'client', 'record')).toMatchObject({ ok: true, data: { fileName: 'original.pdf' } });
    expect(f.legacy).toHaveBeenCalledTimes(2);
    expect(f.signed).toHaveBeenCalledWith('tenant/tenant/service-records/original.pdf', 3600);
  });
  it('does not return a download link when access is withdrawn between opening and downloading', async () => {
    f.legacy.mockResolvedValueOnce({ ok: true, data: { id: 'record', fileName: 'original.pdf', mimeType: 'application/pdf', storagePath: 'tenant/tenant/original.pdf' } })
      .mockResolvedValueOnce({ ok: true, data: null });
    expect((await downloadLivePortalDocument('tenant', 'client', 'record')).ok).toBe(false);
    expect(f.signed).not.toHaveBeenCalled();
  });
  it('keeps a load error visible and does not replace it with an empty success', async () => {
    f.legacy.mockResolvedValue({ ok: false, error: 'Historical proof load failed' });
    expect(await fetchLivePortalDocumentDetail('tenant', 'client', 'record')).toEqual({ ok: false, error: 'Historical proof load failed' });
  });
});

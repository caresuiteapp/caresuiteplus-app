import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ queries: [] as { table: string; eq: [string, unknown][]; neq: [string, unknown][]; in: [string, unknown][]; not: unknown[][]; select?: string }[], replies: [] as any[], settings: vi.fn(), released: true, assist: vi.fn(), legacy: vi.fn(), pdf: vi.fn(), signed: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ createSignedUrl: f.signed }) } }) }));
vi.mock('@/lib/client/clientPortalSettingsService', () => ({ fetchClientPortalSettingsResolved: f.settings, canClientPortalSeeFeature: () => f.released }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const recorded = { table, eq: [] as [string, unknown][], neq: [] as [string, unknown][], in: [] as [string, unknown][], not: [] as unknown[][], select: '' }; f.queries.push(recorded);
  const q = { select: (columns: string) => { recorded.select = columns; return q; }, eq: (key: string, value: unknown) => { recorded.eq.push([key, value]); return q; }, neq: (key: string, value: unknown) => { recorded.neq.push([key, value]); return q; }, in: (key: string, value: unknown) => { recorded.in.push([key, value]); return q; }, not: (...args: unknown[]) => { recorded.not.push(args); return q; }, maybeSingle: async () => f.replies.shift() ?? { data: null, error: null } };
  return q;
} }));
vi.mock('@/lib/portal/assist/portalServiceProofService', () => ({ fetchLegacyPortalServiceProof: f.legacy }));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({ fetchAssistProofPortalDocumentDetail: f.assist, getProofPdfForClientPortal: f.pdf }));
import { fetchLivePortalDocumentDetail, downloadLivePortalDocument } from '@/lib/portal/portalDocumentsLiveService';
const row = (patch = {}) => ({ id: 'proof-a', tenant_id: 'tenant-a', client_id: 'client-a', category: 'leistungsnachweis', title: 'Freigegebener Leistungsnachweis', file_name: 'proof.pdf', mime_type: 'application/pdf', storage_path: 'tenant-a/client-a/proof-a.pdf', status: 'abgeschlossen', sensitivity: 'care', portal_visible: true, source: 'upload', created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z', ...patch });
beforeEach(() => { vi.clearAllMocks(); f.queries = []; f.replies = []; f.released = true; f.settings.mockResolvedValue({ ok: true, data: {} }); f.assist.mockResolvedValue({ ok: false, error: 'Not an assist proof' }); f.legacy.mockResolvedValue({ ok: true, data: null }); f.pdf.mockResolvedValue({ ok: false, error: 'No PDF' }); f.signed.mockResolvedValue({ data: { signedUrl: 'https://example.invalid/scoped-proof.pdf' }, error: null }); });
describe('proof-only portal document reader', () => {
  it('does not let a document-only family read fall back to a service record or assist proof', async () => {
    expect((await fetchLivePortalDocumentDetail('tenant-a', 'client-a', 'proof-a', { documentOnly: true })).ok).toBe(false);
    expect(f.queries[0].neq).toContainEqual(['category', 'leistungsnachweis']);
    expect(f.assist).not.toHaveBeenCalled(); expect(f.legacy).not.toHaveBeenCalled();
  });
  it.each([{ category: 'leistungsnachweis' }, { category: 'vertrag', source: 'assist_visit_proof' }])('rejects a proof payload in document-only mode even after a transport mismatch: %j', async patch => {
    f.replies = [{ data: row(patch), error: null }];
    expect((await fetchLivePortalDocumentDetail('tenant-a', 'client-a', 'proof-a', { documentOnly: true })).ok).toBe(false);
    expect(f.assist).not.toHaveBeenCalled(); expect(f.legacy).not.toHaveBeenCalled(); expect(f.signed).not.toHaveBeenCalled();
  });
  it('reads only a released proof category for exactly the requested tenant, client and ID', async () => {
    f.replies = [{ data: row(), error: null }];
    expect((await fetchLivePortalDocumentDetail('tenant-a', 'client-a', 'proof-a', { proofOnly: true })).ok).toBe(true);
    expect(f.queries[0].eq).toEqual(expect.arrayContaining([['tenant_id', 'tenant-a'], ['client_id', 'client-a'], ['id', 'proof-a'], ['portal_visible', true], ['category', 'leistungsnachweis']]));
    expect(f.assist).not.toHaveBeenCalled(); expect(f.signed).not.toHaveBeenCalled();
  });
  it.each([{ category: 'vertrag' }, { tenant_id: 'tenant-b' }, { client_id: 'client-b' }, { id: 'other-id' }])('rejects an unrelated or mismatched response even if a transport ignored a filter: %j', async patch => {
    f.replies = [{ data: row(patch), error: null }];
    expect((await fetchLivePortalDocumentDetail('tenant-a', 'client-a', 'proof-a', { proofOnly: true })).ok).toBe(false);
    expect(f.legacy).not.toHaveBeenCalled(); expect(f.signed).not.toHaveBeenCalled();
  });
  it('does not query proof sources when the existing client proof release is denied', async () => {
    f.released = false;
    expect((await fetchLivePortalDocumentDetail('tenant-a', 'client-a', 'proof-a', { proofOnly: true })).ok).toBe(false);
    expect(f.queries).toEqual([]); expect(f.assist).not.toHaveBeenCalled(); expect(f.legacy).not.toHaveBeenCalled();
  });
  it('falls back only to the exact released assist proof and legacy service record readers', async () => {
    f.legacy.mockResolvedValue({ ok: true, data: { id: 'proof-a', title: 'Originalnachweis', fileName: 'original.pdf', mimeType: 'application/pdf', storagePath: 'scoped.pdf', createdAt: '2026-01-01' } });
    expect(await fetchLivePortalDocumentDetail('tenant-a', 'client-a', 'proof-a', { proofOnly: true })).toMatchObject({ ok: true, data: { documentSource: 'service_record' } });
    expect(f.assist).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 'proof-a'); expect(f.legacy).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', 'proof-a');
  });
  it('rechecks proof category and record scope before preparing its download', async () => {
    f.replies = [{ data: row(), error: null }, { data: row(), error: null }];
    expect((await downloadLivePortalDocument('tenant-a', 'client-a', 'proof-a', { proofOnly: true })).ok).toBe(true);
    expect(f.queries).toHaveLength(2); expect(f.queries.every(q => q.eq.some(([key, value]) => key === 'category' && value === 'leistungsnachweis'))).toBe(true);
    expect(f.signed).toHaveBeenCalledExactlyOnceWith('tenant-a/client-a/proof-a.pdf', 3600);
  });
  it('does not sign a generic document storage path that replaced the proof between reads', async () => {
    f.replies = [{ data: row(), error: null }, { data: row({ category: 'vertrag', storage_path: 'private-contract.pdf' }), error: null }];
    expect((await downloadLivePortalDocument('tenant-a', 'client-a', 'proof-a', { proofOnly: true })).ok).toBe(false); expect(f.signed).not.toHaveBeenCalled();
  });
  it('retains the separately authorized general document path without imposing the proof category on it', async () => {
    f.replies = [{ data: row({ category: 'vertrag' }), error: null }];
    expect((await fetchLivePortalDocumentDetail('tenant-a', 'client-a', 'proof-a')).ok).toBe(true);
    expect(f.queries[0].eq.some(([key]) => key === 'category')).toBe(false);
  });
});

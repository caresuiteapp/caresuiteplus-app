import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ documents: [] as Record<string, unknown>[], captures: [] as Record<string, unknown>[], archives: [] as Record<string, unknown>[], upload: vi.fn(), signed: vi.fn(), pdf: vi.fn(), profile: vi.fn(), employee: vi.fn(), archiveError: false, updateError: false, captureLost: false }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: f.profile }));
vi.mock('@/lib/portal/resolvePortalEmployeeLink', () => ({ fetchPortalEmployeeIdForAuthUser: f.employee }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '7c0c4331-05f0-4ae7-ab87-1a5c67b2a66a' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/portal/portalDocumentSignaturePdfService', () => ({ finalizePortalSignatureDocumentPdf: f.pdf }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'auth' } }, error: null }) },
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }) }; return q; },
  storage: { from: () => ({ upload: f.upload, createSignedUrl: f.signed }) },
}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const filters: ((row: Record<string, unknown>) => boolean)[] = []; let pending: Record<string, unknown> | null = null;
  const rows = () => (table === 'portal_signature_documents' ? f.documents : table === 'portal_signature_captures' ? f.captures : table === 'employee_documents' ? f.archives : []).filter(row => filters.every(filter => filter(row)));
  const execute = () => {
    const matching = rows();
    if (pending && f.updateError) return { data: null, error: { message: 'status rejected' } };
    if (pending) matching.forEach(row => Object.assign(row, pending));
    return { data: matching, count: matching.length, error: null };
  };
  const q = { select: () => q, eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return q; }, order: () => q,
    update: (row: Record<string, unknown>) => { pending = row; return q; },
    maybeSingle: async () => ({ ...execute(), data: rows()[0] ?? null }),
    single: async () => { const result = execute(); return result.error ? result : { ...result, data: result.data?.[0] ?? null, error: result.data?.length ? null : { code: 'PGRST116', message: 'no rows' } }; },
    insert: async (row: Record<string, unknown>) => {
      if (table === 'portal_signature_captures') { f.captures.push({ ...row }); if (f.captureLost) throw new Error('lost insert response'); }
      if (table === 'employee_documents') { if (f.archiveError) return { error: { message: 'archive denied' } }; f.archives.push({ ...row }); }
      return { error: null };
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
  }; return q;
} }));
import { resolveLivePortalSignatureStorageUrl, signLivePortalDocument } from '@/lib/portal/portalDocumentSignatureLiveService';
const input = { tenantId: 't', employeeId: 'e', documentId: 'd', signerRole: 'employee' as const, signerName: 'Testperson', signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=', expectedVersionNumber: 1 };
beforeEach(() => {
  vi.clearAllMocks(); f.captures = []; f.archives = []; f.archiveError = false; f.updateError = false; f.captureLost = false;
  f.documents = [{ id: 'd', tenant_id: 't', employee_id: 'e', title: 'Vertrag', recipient_type: 'employee', document_type: 'arbeitsvertrag', document_source_type: 'template', signature_requirement: 'employee', status: 'open', next_signer_role: 'employee', employee_signed: false, client_signed: false, version_number: 1, preview_html: '<p>Vertrag {{employee_signature}}</p>', signature_fields_json: [] }];
  f.upload.mockResolvedValue({ error: null });
  f.signed.mockResolvedValue({ data: { signedUrl: 'https://example.test/final.pdf' }, error: null });
  f.profile.mockResolvedValue({ ok: true, data: 'real-profile' });
  f.employee.mockResolvedValue('e');
  f.pdf.mockResolvedValue({ ok: true, data: { storagePath: 'tenant/t/portal/signatures/d/final.pdf', pdfHash: 'hash' } });
});
describe('personal employee signature recovery', () => {
  it('uploads native binary data and never uses a portal/account id as profile FK', async () => {
    const crypto = globalThis.crypto; vi.stubGlobal('crypto', undefined);
    try {
      const result = await signLivePortalDocument(input, 'portal-account');
      expect(result.ok).toBe(true); expect(f.upload.mock.calls[0][1]).toBeInstanceOf(ArrayBuffer);
      expect(f.captures[0].signer_profile_id).toBe('real-profile');
      expect(f.archives).toHaveLength(1); expect(f.archives[0].id).toBe('d');
      expect(f.documents[0].status).toBe('completed');
    } finally { vi.stubGlobal('crypto', crypto); }
  });
  it('resumes an already saved capture after PDF failure without a second capture or upload', async () => {
    f.pdf.mockResolvedValueOnce({ ok: false, error: 'print unavailable' });
    expect((await signLivePortalDocument(input)).ok).toBe(false);
    expect(f.documents[0].status).toBe('open'); expect(f.captures).toHaveLength(1);
    expect((await signLivePortalDocument({ ...input, signatureDataUrl: '' })).ok).toBe(true);
    expect(f.captures).toHaveLength(1); expect(f.upload).toHaveBeenCalledOnce();
  });
  it('recovers a capture when the write committed but its response was lost', async () => {
    f.captureLost = true;
    expect((await signLivePortalDocument(input)).ok).toBe(true);
    expect(f.captures).toHaveLength(1);
  });
  it('does not claim completion when personal filing or final status writes fail', async () => {
    f.archiveError = true;
    expect((await signLivePortalDocument(input)).ok).toBe(false); expect(f.documents[0].status).toBe('open');
    f.archiveError = false; f.updateError = true;
    expect((await signLivePortalDocument(input)).ok).toBe(false); expect(f.documents[0].status).toBe('open');
    f.updateError = false;
    expect((await signLivePortalDocument(input)).ok).toBe(true);
    expect(f.captures).toHaveLength(1); expect(f.archives).toHaveLength(1);
  });
  it('refuses an unseen document version or unsupported original PDF before capturing', async () => {
    expect((await signLivePortalDocument({ ...input, expectedVersionNumber: 0 })).ok).toBe(false);
    f.documents[0].document_source_type = 'pdf_upload';
    expect((await signLivePortalDocument(input)).ok).toBe(false);
    expect(f.upload).not.toHaveBeenCalled(); expect(f.captures).toHaveLength(0); expect(f.pdf).not.toHaveBeenCalled();
  });
  it('does not upload or capture when the authenticated profile cannot be verified', async () => {
    f.profile.mockResolvedValue({ ok: false, error: 'profile mismatch' });
    expect((await signLivePortalDocument(input, 'portal-account')).ok).toBe(false);
    expect(f.upload).not.toHaveBeenCalled(); expect(f.captures).toHaveLength(0);
  });
  it('rejects a caller-supplied employee id belonging to someone else before capturing', async () => {
    f.employee.mockResolvedValue('different-employee');
    expect((await signLivePortalDocument(input)).ok).toBe(false);
    expect(f.upload).not.toHaveBeenCalled(); expect(f.pdf).not.toHaveBeenCalled(); expect(f.captures).toHaveLength(0);
  });
  it('signs a download URL only for the current employee and the actual permitted document file', async () => {
    const scope = { tenantId: 't', employeeId: 'e', documentId: 'd' };
    f.documents[0].status = 'completed'; f.documents[0].final_storage_path = 'tenant/t/portal/signatures/d/final.pdf';
    expect((await resolveLivePortalSignatureStorageUrl('tenant/t/portal/signatures/d/final.pdf', scope)).ok).toBe(true);
    expect(f.signed).toHaveBeenCalledWith('tenant/t/portal/signatures/d/final.pdf', 300);
    expect((await resolveLivePortalSignatureStorageUrl('tenant/t/employees/another/private.pdf', scope)).ok).toBe(false);
    expect((await resolveLivePortalSignatureStorageUrl('tenant/other/portal/signatures/d/final.pdf', scope)).ok).toBe(false);
    f.documents[0].allow_download = false;
    expect((await resolveLivePortalSignatureStorageUrl('tenant/t/portal/signatures/d/final.pdf', scope)).ok).toBe(false);
    expect(f.signed).toHaveBeenCalledTimes(1);
  });
});

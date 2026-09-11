import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ request: {} as Record<string, unknown>, signatures: [] as Record<string, unknown>[], rpc: vi.fn(), update: vi.fn(), signatureError: false }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/portal/portalProofCacheSignal', () => ({ invalidatePortalProofCache: vi.fn() }));
vi.mock('@/lib/documents/csTemplates/csDocumentContextResolver', () => ({ resolveDocumentContext: vi.fn() }));
vi.mock('@/lib/documents/csTemplates/csTemplateQueryService', () => ({ fetchCsTemplatePlaceholders: vi.fn(), fetchCsTemplateWithActiveVersion: vi.fn() }));
vi.mock('@/lib/documents/csTemplates/csDocumentRequestAudit', () => ({ logCsDocumentRequestAudit: vi.fn() }));
vi.mock('@/lib/documents/csTemplates/csTemplateValidation', () => ({ validateTemplateForSend: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const filters: ((row: Record<string, unknown>) => boolean)[] = [];
  const rows = () => (table === 'cs_document_requests' ? [f.request] : f.signatures).filter((row) => filters.every((filter) => filter(row)));
  let bounds: [number, number] | null = null;
  const result = () => ({ data: bounds ? rows().slice(bounds[0], bounds[1] + 1) : rows(), count: rows().length, error: table === 'cs_document_request_signatures' && f.signatureError ? { message: 'signature query failed' } : null });
  const query = { select: () => query, update: f.update, order: () => query,
    eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
    in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
    range: (from: number, to: number) => { bounds = [from, to]; return query; },
    maybeSingle: async () => ({ ...result(), data: rows()[0] ?? null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  }; return query;
} }));
import { signCsDocumentRequest, fetchPortalCsDocumentRequests } from '@/lib/documents/csTemplates/csDocumentRequestService.web';
const input = { tenantId: 't', requestId: 'r', signerRole: 'client' as const, signerName: 'Testperson', signatureDataUrl: 'data:image/png;base64,AAAA', portalActor: { roleKey: 'client_portal' as const, clientId: 'c' } };
beforeEach(() => {
  vi.clearAllMocks(); f.signatureError = false;
  f.request = { id: 'r', owner_tenant_id: 't', client_id: 'c', portal_visible: true, recipient_scope: 'client', status: 'sent', title: 'Vereinbarung', rendered_html: '<p>Vereinbarung</p>', updated_at: '2026-09-11T09:00:00Z' };
  f.signatures = [{ id: 's', request_id: 'r', signer_role: 'client', status: 'pending' }];
  f.rpc.mockImplementation(async () => { f.signatures[0].status = 'signed'; f.request.status = 'completed'; return { data: 'r', error: null }; });
});
it('uses one atomic call and removes the client role from pending tasks after its receipt', async () => {
  const result = await signCsDocumentRequest(input);
  expect(result.ok).toBe(true); if (result.ok) expect(result.data.pendingSignatureRoles).toEqual([]);
  expect(f.rpc).toHaveBeenCalledWith('client_portal_sign_document_request', expect.objectContaining({ p_expected_updated_at: f.request.updated_at, p_signer_role: 'client' }));
  expect(f.rpc.mock.calls[0][1]).not.toHaveProperty('p_rendered_html'); expect(f.update).not.toHaveBeenCalled();
});
it('does not clear the task when the atomic write fails', async () => {
  f.rpc.mockResolvedValue({ data: null, error: { message: 'conflict' } });
  expect((await signCsDocumentRequest(input)).ok).toBe(false);
  expect(f.signatures[0].status).toBe('pending'); expect(f.update).not.toHaveBeenCalled();
});
it('fails visibly when signature rows cannot be loaded', async () => {
  f.signatureError = true;
  expect((await fetchPortalCsDocumentRequests({ tenantId: 't', clientId: 'c', roleKey: 'client_portal' })).ok).toBe(false);
});
it('includes representative tasks for a family portal account', async () => {
  f.signatures[0].signer_role = 'representative';
  const result = await fetchPortalCsDocumentRequests({ tenantId: 't', clientId: 'c', roleKey: 'family_portal' });
  if (!result.ok) throw new Error(result.error);
  expect(result.data[0].pendingSignatureRoles).toEqual(['representative']);
});

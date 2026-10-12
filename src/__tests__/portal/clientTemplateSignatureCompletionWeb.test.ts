import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  let changes: Record<string, unknown> | null = null;
  const query = { select: () => query, update: (payload: Record<string, unknown>) => { changes = payload; f.update(payload); return query; }, order: () => query,
    eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
    in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
    range: (from: number, to: number) => { bounds = [from, to]; return query; },
    maybeSingle: async () => ({ ...result(), data: rows()[0] ?? null }),
    single: async () => { const matching = rows(); if (changes) matching.forEach(row => Object.assign(row, changes)); return { data: matching[0] ?? null, error: matching.length ? null : { message: 'no matching row' } }; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  }; return query;
} }));
import * as web from '@/lib/documents/csTemplates/csDocumentRequestService.web';
import * as native from '@/lib/documents/csTemplates/csDocumentRequestService';
const input = { tenantId: 't', requestId: 'r', signerRole: 'client' as const, signerName: 'Testperson', signatureDataUrl: 'data:image/png;base64,AAAA', portalActor: { roleKey: 'client_portal' as const, clientId: 'c' } };
beforeEach(() => {
  vi.clearAllMocks(); f.signatureError = false;
  f.request = { id: 'r', owner_tenant_id: 't', client_id: 'c', portal_visible: true, recipient_scope: 'client', status: 'sent', title: 'Vereinbarung', rendered_html: '<p>Vereinbarung</p>', updated_at: '2026-09-11T09:00:00Z' };
  f.signatures = [{ id: 's', request_id: 'r', signer_role: 'client', status: 'pending' }];
  f.rpc.mockImplementation(async () => { f.signatures[0].status = 'signed'; f.request.status = 'completed'; return { data: 'r', error: null }; });
});
describe.each([['web', web], ['native', native]] as const)('%s template signing', (_platform, { signCsDocumentRequest, fetchPortalCsDocumentRequests, fetchPortalCsDocumentRequestDetail }) => {
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
it('refuses a document changed since the client reviewed it before writing', async () => {
  const result = await signCsDocumentRequest({ ...input, expectedUpdatedAt: '2026-09-11T08:00:00Z' });
  expect(result.ok).toBe(false);
  expect(f.rpc).not.toHaveBeenCalled();
  expect(f.update).not.toHaveBeenCalled();
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
it('keeps the family representative signature on the atomic server path', async () => {
  f.signatures[0].signer_role = 'representative';
  const result = await signCsDocumentRequest({ ...input, signerRole: 'representative', portalActor: { roleKey: 'family_portal', clientId: 'c' } });
  expect(result.ok).toBe(true); expect(f.update).not.toHaveBeenCalled();
  expect(f.rpc).toHaveBeenCalledWith('client_portal_sign_document_request', expect.objectContaining({ p_signer_role: 'representative' }));
});
it.each(['pending', 'signed'])('blocks employee template completion before mutating a %s capture while keeping the original readable', async signatureStatus => {
  f.request = { ...f.request, client_id: null, employee_id: 'employee', recipient_scope: 'employee' };
  f.signatures[0].signer_role = 'employee'; f.signatures[0].status = signatureStatus;
  const employeeScope = { roleKey: 'employee_portal' as const, employeeId: 'employee' };
  const result = await signCsDocumentRequest({ ...input, signerRole: 'employee', expectedUpdatedAt: String(f.request.updated_at), portalActor: employeeScope });
  expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain('Unterzeichnung ist vorübergehend gesperrt');
  expect(f.update).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled(); expect(f.request.status).toBe('sent'); expect(f.signatures[0].status).toBe(signatureStatus);
  const original = await fetchPortalCsDocumentRequestDetail({ tenantId: 't', requestId: 'r', ...employeeScope });
  expect(original.ok).toBe(true); if (original.ok) expect(original.data.renderedHtml).toBe('<p>Vereinbarung</p>');
});
it('preserves the existing Office completion and original HTML', async () => {
  f.signatures[0].signer_role = 'office';
  const result = await signCsDocumentRequest({ tenantId: 't', requestId: 'r', signerRole: 'office', signerName: 'Verwaltung', signatureDataUrl: input.signatureDataUrl });
  expect(result.ok).toBe(true); if (result.ok) { expect(result.data.status).toBe('completed'); expect(result.data.renderedHtml).toContain('Vereinbarung'); }
  expect(f.update).toHaveBeenCalledTimes(2); expect(f.rpc).not.toHaveBeenCalled();
});

});

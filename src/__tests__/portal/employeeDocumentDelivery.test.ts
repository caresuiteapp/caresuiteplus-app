import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as unknown, signed: vi.fn(), scopes: [] as [string, unknown][], authUser: 'auth', tenant: 't', employee: 'e', rpcError: false, rpcNames: [] as string[] }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null, hasPermission: () => true }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: async () => ({ data: { user: f.authUser ? { id: f.authUser } : null }, error: null }) },
  rpc: async (name: string) => { f.rpcNames.push(name); return { data: name === 'current_tenant_id' ? f.tenant : name === 'resolve_current_employee_id' ? f.employee : null, error: f.rpcError ? { message: 'identity rejected' } : null }; },
  storage: { from: (bucket: string) => { expect(bucket).toBe('office-documents'); return { createSignedUrl: f.signed }; } },
}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  expect(table).toBe('employee_documents');
  const filters: ((row: Record<string, unknown>) => boolean)[] = []; let start = 0; let end = 999;
  const selected = () => f.rows.filter(row => filters.every(filter => filter(row)));
  const result = () => ({ data: selected().slice(start, end + 1), count: selected().length, error: f.error });
  const q = { select: () => q, order: () => q, eq: (key: string, value: unknown) => { f.scopes.push([key, value]); filters.push(row => row[key] === value); return q; },
    range: (from: number, to: number) => { start = from; end = to; return q; }, maybeSingle: async () => ({ ...result(), data: selected()[0] ?? null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
  return q;
} }));
vi.mock('@/lib/portal/portalDocumentsLiveService', () => ({ downloadLivePortalDocument: vi.fn(), fetchLivePortalDocumentDetail: vi.fn(), fetchLivePortalDocumentsForClient: vi.fn() }));
import { downloadPortalDocument, fetchPortalDocumentDetail, fetchPortalDocuments } from '@/lib/portal/documentService';
import { fetchLivePortalDocumentsForClient } from '@/lib/portal/portalDocumentsLiveService';
const context = { tenantId: 't', employeeId: 'e' };
const base = { id: 'd', tenant_id: 't', employee_id: 'e', category: 'contract', title: 'Arbeitsvertrag', file_name: 'Vertrag.pdf', storage_path: 'tenant/t/employees/e/d/Vertrag.pdf', released_to_portal: true, sensitive: false, created_at: '2026-10-01', updated_at: '2026-10-02' };
beforeEach(() => { vi.clearAllMocks(); f.rpcNames = []; f.authUser = 'auth'; f.tenant = 't'; f.employee = 'e'; f.rpcError = false; f.scopes = []; f.error = null; f.rows = [{ ...base }]; f.signed.mockResolvedValue({ data: { signedUrl: 'https://fixture.example/secure.pdf' }, error: null }); });
describe('employee document delivery', () => {
  it('loads real released personal documents through the employee list and detail', async () => {
    expect(await fetchPortalDocuments('account', 'employee_portal', context)).toMatchObject({ ok: true, data: [{ id: 'd', documentSource: 'employee_document' }] });
    expect(await fetchPortalDocumentDetail('d', 'account', 'employee_portal', context)).toMatchObject({ ok: true, data: { id: 'd', downloadReady: true } });
    expect(f.scopes).toContainEqual(['employee_id', 'e']); expect(f.scopes).toContainEqual(['released_to_portal', true]);
    expect(f.rpcNames).toContain('resolve_current_employee_id'); expect(f.rpcNames).toContain('current_tenant_id');
  });
  it.each(['caregiver', 'nurse'] as const)('keeps verified legacy %s employee document access available', async role => {
    expect((await fetchPortalDocuments('profile', role, context)).ok).toBe(true);
    expect((await downloadPortalDocument('d', 'profile', role, context)).ok).toBe(true);
    expect(f.rpcNames).toContain('resolve_current_employee_id');
  });
  it('does not return or sign storage URLs for foreign, unreleased, or sensitive records', async () => {
    for (const changes of [{ employee_id: 'foreign' }, { tenant_id: 'other' }, { released_to_portal: false }, { sensitive: true }, { category: 'warning' }]) {
      f.rows = [{ ...base, ...changes }];
      expect((await downloadPortalDocument('d', 'account', 'employee_portal', context)).ok).toBe(false);
    }
    expect(f.signed).not.toHaveBeenCalled();
  });
  it('prepares a short lived signed URL only after rechecking the personal release', async () => {
    expect(await downloadPortalDocument('d', 'account', 'employee_portal', context)).toMatchObject({ ok: true, data: { fileName: 'Vertrag.pdf', downloadUrl: 'https://fixture.example/secure.pdf' } });
    expect(f.signed).toHaveBeenCalledWith(base.storage_path, 300);
    f.rows[0].released_to_portal = false;
    expect((await downloadPortalDocument('d', 'account', 'employee_portal', context)).ok).toBe(false);
    expect(f.signed).toHaveBeenCalledTimes(1);
  });
  it('reports failed reads and missing employee mapping instead of an empty list', async () => {
    f.error = { message: 'denied' };
    expect((await fetchPortalDocuments('account', 'employee_portal', context)).ok).toBe(false);
    expect((await fetchPortalDocuments('account', 'employee_portal', { tenantId: 't' })).ok).toBe(false);
  });
  it('keeps the existing client document dispatch intact', async () => {
    vi.mocked(fetchLivePortalDocumentsForClient).mockResolvedValue({ ok: true, data: [] });
    await fetchPortalDocuments('client-account', 'client_portal', { tenantId: 't', clientId: 'c' });
    expect(fetchLivePortalDocumentsForClient).toHaveBeenCalledWith('t', 'c');
  });
  it('verifies the authenticated employee and tenant before trusting a caller-provided personal scope', async () => {
    for (const altered of [{ employee: 'different-employee' }, { tenant: 'foreign-tenant' }, { authUser: '' }, { rpcError: true }]) {
      f.authUser = 'auth'; f.employee = 'e'; f.tenant = 't'; f.rpcError = false; Object.assign(f, altered); f.scopes = [];
      expect((await fetchPortalDocuments('account', 'employee_portal', context)).ok).toBe(false);
      expect((await fetchPortalDocumentDetail('d', 'account', 'employee_portal', context)).ok).toBe(false);
      expect((await downloadPortalDocument('d', 'account', 'employee_portal', context)).ok).toBe(false);
      expect(f.scopes).toEqual([]);
    }
    expect(f.signed).not.toHaveBeenCalled();
  });
  it('does not sign foreign or traversing storage paths even when their database row is released to this employee', async () => {
    for (const storage_path of ['tenant/other/employees/e/file.pdf', 'https://example.test/file.pdf', 'tenant/t/../other/file.pdf', 'tenant/t/%2e%2e/other/file.pdf', 'tenant/t\\other\\file.pdf']) {
      f.rows = [{ ...base, storage_path }];
      expect((await downloadPortalDocument('d', 'account', 'employee_portal', context)).ok).toBe(false);
    }
    expect(f.signed).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/types';

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  failures: new Set<string>(),
  queries: [] as { table: string; filters: [string, unknown][] }[],
  denied: false, foreignTenant: false, allowEmployees: false,
  permission: vi.fn(), signedUrl: vi.fn(), bucket: vi.fn(),
}));
vi.mock('@/lib/permissions/actorPermissions', () => ({ enforceWithActor: (...args: unknown[]) => {
  state.permission(...args);
  const permission = args[3];
  return Promise.resolve(state.denied || (permission === 'office.employees.view' && !state.allowEmployees) ? { ok: false, error: 'Keine Berechtigung.' } : null);
} }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => state.foreignTenant ? { ok: false, error: 'Falscher Mandant.' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: (bucket: string) => { state.bucket(bucket); return { createSignedUrl: state.signedUrl }; } } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const filters: [string, unknown][] = [];
  state.queries.push({ table, filters });
  const result = () => ({ data: (state.tables[table] ?? []).filter((row) => filters.every(([key, value]) => row[key] === value)), error: state.failures.has(table) ? { message: 'Abfrage fehlgeschlagen' } : null });
  const query = {
    select: () => query, order: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return query;
} }));
import { fetchOfficeSignatureReview } from '@/lib/portal/officeSignatureReviewService.web';

const profile = { id: 'profile-1', employeeId: 'staff-1', roleKey: 'business_admin' } as Profile;
const sourcePath = 'tenant/tenant-1/portal/signatures/sources/document-1/source.pdf';
const finalPath = 'tenant/tenant-1/portal/signatures/document-1/final.pdf';
const review = () => fetchOfficeSignatureReview('tenant-1', 'document-1', 'business_admin', profile);

beforeEach(() => {
  vi.clearAllMocks();
  state.queries = []; state.failures = new Set(); state.denied = false; state.foreignTenant = false; state.allowEmployees = false;
  state.tables = {
    portal_signature_documents: [{ id: 'document-1', tenant_id: 'tenant-1', title: 'Vereinbarung', status: 'open', document_type: 'sonstiges', document_source_type: 'pdf_upload', recipient_type: 'employee', employee_id: 'employee-1', storage_path: sourcePath, final_storage_path: finalPath, created_at: '2026-10-15T10:00:00Z' }],
    portal_signature_captures: [], portal_signature_audit_events: [],
    employees: [{ id: 'employee-1', tenant_id: 'tenant-1', first_name: 'Anna', last_name: 'Müller' }],
  };
  state.signedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed-document' }, error: null });
});

describe('Office signature review: authorized document-bound file access', () => {
  it.each(['permission', 'tenant'] as const)('stops before any row or file access when %s is rejected', async (reason) => {
    if (reason === 'permission') state.denied = true; else state.foreignTenant = true;
    expect((await review()).ok).toBe(false);
    expect(state.queries).toEqual([]);
    expect(state.signedUrl).not.toHaveBeenCalled();
  });
  it('checks actor permissions, binds all queries to tenant and document, and signs the recorded source only', async () => {
    const result = await review();
    expect(result.ok).toBe(true);
    expect(state.permission).toHaveBeenCalledWith('business_admin', 'tenant-1', profile, 'office.documents.signatures.view');
    for (const query of state.queries) {
      expect(query.filters).toContainEqual(['tenant_id', 'tenant-1']);
      expect(query.filters).toContainEqual([query.table === 'portal_signature_documents' ? 'id' : 'document_id', 'document-1']);
    }
    expect(state.bucket).toHaveBeenCalledWith('office-documents');
    expect(state.signedUrl).toHaveBeenCalledWith(sourcePath, 300);
    expect(result.ok && result.data.employeeName).toBeNull();
  });
  it.each(['tenant', 'document'] as const)('rejects a row from another %s before creating a URL', async (kind) => {
    state.tables.portal_signature_documents[0][kind === 'tenant' ? 'tenant_id' : 'id'] = 'unrelated';
    expect((await review()).ok).toBe(false);
    expect(state.signedUrl).not.toHaveBeenCalled();
  });
  it.each(['tenant/other/portal/signatures/source.pdf', 'tenant/tenant-1/../other/source.pdf', 'tenant/tenant-1/portal/%2e%2e/source.pdf'])('refuses noncanonical or foreign storage path %s', async (path) => {
    state.tables.portal_signature_documents[0].storage_path = path;
    const result = await review();
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.data.pdfUrl).toBeNull(); expect(result.data.fileError).toBeTruthy(); }
    expect(state.signedUrl).not.toHaveBeenCalled();
  });
  it('uses the completed final artifact only after confirmed completion', async () => {
    state.tables.portal_signature_documents[0].status = 'completed';
    expect((await review()).ok).toBe(true);
    expect(state.signedUrl).toHaveBeenCalledWith(finalPath, 300);
  });
  it('reports a failed file grant without replacing it with an external or public URL', async () => {
    state.signedUrl.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    const result = await review();
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.data.pdfUrl).toBeNull(); expect(result.data.fileError).toContain('PDF konnte nicht geladen'); }
  });
  it('does not claim a review when the capture history could not be read', async () => {
    state.failures.add('portal_signature_captures');
    expect((await review()).ok).toBe(false);
    expect(state.signedUrl).not.toHaveBeenCalled();
  });
  it('loads the actual recipient name only with the separate employee-read permission', async () => {
    state.allowEmployees = true;
    const result = await review();
    expect(result.ok && result.data.employeeName).toBe('Anna Müller');
    expect(state.queries.find((query) => query.table === 'employees')?.filters).toEqual([['tenant_id', 'tenant-1'], ['id', 'employee-1']]);
  });
});

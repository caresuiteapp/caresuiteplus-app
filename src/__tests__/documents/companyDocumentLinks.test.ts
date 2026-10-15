import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], filters: [] as [string, unknown][], range: [] as number[], denied: false, download: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => h.denied ? { ok: false, error: 'Kein Zugriff' } : null }));
vi.mock('@/lib/permissions/actorPermissions', () => ({ enforceWithActor: async () => h.denied ? { ok: false, error: 'Kein Zugriff' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/documents/centralCatalogService', () => ({ downloadCentralDocument: (...args: unknown[]) => h.download(...args) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const filters: [string, unknown][] = []; const result = () => ({ data: h.rows.filter(row => filters.every(([key, value]) => row[key] === value)), error: null });
  const query = { select: () => query, order: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); h.filters.push([key, value]); return query; }, range: (start: number, end: number) => { h.range = [start, end]; return query; }, maybeSingle: async () => ({ data: result().data[0] ?? null, error: null }), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) }; return query;
} }));
import { loadCompanyDocumentChoices, downloadCompanyLinkedDocument } from '@/lib/documents/companyDocumentLinks.web';
const T = '11111111-1111-4111-8111-111111111111'; const D = '22222222-2222-4222-8222-222222222222';
const scope = { tenantId: T, roleKey: 'business_admin' as const, effectivePermissions: ['office.documents.view'] as const };
beforeEach(() => { h.filters = []; h.range = []; h.denied = false; h.download.mockReset().mockResolvedValue({ ok: true, data: new Uint8Array([1]) }); h.rows = [{ id: D, tenant_id: T, target: 'company', entity_id: T, title: 'Police', revision: 2, state: 'draft', created_at: '2026-10-15', original_path: '/original.pdf', pdf_path: '/document.pdf', pdf_hash: 'hash', snapshot_json: { definition: {}, context: { tenantId: T, target: 'company', entityId: T } } }]; });
describe('existing company archive links', () => {
  it('scopes choices to company tenant records and keeps pagination', async () => {
    h.rows.push({ ...h.rows[0], id: 'person', target: 'employee' }); const result = await loadCompanyDocumentChoices(scope, 100);
    expect(result.ok).toBe(true); if (result.ok) expect(result.data.map(row => row.id)).toEqual([D]); expect(h.range).toEqual([100, 199]); expect(h.filters).toContainEqual(['tenant_id', T]); expect(h.filters).toContainEqual(['entity_id', T]);
  });
  it('does not query or download without document permission', async () => {
    h.denied = true; expect((await downloadCompanyLinkedDocument(scope, D)).ok).toBe(false); expect(h.filters).toEqual([]); expect(h.download).not.toHaveBeenCalled();
  });
  it('checks stored snapshot tenant and target before opening a reference', async () => {
    h.rows[0].snapshot_json = { definition: {}, context: { tenantId: 'foreign', target: 'company', entityId: T } }; expect((await downloadCompanyLinkedDocument(scope, D)).ok).toBe(false); expect(h.download).not.toHaveBeenCalled();
  });
  it('reuses the hash-verifying authenticated download with runtime permissions', async () => {
    const result = await downloadCompanyLinkedDocument(scope, D, true); expect(result.ok).toBe(true); if (result.ok) expect(result.data.fileName).toBe('Police_v2_Original.pdf');
    expect(h.download).toHaveBeenCalledWith(expect.objectContaining({ id: D, tenantId: T }), expect.objectContaining({ effectivePermissions: ['office.documents.view'] }), true);
  });
});

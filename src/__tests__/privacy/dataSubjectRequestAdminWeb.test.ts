// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadDataRequestAdminCsv, buildDataRequestAdminCsv, listDataRequestsForAdmin, parseDataRequestAdminRow,
  prepareDataRequestAdminCsv, updateDataRequestForAdmin,
} from '@/lib/privacy/dataSubjectRequestAdminWeb.web';

const mocks = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), update: vi.fn(), maybeSingle: vi.fn() };
  return { query, ready: true, resolveProfile: vi.fn(), client: { auth: { getUser: vi.fn() }, rpc: vi.fn(), from: vi.fn() } };
});
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocks.client }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: mocks.resolveProfile }));
vi.mock('@/lib/privacy/dataRequestConfig', () => ({ isDataSubjectRequestBackendReady: () => mocks.ready }));

const scope = {
  authUserId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  profileId: '33333333-3333-4333-8333-333333333333',
};
const row = {
  id: '44444444-4444-4444-8444-444444444444', tenant_id: scope.tenantId, profile_id: scope.profileId,
  request_type: 'access', status: 'queued', requester_name: 'Ada Beispiel', requester_email: 'ada@example.test',
  request_number: 'DSR-123', received_at: '2026-10-19T10:00:00Z', created_at: '2026-10-19T10:00:00Z',
  updated_at: '2026-10-19T10:00:00Z', verification_notes: 'Nicht im Listenexport',
};
const item = () => parseDataRequestAdminRow(row, scope.tenantId)!;
const capability = (view = true, manage = true) => ({
  data: { version: 1, capabilities: { self_service: true, admin_view: view, admin_manage: manage } }, error: null,
});
beforeEach(() => {
  vi.resetAllMocks(); mocks.ready = true;
  mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: scope.authUserId } }, error: null });
  mocks.resolveProfile.mockResolvedValue({ ok: true, data: scope.profileId });
  mocks.client.rpc.mockImplementation(async (_name, args) => args.p_action === 'admin_update'
    ? { data: { version: 1, item: { ...row, status: args.p_payload.new_status } }, error: null } : capability());
  mocks.client.from.mockReturnValue(mocks.query);
  for (const method of ['select', 'eq', 'order', 'update'] as const) mocks.query[method].mockReturnValue(mocks.query);
  mocks.query.range.mockResolvedValue({ data: [row], error: null });
  mocks.query.maybeSingle.mockResolvedValue({ data: { ...row, status: 'running' }, error: null });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Versioned, tenant-scoped Web administration of data requests', () => {
  it('requires server capabilities before querying the raw table and sends the expected verified identity', async () => {
    const result = await listDataRequestsForAdmin(scope);
    expect(result.ok).toBe(true);
    expect(mocks.client.rpc).toHaveBeenCalledWith('data_request_workspace_v1', {
      p_action: 'capabilities', p_payload: { expected_auth_user_id: scope.authUserId, expected_tenant_id: scope.tenantId, expected_profile_id: scope.profileId },
    });
    expect(mocks.query.eq).toHaveBeenCalledWith('tenant_id', scope.tenantId);
    expect(mocks.query.select).not.toHaveBeenCalledWith('*');
    expect(mocks.query.range).toHaveBeenCalledWith(0, 50);
  });
  it.each([capability(false, false), { data: null, error: { code: 'PGRST202' } }, { data: { version: 2, capabilities: {} }, error: null }])(
    'fails closed for absent or denied capabilities', async reply => {
      mocks.client.rpc.mockResolvedValue(reply);
      expect((await listDataRequestsForAdmin(scope)).ok).toBe(false);
      expect(mocks.client.from).not.toHaveBeenCalled();
    },
  );
  it('rejects a different auth user and an unconfirmed legacy profile mapping', async () => {
    mocks.client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'other-user' } }, error: null });
    expect((await listDataRequestsForAdmin(scope)).ok).toBe(false);
    mocks.resolveProfile.mockResolvedValue({ ok: true, data: 'other-profile' });
    expect((await listDataRequestsForAdmin(scope)).ok).toBe(false);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });
  it('does not return rows if identity changes while the list is loading', async () => {
    mocks.query.range.mockImplementation(async () => {
      mocks.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      return { data: [row], error: null };
    });
    expect((await listDataRequestsForAdmin(scope)).ok).toBe(false);
  });
  it('paginates without silently labelling a server-limited result as complete', async () => {
    mocks.query.range.mockResolvedValue({ data: Array.from({ length: 51 }, () => row), error: null });
    const result = await listDataRequestsForAdmin(scope, 50);
    expect(result).toMatchObject({ ok: true, data: { hasMore: true, nextOffset: 100 } });
    if (result.ok) expect(result.data.items).toHaveLength(50);
    expect(mocks.query.range).toHaveBeenCalledWith(50, 100);
  });
  it('rejects wrong-tenant and malformed rows without inventing receipt dates', async () => {
    expect(parseDataRequestAdminRow({ ...row, tenant_id: 'foreign' }, scope.tenantId)).toBeNull();
    expect(parseDataRequestAdminRow({ ...row, created_at: null }, scope.tenantId)).toBeNull();
    expect(parseDataRequestAdminRow({ ...row, status: 'unknown' }, scope.tenantId)).toBeNull();
    mocks.query.range.mockResolvedValue({ data: [{ ...row, tenant_id: 'foreign' }], error: null });
    expect((await listDataRequestsForAdmin(scope)).ok).toBe(false);
  });
  it('allows a viewer to read but never to change status', async () => {
    mocks.client.rpc.mockResolvedValue(capability(true, false));
    expect((await listDataRequestsForAdmin(scope)).ok).toBe(true);
    expect((await updateDataRequestForAdmin(scope, item(), 'running')).ok).toBe(false);
    expect(mocks.query.update).not.toHaveBeenCalled();
  });
  it('updates through an atomic server identity and optimistic concurrency check', async () => {
    expect((await updateDataRequestForAdmin(scope, item(), 'running')).ok).toBe(true);
    expect(mocks.client.rpc).toHaveBeenCalledWith('data_request_workspace_v1', {
      p_action: 'admin_update', p_payload: {
        expected_auth_user_id: scope.authUserId, expected_tenant_id: scope.tenantId, expected_profile_id: scope.profileId,
        request_id: row.id, expected_status: 'queued', expected_updated_at: row.updated_at, new_status: 'running',
      },
    });
    expect(mocks.query.update).not.toHaveBeenCalled();
  });
  it('reports a conflicting update instead of claiming success', async () => {
    mocks.client.rpc.mockImplementation(async (_name, args) => args.p_action === 'admin_update'
      ? { data: null, error: { code: '40001' } } : capability());
    expect(await updateDataRequestForAdmin(scope, item(), 'running')).toEqual({ ok: false, error: expect.stringContaining('zwischenzeitlich') });
  });
  it('does not claim success for an incorrect returned status or request', async () => {
    mocks.client.rpc.mockImplementation(async (_name, args) => args.p_action === 'admin_update'
      ? { data: { version: 1, item: row }, error: null } : capability());
    expect((await updateDataRequestForAdmin(scope, item(), 'running')).ok).toBe(false);
  });
  it('converts rejected network calls into a recoverable service error', async () => {
    mocks.query.range.mockRejectedValue(new Error('Network unavailable'));
    expect(await listDataRequestsForAdmin(scope)).toEqual({ ok: false, error: expect.stringContaining('erneut') });
  });
});

describe('Precisely scoped admin CSV', () => {
  it('quotes delimiters, quotes and line breaks and excludes notes and IDs of other people', () => {
    const csv = buildDataRequestAdminCsv([{ ...item(), requesterName: 'Ada;"Beispiel"\r\nZweite Zeile' }]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"Ada;""Beispiel""\r\nZweite Zeile"');
    expect(csv).not.toContain(row.verification_notes);
    expect(csv).not.toContain(scope.profileId);
  });
  it.each(['=1+1', ' +SUM(1)', '-12', '@SUM(A1)', '\t=1', '\rvalue', '\nvalue'])('neutralizes spreadsheet formula/control prefixes: %j', value => {
    const csv = buildDataRequestAdminCsv([{ ...item(), requesterName: value }]);
    expect(csv).toContain('"' + "'" + value + '"');
  });
  it('reauthorizes exports and rejects mixed-tenant loaded data', async () => {
    expect((await prepareDataRequestAdminCsv(scope, [item()])).ok).toBe(true);
    expect((await prepareDataRequestAdminCsv(scope, [{ ...item(), tenantId: 'foreign' }])).ok).toBe(false);
    mocks.client.rpc.mockResolvedValue(capability(false, false));
    expect((await prepareDataRequestAdminCsv(scope, [item()])).ok).toBe(false);
  });
});

describe('CSV browser download', () => {
  it('creates and clicks a real download link, then revokes its temporary URL', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:csv-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^betroffenenanfragen-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(this.getAttribute('href')).toBe('blob:csv-test');
      expect(document.body.contains(this)).toBe(true);
    });
    downloadDataRequestAdminCsv('test');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv-test');
  });
});

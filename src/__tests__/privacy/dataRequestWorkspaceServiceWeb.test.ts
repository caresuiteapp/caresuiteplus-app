import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDataRequestAccountExportFile,
  createDataRequestIdempotencyKey,
  downloadDataRequestAccountExport,
  fetchOwnAccountExport,
  listOwnDataRequests,
  submitOwnDataRequest,
  validateDataRequestWorkspaceDraft,
  type DataRequestAccountSnapshot,
  type DataRequestWorkspaceScope,
} from '@/lib/privacy/dataRequestWorkspaceService.web';

const mocks = vi.hoisted(() => ({
  demo: false,
  clientAvailable: true,
  getUser: vi.fn(),
  rpc: vi.fn(),
  resolveProfile: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mocks.clientAvailable ? { auth: { getUser: mocks.getUser }, rpc: mocks.rpc } : null,
}));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => mocks.demo }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: mocks.resolveProfile }));

const scope: DataRequestWorkspaceScope = {
  authUserId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  profileId: '33333333-3333-4333-8333-333333333333',
};
const idempotencyKey = '44444444-4444-4444-8444-444444444444';
const row = {
  id: '55555555-5555-4555-8555-555555555555',
  request_type: 'access',
  status: 'queued',
  request_number: null,
  received_at: '2026-10-19T18:00:00Z',
  created_at: '2026-10-19T18:00:00Z',
  updated_at: '2026-10-19T18:00:00Z',
};
const draft = {
  requestType: 'access' as const,
  requesterName: ' Kevin Reinhardt ',
  requesterEmail: ' kevin@example.org ',
  message: ' Meine Kontodaten\r\nbitte prüfen. ',
};
const snapshot: DataRequestAccountSnapshot = {
  version: 1,
  generatedAt: '2026-10-19T18:00:00Z',
  account: {
    firstName: 'Kevin',
    lastName: 'Reinhardt',
    displayName: 'Kevin Reinhardt',
    email: 'kevin@example.org',
    phone: '+49 123',
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-10-19T18:00:00Z',
  },
};
const safeItem = {
  id: row.id, requestType: 'access', status: 'queued', requestNumber: null,
  receivedAt: row.received_at, createdAt: row.created_at, updatedAt: row.updated_at,
};
function resolveRpc(data: unknown) { mocks.rpc.mockResolvedValue({ data, error: null }); }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.demo = false;
  mocks.clientAvailable = true;
  mocks.getUser.mockResolvedValue({ data: { user: { id: scope.authUserId } }, error: null });
  mocks.resolveProfile.mockResolvedValue({ ok: true, data: scope.profileId });
  resolveRpc({ version: 1, items: [], has_more: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Data request draft validation', () => {
  it('normalizes input without requiring a justification for any supported right', () => {
    for (const requestType of ['access', 'portability', 'correction', 'restriction', 'objection'] as const) {
      expect(validateDataRequestWorkspaceDraft({ ...draft, requestType, message: '' })).toEqual({
        ok: true,
        data: { requestType, requesterName: 'Kevin Reinhardt', requesterEmail: 'kevin@example.org', message: '' },
      });
    }
    expect(validateDataRequestWorkspaceDraft(draft)).toMatchObject({ ok: true, data: { message: 'Meine Kontodaten\nbitte prüfen.' } });
  });

  it.each([
    { requesterName: '' }, { requesterName: 'x'.repeat(161) },
    { requesterEmail: 'ohne@domain' }, { requesterEmail: 'a'.repeat(250) + '@example.org' },
    { requesterName: 'K\u0000evin' }, { message: 'x'.repeat(4001) }, { message: 'a\u0001b' },
    { requestType: 'deletion' },
  ])('rejects invalid or oversized values before an RPC: %j', async (patch) => {
    const input = { ...draft, ...patch, idempotencyKey } as Parameters<typeof submitOwnDataRequest>[1];
    expect((await submitOwnDataRequest(scope, input)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not create an idempotency key from an insecure random fallback', () => {
    vi.stubGlobal('crypto', undefined);
    expect(createDataRequestIdempotencyKey().ok).toBe(false);
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => { bytes.fill(0); return bytes; } });
    expect(createDataRequestIdempotencyKey()).toEqual({ ok: true, data: '00000000-0000-4000-8000-000000000000' });
  });
});

describe('Data request identity and server contract', () => {
  it('uses the verified legacy profile mapping and sends identity expectations, never a target override', async () => {
    resolveRpc({ version: 1, items: [{ ...row, verification_notes: 'Internal secret', result_summary: 'Internal result', metadata: { token: 'secret' } }], has_more: true });
    const result = await listOwnDataRequests(scope, { limit: 1, offset: 3 });
    expect(mocks.resolveProfile).toHaveBeenCalledWith(scope.tenantId);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('data_request_workspace_v1', {
      p_action: 'list',
      p_payload: {
        limit: 1, offset: 3,
        expected_auth_user_id: scope.authUserId,
        expected_tenant_id: scope.tenantId,
        expected_profile_id: scope.profileId,
      },
    });
    expect(result).toEqual({ ok: true, data: { items: [safeItem], hasMore: true, nextOffset: 4 } });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('Internal result');
  });

  it('rejects the wrong user or profile before accessing requests', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'different-user' } }, error: null });
    expect(await listOwnDataRequests(scope)).toMatchObject({ ok: false, code: 'identity' });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: { id: scope.authUserId } }, error: null });
    mocks.resolveProfile.mockResolvedValue({ ok: true, data: 'different-profile' });
    expect(await listOwnDataRequests(scope)).toMatchObject({ ok: false, code: 'identity' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('discards an old identity response after a session switch during the RPC', async () => {
    mocks.rpc.mockImplementation(async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'new-session' } }, error: null });
      return { data: { version: 1, items: [row], has_more: false }, error: null };
    });
    expect(await listOwnDataRequests(scope)).toMatchObject({ ok: false, code: 'identity' });
  });

  it('retains the caller idempotency key across an uncertain result and retry', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('Failed to fetch'));
    const first = await submitOwnDataRequest(scope, { ...draft, idempotencyKey });
    expect(first).toMatchObject({ ok: false, code: 'connection' });
    resolveRpc({ version: 1, item: row, replayed: true });
    const second = await submitOwnDataRequest(scope, { ...draft, idempotencyKey });
    expect(second).toEqual({ ok: true, data: { request: safeItem, replayed: true } });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    for (const call of mocks.rpc.mock.calls) {
      expect(call[1].p_payload).toMatchObject({
        idempotency_key: idempotencyKey,
        request_type: 'access',
        requester_name: 'Kevin Reinhardt',
        requester_email: 'kevin@example.org',
        message: 'Meine Kontodaten\nbitte prüfen.',
      });
    }
  });

  it('rejects malformed or mismatched submissions rather than reporting success', async () => {
    resolveRpc({ version: 1, item: { ...row, request_type: 'correction' }, replayed: false });
    expect(await submitOwnDataRequest(scope, { ...draft, idempotencyKey })).toMatchObject({ ok: false, code: 'invalid_response' });
  });

  it.each([
    { version: 2, items: [], has_more: false },
    { version: 1, items: [{ ...row, created_at: 'invalid' }], has_more: false },
    { version: 1, items: [row, row], has_more: false },
    { version: 1, items: [], has_more: true },
    { version: 1, items: [{ ...row, status: 'invented' }], has_more: false },
  ])('rejects unsafe response data: %j', async (data) => {
    resolveRpc(data);
    expect(await listOwnDataRequests(scope)).toMatchObject({ ok: false, code: 'invalid_response' });
  });

  it('identifies unavailable setup without exposing schema names or SQL details', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'public.data_request_workspace_v1 is missing, secret implementation detail' } });
    const result = await listOwnDataRequests(scope);
    expect(result).toMatchObject({ ok: false, code: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('public.');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('does not silently use demo or fallback data', async () => {
    mocks.demo = true;
    expect(await listOwnDataRequests(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.demo = false;
    mocks.clientAvailable = false;
    expect(await fetchOwnAccountExport(scope)).toMatchObject({ ok: false, code: 'unavailable' });
  });
});

describe('Limited account export', () => {
  it('fetches fresh account fields and discards identifiers, tokens, internal notes and unknown fields', async () => {
    resolveRpc({
      version: 1, generated_at: snapshot.generatedAt,
      account: {
        first_name: 'Kevin', last_name: 'Reinhardt', display_name: 'Kevin Reinhardt',
        email: 'kevin@example.org', phone: '+49 123',
        created_at: snapshot.account.createdAt, updated_at: snapshot.account.updatedAt,
        id: 'private-id', auth_user_id: 'private-auth', access_token: 'TOKEN', verification_notes: 'SECRET',
      },
    });
    const result = await fetchOwnAccountExport(scope);
    expect(result).toEqual({ ok: true, data: snapshot });
    expect(mocks.rpc).toHaveBeenCalledWith('data_request_workspace_v1', expect.objectContaining({ p_action: 'account_export' }));
    expect(JSON.stringify(result)).not.toMatch(/TOKEN|SECRET|private-/);
  });

  it('writes a scope-labelled JSON allowlist without copying injected object properties', () => {
    const extra = { ...snapshot, account: { ...snapshot.account, access_token: 'TOKEN', metadata: 'SECRET' } };
    const file = buildDataRequestAccountExportFile(extra, 'json');
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    const json = JSON.parse(file.data.content);
    expect(json.completeDataSubjectAccessResponse).toBe(false);
    expect(json.scope).toContain('Profil- und Kontaktdaten');
    expect(json.excluded).toContain('Gesundheitsdaten');
    expect(json.account).toEqual(snapshot.account);
    expect(file.data.content).not.toMatch(/TOKEN|SECRET/);
    expect(file.data.fileName).toBe('caresuite-kontodaten-2026-10-19.json');
  });

  it('neutralizes formula-like values and escapes quotes, delimiters and line breaks in CSV', () => {
    const file = buildDataRequestAccountExportFile({
      ...snapshot,
      account: {
        ...snapshot.account,
        firstName: '=HYPERLINK("https://example.org")',
        lastName: ' \t@SUM(1)',
        displayName: 'Name;"Zitat"\nZeile',
        phone: '+49 123',
      },
    }, 'csv');
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    expect(file.data.content.startsWith('\uFEFF')).toBe(true);
    expect(file.data.content).toContain('"' + "'=HYPERLINK(" + '""https://example.org"")"');
    expect(file.data.content).toContain('"' + "' \t@SUM(1)" + '"');
    expect(file.data.content).toContain('"Name;""Zitat""\nZeile"');
    expect(file.data.content).toContain('"' + "'+49 123" + '"');
  });

  it('starts a real browser download and releases its object URL without claiming a saved file', () => {
    vi.useFakeTimers();
    const anchor = { href: '', download: '', style: { display: '' }, click: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:account-export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild } });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    expect(downloadDataRequestAccountExport(snapshot, 'json')).toEqual({ ok: true, data: { fileName: 'caresuite-kontodaten-2026-10-19.json' } });
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('caresuite-kontodaten-2026-10-19.json');
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:account-export');
  });

  it('cleans up and reports browser download failures', () => {
    const anchor = { href: '', download: '', style: { display: '' }, click: vi.fn(() => { throw new Error('Blocked'); }), remove: vi.fn() };
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:account-export', revokeObjectURL });
    expect(downloadDataRequestAccountExport(snapshot, 'csv').ok).toBe(false);
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:account-export');
  });
});

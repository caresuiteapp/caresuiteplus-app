import { describe, expect, it, vi } from 'vitest';
import {
  handleDataSubjectRequestAdminNotify,
  collectScopedAdminProfileEmails,
  type DataRequestNotifyDependencies,
} from '../../../supabase/functions/_shared/dataSubjectRequestAdminNotifyHandler';

const tenantId = '10000000-0000-4000-8000-000000000001';
const requestId = '20000000-0000-4000-8000-000000000001';
const profileId = '30000000-0000-4000-8000-000000000001';
const authUserId = '40000000-0000-4000-8000-000000000001';
const otherId = '50000000-0000-4000-8000-000000000001';
const claimToken = '60000000-0000-4000-8000-000000000001';

function fixture() {
  const dependencies: DataRequestNotifyDependencies = {
    resolveCaller: vi.fn(async () => ({
      authUserId, profileId, profileAuthUserId: authUserId, tenantId,
      active: true, selfService: true, adminManage: false,
    })),
    loadRequest: vi.fn(async () => ({
      id: requestId, tenant_id: tenantId, profile_id: profileId, request_type: 'access',
      requester_name: 'Gespeicherter Name', requester_email: 'saved@example.test',
      received_at: '2026-10-19T08:00:00Z', created_at: '2026-10-19T08:00:00Z',
    })),
    isConfigured: vi.fn(() => true),
    loadRecipients: vi.fn(async () => ['admin@example.test', 'owner@example.test']),
    claimDelivery: vi.fn(async () => ({ claimed: true, claimToken })),
    finishDelivery: vi.fn(async () => undefined),
    send: vi.fn(async () => ({ ok: true })),
  };
  return dependencies;
}

function request(body: unknown = { tenantId, requestId }) {
  return new Request('https://example.test/notify-data-subject-request-admin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('data subject request notification authorization and delivery', () => {
  it('accepts only own/global admin roles and rejects foreign or ambiguous recipient roles', () => {
    const emails = collectScopedAdminProfileEmails([
      { email: 'own@example.test', roles: { is_admin_role: true, tenant_id: tenantId } },
      { email: 'global@example.test', roles: { is_admin_role: true, tenant_id: null } },
      { email: 'legacy@example.test', roles: { is_admin_role: true } },
      { email: 'array@example.test', roles: [{ is_admin_role: true, tenant_id: tenantId }] },
      { email: 'foreign@example.test', roles: { is_admin_role: true, tenant_id: otherId } },
      { email: 'staff@example.test', roles: { is_admin_role: false, tenant_id: tenantId } },
      { email: 'empty-tenant@example.test', roles: { is_admin_role: true, tenant_id: '' } },
      { email: 'ambiguous@example.test', roles: [{ is_admin_role: true }, { is_admin_role: true }] },
      { email: 'missing@example.test', roles: null },
    ], tenantId);
    expect(emails).toEqual(['own@example.test', 'global@example.test', 'legacy@example.test', 'array@example.test']);
  });

  it('ignores client PII and sends only canonical stored fields for an authorized owner', async () => {
    const deps = fixture();
    const result = await handleDataSubjectRequestAdminNotify(request({
      tenantId, requestId, requesterName: 'Forged', requesterEmail: 'forged@example.test',
      requestType: 'deletion', receivedAt: '1900-01-01',
    }), deps);
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('sent');
    expect(deps.send).toHaveBeenCalledWith({
      tenantId, requestId, requestType: 'access', requesterName: 'Gespeicherter Name',
      requesterEmail: 'saved@example.test', receivedAt: '2026-10-19T08:00:00Z',
    }, ['admin@example.test', 'owner@example.test']);
    expect(deps.finishDelivery).toHaveBeenCalledWith(requestId, claimToken, true);
    expect(result.body).not.toHaveProperty('recipientCount');
    expect(JSON.stringify(result.body)).not.toContain('admin@example.test');
    expect(JSON.stringify(result.body)).not.toContain('2 Empfänger');
  });

  it('rejects another person in the same tenant before looking up recipients or claiming delivery', async () => {
    const deps = fixture();
    const row = await deps.loadRequest(tenantId, requestId);
    vi.mocked(deps.loadRequest).mockResolvedValue({ ...row!, profile_id: otherId });
    const result = await handleDataSubjectRequestAdminNotify(request(), deps);
    expect(result.statusCode).toBe(403);
    expect(deps.loadRecipients).not.toHaveBeenCalled();
    expect(deps.claimDelivery).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('allows a confirmed internal manager to notify about a request belonging to another person', async () => {
    const deps = fixture();
    const caller = await deps.resolveCaller(request(), tenantId);
    vi.mocked(deps.resolveCaller).mockResolvedValue({ ...caller!, adminManage: true });
    const row = await deps.loadRequest(tenantId, requestId);
    vi.mocked(deps.loadRequest).mockResolvedValue({ ...row!, profile_id: otherId });
    expect((await handleDataSubjectRequestAdminNotify(request(), deps)).body.status).toBe('sent');
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it.each([
    { active: false },
    { selfService: false },
    { tenantId: otherId },
    { profileAuthUserId: otherId },
  ])('rejects stale or mismatched caller scope: %j', async (change) => {
    const deps = fixture();
    const caller = await deps.resolveCaller(request(), tenantId);
    vi.mocked(deps.resolveCaller).mockResolvedValue({ ...caller!, ...change });
    expect((await handleDataSubjectRequestAdminNotify(request(), deps)).statusCode).toBe(403);
    expect(deps.loadRequest).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('does not reveal whether an inaccessible request exists', async () => {
    const deps = fixture();
    vi.mocked(deps.loadRequest).mockResolvedValue(null);
    const missing = await handleDataSubjectRequestAdminNotify(request(), deps);
    const other = fixture();
    const row = await other.loadRequest(tenantId, requestId);
    vi.mocked(other.loadRequest).mockResolvedValue({ ...row!, profile_id: otherId });
    expect(missing).toEqual(await handleDataSubjectRequestAdminNotify(request(), other));
  });

  it('rejects a cross-tenant stored result even for an internal manager', async () => {
    const deps = fixture();
    const caller = await deps.resolveCaller(request(), tenantId);
    const row = await deps.loadRequest(tenantId, requestId);
    vi.mocked(deps.resolveCaller).mockResolvedValue({ ...caller!, adminManage: true });
    vi.mocked(deps.loadRequest).mockResolvedValue({ ...row!, tenant_id: otherId });
    expect((await handleDataSubjectRequestAdminNotify(request(), deps)).statusCode).toBe(403);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { tenantId, requestId: 'not-an-id' }])('rejects invalid input %j', async (body) => {
    const deps = fixture();
    expect((await handleDataSubjectRequestAdminNotify(request(body), deps)).statusCode).toBe(400);
    expect(deps.resolveCaller).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('does not claim or send when email configuration is absent', async () => {
    const deps = fixture();
    vi.mocked(deps.isConfigured).mockReturnValue(false);
    expect((await handleDataSubjectRequestAdminNotify(request(), deps)).body.status).toBe('prepared_only');
    expect(deps.loadRecipients).not.toHaveBeenCalled();
    expect(deps.claimDelivery).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('does not expose missing recipient configuration', async () => {
    const deps = fixture();
    vi.mocked(deps.loadRecipients).mockResolvedValue([]);
    const result = await handleDataSubjectRequestAdminNotify(request(), deps);
    expect(result.body.status).toBe('prepared_only');
    expect(result.body).not.toHaveProperty('recipientCount');
    expect(deps.claimDelivery).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('never sends again when a prior request has already claimed delivery', async () => {
    const deps = fixture();
    vi.mocked(deps.claimDelivery).mockResolvedValue({ claimed: false });
    const result = await handleDataSubjectRequestAdminNotify(request(), deps);
    expect(result.body.status).toBe('prepared_only');
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.finishDelivery).not.toHaveBeenCalled();
  });

  it('fails closed if the persistent claim RPC is unavailable', async () => {
    const deps = fixture();
    vi.mocked(deps.claimDelivery).mockRejectedValue(new Error('private database diagnostic'));
    const result = await handleDataSubjectRequestAdminNotify(request(), deps);
    expect(result.statusCode).toBe(503);
    expect(deps.send).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private database diagnostic');
  });

  it('reports a provider rejection without claiming that the request itself was lost', async () => {
    const deps = fixture();
    vi.mocked(deps.send).mockResolvedValue({ ok: false });
    const result = await handleDataSubjectRequestAdminNotify(request(), deps);
    expect(result.statusCode).toBe(502);
    expect(result.body.ok).toBe(false);
    expect(result.body.status).toBe('send_failed');
    expect(result.body.message).toContain('Anfrage ist gespeichert');
    expect(deps.finishDelivery).toHaveBeenCalledWith(requestId, claimToken, false);
  });

  it('does not retry or expose provider details after an uncertain timeout', async () => {
    const deps = fixture();
    vi.mocked(deps.send).mockRejectedValue(new Error('provider secret and recipient details'));
    const result = await handleDataSubjectRequestAdminNotify(request(), deps);
    expect(result.statusCode).toBe(502);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.finishDelivery).toHaveBeenCalledWith(requestId, claimToken, false);
    expect(JSON.stringify(result)).not.toContain('provider secret');
  });

  it('preserves an acknowledged delivery if recording its outcome fails', async () => {
    const deps = fixture();
    vi.mocked(deps.finishDelivery).mockRejectedValue(new Error('ledger unavailable'));
    const result = await handleDataSubjectRequestAdminNotify(request(), deps);
    expect(result.body.status).toBe('sent');
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(result.body).not.toHaveProperty('recipientCount');
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  consumePortalPushResponse,
  isAllowedPortalPushRoute,
  portalPushDestination,
} from '@/lib/portal/portalPushNavigation';
import {
  notificationFor,
  processPortalPush,
  type PushQueue,
  type PushTarget,
  type PushWork,
} from '../../../supabase/functions/portal-push-dispatch/worker';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
const uid = '00000000-0000-4000-8000-000000000001';
const session = {
  accountId: 'account',
  tenantId: 'tenant',
  roleKey: 'client_portal',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
} as PortalSessionRecord;
const data = { accountId: 'account', tenantId: 'tenant', route: `/portal/client/messages/${uid}` };
describe('Push tap follows only the authenticated portal account', () => {
  it('opens the exact thread after login and rejects another account, expired sessions and role crossings', () => {
    expect(portalPushDestination(data, session)).toBe(data.route);
    expect(portalPushDestination(data, null)).toBeNull();
    expect(portalPushDestination({ ...data, accountId: 'other' }, session)).toBeNull();
    expect(portalPushDestination({ ...data, tenantId: 'other' }, session)).toBeNull();
    expect(portalPushDestination(data, { ...session, mustChangePassword: true })).toBeNull();
    expect(portalPushDestination(data, { ...session, expiresAt: 'invalid' })).toBeNull();
    expect(portalPushDestination(data, { ...session, roleKey: 'employee_portal' })).toBeNull();
    expect(portalPushDestination({ route: data.route }, session)).toBeNull();
  });
  it('does not accept arbitrary URLs or path traversal; document signatures and explicit updates are valid', () => {
    for (const route of [
      'https://evil.test',
      '/portal/client/../employee/messages',
      '/portal/client/messages?redirect=https://evil.test',
      '/portal/client/messages/%2e%2e',
      '/portal/client/profile?pushUpdate=NaN',
    ])
      expect(isAllowedPortalPushRoute(route)).toBe(false);
    expect(isAllowedPortalPushRoute(`/portal/employee/documents/signatures/${uid}`)).toBe(true);
    expect(isAllowedPortalPushRoute('/portal/client/profile?pushUpdate=35')).toBe(true);
  });
  it('consumes the same response only once across component remounts', () => {
    expect(consumePortalPushResponse('unique-response-1')).toBe(true);
    expect(consumePortalPushResponse('unique-response-1')).toBe(false);
  });
});
const work: PushWork = {
  id: uid,
  lease_token: 'lease',
  event_kind: 'message',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};
const target: PushTarget = {
  expo_push_token: 'ExpoPushToken[test]',
  route: data.route,
  account_id: 'account',
  tenant_id: 'tenant',
};
function setup() {
  const queue = {
    claim: vi.fn(async () => [work]),
    target: vi.fn(async () => target as PushTarget | null),
    finish: vi.fn(async () => {}),
    receipts: vi.fn(async () => [] as { id: string; expo_ticket_id: string; updated_at: string }[]),
    receipt: vi.fn(async () => {}),
  } satisfies PushQueue;
  const transport = {
    send: vi.fn(async (_messages: Record<string, unknown>[]) => [
      { status: 'ok' as const, id: 'ticket' },
    ]),
    receipts: vi.fn(async () => ({})),
  };
  return { queue, transport };
}
describe('Server queue delivery behavior', () => {
  it('hands a neutral scoped payload to Expo and saves the ticket', async () => {
    const { queue, transport } = setup();
    await processPortalPush(queue, transport);
    expect(queue.finish).toHaveBeenCalledWith(work, 'accepted', 'ticket', null);
    const payload = transport.send.mock.calls[0]?.[0];
    expect(payload).toEqual([notificationFor(work, target)]);
    expect(JSON.stringify(payload)).not.toContain('password');
    expect(payload?.[0].data).toEqual({
      notificationId: uid,
      route: data.route,
      accountId: 'account',
      tenantId: 'tenant',
    });
  });
  it('does not send if the recipient loses access between enqueue and delivery', async () => {
    const { queue, transport } = setup();
    queue.target.mockResolvedValue(null);
    await processPortalPush(queue, transport);
    expect(transport.send).not.toHaveBeenCalled();
    expect(queue.finish).toHaveBeenCalledWith(work, 'cancelled', null, 'no_longer_accessible');
  });
  it('retries a temporary transport failure without declaring it delivered', async () => {
    const { queue, transport } = setup();
    transport.send.mockRejectedValue(new Error('offline'));
    await processPortalPush(queue, transport);
    expect(queue.finish).toHaveBeenCalledWith(work, 'retry', null, 'transport_unavailable');
  });
  it('does not resend accepted tickets when receipt lookup fails', async () => {
    const { queue, transport } = setup();
    queue.claim.mockResolvedValue([]);
    queue.receipts.mockResolvedValue([
      { id: uid, expo_ticket_id: 'already-accepted', updated_at: new Date().toISOString() },
    ]);
    transport.receipts.mockRejectedValue(new Error('offline'));
    await processPortalPush(queue, transport);
    expect(transport.send).not.toHaveBeenCalled();
    expect(queue.finish).not.toHaveBeenCalled();
  });
});

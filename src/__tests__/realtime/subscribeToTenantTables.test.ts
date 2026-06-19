import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllRealtimeSubscriptions,
  getActiveRealtimeSubscriptionCount,
} from '@/lib/realtime/channelManager';
import { subscribeToTenantTables } from '@/lib/realtime/subscribeToTenantTables';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

const mockChannel = vi.fn();
const mockGetChannels = vi.fn(() => []);
const mockRemoveChannel = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    channel: mockChannel,
    getChannels: mockGetChannels,
    removeChannel: mockRemoveChannel,
  }),
}));

describe('subscribeToTenantTables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllRealtimeSubscriptions();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const callOrder: string[] = [];
    mockChannel.mockImplementation(() => ({
      on: vi.fn((_event, _config, callback) => {
        callOrder.push('on:postgres_changes');
        (mockChannel as unknown as { lastCallback?: () => void }).lastCallback = callback;
        return {
          on: vi.fn((_event2, _config2, callback2) => {
            callOrder.push('on:postgres_changes');
            (mockChannel as unknown as { lastCallback?: () => void }).lastCallback = callback2;
            return {
              subscribe: vi.fn(() => {
                callOrder.push('subscribe');
                (mockChannel as unknown as { callOrder?: string[] }).callOrder = callOrder;
                return { topic: 'realtime:test-channel' };
              }),
            };
          }),
          subscribe: vi.fn(() => {
            callOrder.push('subscribe');
            (mockChannel as unknown as { callOrder?: string[] }).callOrder = callOrder;
            return { topic: 'realtime:test-channel' };
          }),
        };
      }),
      subscribe: vi.fn(() => {
        callOrder.push('subscribe');
        (mockChannel as unknown as { callOrder?: string[] }).callOrder = callOrder;
        return { topic: 'realtime:test-channel' };
      }),
    }));
  });

  afterEach(() => {
    clearAllRealtimeSubscriptions();
  });

  it('registriert postgres_changes vor subscribe()', () => {
    subscribeToTenantTables(
      {
        subscriptionKey: 'test:order',
        channelName: 'test-channel',
        specs: [{ table: 'clients', filter: `tenant_id=eq.${TENANT_ID}` }],
      },
      vi.fn(),
    );

    const callOrder = (mockChannel as unknown as { callOrder?: string[] }).callOrder ?? [];
    expect(callOrder.indexOf('on:postgres_changes')).toBeLessThan(callOrder.indexOf('subscribe'));
  });

  it('dedupliziert Channel-Subscriptions und ruft alle Handler auf', () => {
    const handlerOne = vi.fn();
    const handlerTwo = vi.fn();

    const unsubOne = subscribeToTenantTables(
      {
        subscriptionKey: 'test:dedup',
        channelName: 'test-dedup',
        specs: [{ table: 'clients', filter: `tenant_id=eq.${TENANT_ID}` }],
      },
      handlerOne,
    );
    const unsubTwo = subscribeToTenantTables(
      {
        subscriptionKey: 'test:dedup',
        channelName: 'test-dedup',
        specs: [{ table: 'clients', filter: `tenant_id=eq.${TENANT_ID}` }],
      },
      handlerTwo,
    );

    expect(getActiveRealtimeSubscriptionCount()).toBe(1);
    expect(mockChannel).toHaveBeenCalledTimes(1);

    const callback = (mockChannel as unknown as { lastCallback?: () => void }).lastCallback;
    callback?.();

    expect(handlerOne).toHaveBeenCalledTimes(1);
    expect(handlerTwo).toHaveBeenCalledTimes(1);

    unsubOne();
    expect(getActiveRealtimeSubscriptionCount()).toBe(1);

    unsubTwo();
    expect(getActiveRealtimeSubscriptionCount()).toBe(0);
  });

  it('löst Handler bei postgres_changes Callback aus', () => {
    const handler = vi.fn();

    subscribeToTenantTables(
      {
        subscriptionKey: 'test:callback',
        channelName: 'test-callback',
        specs: [{ table: 'portal_requests', filter: `tenant_id=eq.${TENANT_ID}` }],
      },
      handler,
    );

    const callback = (mockChannel as unknown as { lastCallback?: () => void }).lastCallback;
    expect(callback).toBeTypeOf('function');
    callback?.();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

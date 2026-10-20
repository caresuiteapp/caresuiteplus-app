import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueAssistLocationPoint,
  flushAssistLocationPointQueue,
  getQueuedAssistLocationPointCount,
} from '@/features/liveTracking/assistLocationPointQueue';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  append: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => mocks.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { mocks.storage.set(key, value); },
    removeItem: async (key: string) => { mocks.storage.delete(key); },
  },
}));
vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({
  appendLocationPoint: mocks.append,
}));

const point = {
  sessionId: 'synthetic-session',
  visitId: 'synthetic-visit',
  latitude: 51.5,
  longitude: 7.4,
  accuracyMeters: 8,
  recordedAt: '2026-09-05T08:00:00.000Z',
  source: 'device' as const,
};

describe('GPS queue recovery with real queue logic and isolated storage', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.append.mockReset();
    mocks.append.mockResolvedValue({ ok: true });
  });

  it('retains offline points and sends them in order when the connection returns', async () => {
    await enqueueAssistLocationPoint('synthetic-tenant', point);
    await enqueueAssistLocationPoint('synthetic-tenant', { ...point, recordedAt: '2026-09-05T08:01:00.000Z' });
    mocks.append.mockResolvedValue({ ok: false, error: 'offline' });
    expect(await flushAssistLocationPointQueue()).toEqual({ sent: 0, remaining: 2 });
    expect(await getQueuedAssistLocationPointCount()).toBe(2);
    mocks.append.mockClear();
    mocks.append.mockResolvedValue({ ok: true });
    expect(await flushAssistLocationPointQueue()).toEqual({ sent: 2, remaining: 0 });
    expect(mocks.append.mock.calls.map((call) => call[1].recordedAt)).toEqual([
      point.recordedAt, '2026-09-05T08:01:00.000Z',
    ]);
    expect(await getQueuedAssistLocationPointCount()).toBe(0);
  });

  it('does not delete queued points when the transport throws', async () => {
    await enqueueAssistLocationPoint('synthetic-tenant', point);
    mocks.append.mockRejectedValueOnce(new Error('connection interrupted'));
    await expect(flushAssistLocationPointQueue()).rejects.toThrow('connection interrupted');
    expect(await getQueuedAssistLocationPointCount()).toBe(1);
    expect(await flushAssistLocationPointQueue()).toEqual({ sent: 1, remaining: 0 });
  });

  it('serializes reconnect and heartbeat flushes so each queued point is sent once', async () => {
    await enqueueAssistLocationPoint('synthetic-tenant', point);
    expect(await Promise.all([
      flushAssistLocationPointQueue(), flushAssistLocationPointQueue(),
    ])).toEqual([{ sent: 1, remaining: 0 }, { sent: 0, remaining: 0 }]);
    expect(mocks.append).toHaveBeenCalledTimes(1);
  });
});

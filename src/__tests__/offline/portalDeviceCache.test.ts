import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalClientAppointmentDetail } from '@/types/portal/client';
const memory = vi.hoisted(() => new Map<string, string>());
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/security/sensitiveAuthStorage', () => ({
  sensitiveAuthStorage: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, raw: string) => {
      memory.set(key, raw);
    }),
    removeItem: vi.fn(async (key: string) => {
      memory.delete(key);
    }),
  },
}));
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';
import {
  clearOfflineDb,
  getStoreRecord,
  putStoreRecord,
  offlineCacheEpoch,
} from '@/lib/offline/idb';
import {
  readClientAppointmentCache,
  writeClientAppointmentCache,
} from '@/lib/offline/clientAppointmentCache';
const scope = {
  tenantId: 'tenant-a',
  accountId: 'account-a',
  clientId: 'client-a',
  roleKey: 'client_portal' as const,
};
const detail = {
  id: 'visit-a',
  title: 'Besuch',
  liveVisit: { mapVisible: true, lastPosition: { latitude: 51, longitude: 7 } },
} as PortalClientAppointmentDetail;
beforeEach(async () => {
  await clearOfflineDb();
  memory.clear();
  vi.clearAllMocks();
});
describe('Native encrypted read-model cache', () => {
  it('reopens a recent detail without another secure disk read and without sharing mutable objects', async () => {
    await putStoreRecord('assignments', { key: 'visit-a', data: { title: 'Saved' } });
    vi.mocked(sensitiveAuthStorage.getItem).mockClear();
    const a = await getStoreRecord<{ key: string; data: { title: string } }>(
      'assignments',
      'visit-a',
    );
    a!.data.title = 'Unsaved change';
    const b = await getStoreRecord<{ key: string; data: { title: string } }>(
      'assignments',
      'visit-a',
    );
    expect(b!.data.title).toBe('Saved');
    expect(sensitiveAuthStorage.getItem).not.toHaveBeenCalled();
  });
  it('serializes overlapping writes so an older save cannot replace the newest record', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = vi.mocked(sensitiveAuthStorage.setItem).getMockImplementation()!;
    vi.mocked(sensitiveAuthStorage.setItem).mockImplementation(async (key, raw) => {
      if (raw.includes('first')) await held;
      await original(key, raw);
    });
    const first = putStoreRecord('assignments', { key: 'same', value: 'first' });
    const second = putStoreRecord('assignments', { key: 'same', value: 'second' });
    release();
    await Promise.all([first, second]);
    expect(await getStoreRecord('assignments', 'same')).toEqual({ key: 'same', value: 'second' });
    vi.mocked(sensitiveAuthStorage.setItem).mockImplementation(original);
  });
  it('separates client/account/tenant data, preserves drafts and never restores old GPS as live', async () => {
    await putStoreRecord('doc_drafts', { key: 'draft-a', value: 'Unsaved' });
    expect(await writeClientAppointmentCache(scope, detail)).toBe(true);
    expect((await readClientAppointmentCache(scope, 'visit-a'))?.data.liveVisit).toBeNull();
    for (const changed of [
      { accountId: 'other' },
      { tenantId: 'other' },
      { clientId: 'other' },
      { roleKey: 'employee_portal' as const },
    ]) {
      expect(await readClientAppointmentCache({ ...scope, ...changed }, 'visit-a')).toBeNull();
    }
    expect(await getStoreRecord('doc_drafts', 'draft-a')).toEqual({
      key: 'draft-a',
      value: 'Unsaved',
    });
  });
  it('rejects late cache writes after logout and removes disk and memory copies', async () => {
    const epoch = offlineCacheEpoch();
    await writeClientAppointmentCache(scope, detail, epoch);
    await clearOfflineDb();
    expect(await readClientAppointmentCache(scope, 'visit-a')).toBeNull();
    expect(await writeClientAppointmentCache(scope, detail, epoch)).toBe(false);
    expect([...memory.keys()].filter((key) => key.includes('record'))).toEqual([]);
  });
});

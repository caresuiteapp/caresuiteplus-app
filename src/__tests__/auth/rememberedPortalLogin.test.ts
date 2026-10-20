import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveRememberedPortalLogin,
  getRememberedPortalMetadata,
  unlockRememberedPortalLogin,
  forgetRememberedPortalLogin,
} from '@/lib/auth/rememberedPortalLogin';
const mocks = vi.hoisted(() => ({
  platform: { OS: 'android' },
  storage: new Map<string, string>(),
  reads: [] as string[],
  authenticate: vi.fn(async () => ({ ok: true })),
}));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('@/lib/auth/portalBiometricService', () => ({
  authenticatePortalFace: mocks.authenticate,
}));
vi.mock('@/lib/security/sensitiveAuthStorage', () => ({
  sensitiveAuthStorage: {
    getItem: vi.fn(async (key: string) => {
      mocks.reads.push(key);
      return mocks.storage.get(key) ?? null;
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      mocks.storage.delete(key);
    }),
  },
}));
const credential = {
  version: 1 as const,
  kind: 'employee' as const,
  accountId: 'account-1',
  tenantId: 'tenant-1',
  username: 'synthetic-user',
  secret: 'synthetic-password',
};
beforeEach(() => {
  mocks.storage.clear();
  mocks.reads.length = 0;
  mocks.platform.OS = 'android';
  mocks.authenticate.mockReset().mockResolvedValue({ ok: true });
});
describe('Device-protected remembered portal login', () => {
  it('stores credentials only after successful device confirmation and never exposes the secret in metadata', async () => {
    await saveRememberedPortalLogin(credential);
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(await getRememberedPortalMetadata('employee')).toEqual({
      version: 1,
      kind: 'employee',
      accountId: 'account-1',
      tenantId: 'tenant-1',
      username: 'synthetic-user',
    });
    expect(await unlockRememberedPortalLogin('employee')).toEqual(credential);
  });
  it('does not read the saved secret when device confirmation is cancelled', async () => {
    await saveRememberedPortalLogin(credential);
    mocks.reads.length = 0;
    mocks.authenticate.mockResolvedValue({ ok: false });
    await expect(unlockRememberedPortalLogin('employee')).rejects.toThrow();
    expect(mocks.reads.some((key) => key.endsWith('.credential'))).toBe(false);
  });
  it('never stores a native password in web storage', async () => {
    mocks.platform.OS = 'web';
    await expect(saveRememberedPortalLogin(credential)).rejects.toThrow();
    expect(mocks.storage.size).toBe(0);
    expect(await getRememberedPortalMetadata('employee')).toBeNull();
  });
  it('refuses another account changed during the device prompt', async () => {
    await saveRememberedPortalLogin(credential);
    mocks.authenticate.mockImplementation(async () => {
      const key = 'caresuite.remembered-login.v1.employee.metadata';
      mocks.storage.set(key, JSON.stringify({ ...credential, accountId: 'account-2' }));
      return { ok: true };
    });
    await expect(unlockRememberedPortalLogin('employee')).rejects.toThrow('geändert');
  });
  it('removes only the matching account and leaves the other portal kind intact', async () => {
    await saveRememberedPortalLogin(credential);
    await saveRememberedPortalLogin({ ...credential, kind: 'client', accountId: 'client-1' });
    await forgetRememberedPortalLogin('employee', 'someone-else');
    expect(await getRememberedPortalMetadata('employee')).not.toBeNull();
    await forgetRememberedPortalLogin('employee', 'account-1');
    expect(await getRememberedPortalMetadata('employee')).toBeNull();
    expect(await getRememberedPortalMetadata('client')).not.toBeNull();
  });
});

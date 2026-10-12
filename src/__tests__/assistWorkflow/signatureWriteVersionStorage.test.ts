import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ values: new Map<string, string>(), get: vi.fn(), set: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: h.get, setItem: h.set } }));
import { loadVisitSignatureWriteVersion, storeVisitSignatureWriteVersion } from '@/lib/portal/visitSignatureWriteVersionStorage';
const version = { payloadHash: 'payload-new', signatureHash: 'image-new', signerName: 'Erika', signerRole: 'client' };
const scope = 'tenant:employee:profile:account:visit';
beforeEach(() => {
  h.values.clear(); vi.clearAllMocks();
  vi.stubGlobal('sessionStorage', undefined);
  h.get.mockImplementation(async (key: string) => h.values.get(key) ?? null);
  h.set.mockImplementation(async (key: string, value: string) => { h.values.set(key, value); });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('survives native restart through device storage without storing an image', async () => {
  await storeVisitSignatureWriteVersion(scope, version);
  expect(await loadVisitSignatureWriteVersion(scope)).toEqual(version);
  const saved = [...h.values.values()][0];
  expect(saved).not.toContain('data:image'); expect(JSON.parse(saved)).toEqual({ scope, signature: version });
});
it('survives a Web reload with session storage and requires a durable device write before submission', async () => {
  const browser = new Map<string,string>();
  vi.stubGlobal('sessionStorage', { setItem: (key: string,value: string) => browser.set(key,value), getItem: (key: string) => browser.get(key) ?? null });
  await storeVisitSignatureWriteVersion(scope, version);
  h.get.mockRejectedValue(new Error('device read offline'));
  expect(await loadVisitSignatureWriteVersion(scope)).toEqual(version);
  expect(h.set).toHaveBeenCalledOnce();
});
it.each(['tenant', 'employee', 'profile', 'account', 'visit'])('does not restore a former %s scope as a new signature success', async changed => {
  await storeVisitSignatureWriteVersion(scope, version);
  expect(await loadVisitSignatureWriteVersion(scope.replace(changed, 'other'))).toBeNull();
});
it('rejects a stored actor mismatch or incorrectly typed metadata', async () => {
  await storeVisitSignatureWriteVersion(scope, version);
  const storageKey = [...h.values.keys()][0];
  h.values.set(storageKey, JSON.stringify({ scope: 'other-account', signature: version }));
  expect(await loadVisitSignatureWriteVersion(scope)).toBeNull();
  h.values.set(storageKey, JSON.stringify({ scope, signature: { ...version, payloadHash: { fake: true } } }));
  expect(await loadVisitSignatureWriteVersion(scope)).toBeNull();
});
it('never silently treats corrupt or unavailable durable storage as confirmation', async () => {
  h.get.mockResolvedValue('{corrupt');
  await expect(loadVisitSignatureWriteVersion(scope)).rejects.toThrow();
  h.set.mockRejectedValue(new Error('storage unavailable'));
  await expect(storeVisitSignatureWriteVersion(scope, version)).rejects.toThrow('storage unavailable');
});
it('bounds stalled native storage reads and writes', async () => {
  vi.useFakeTimers(); h.set.mockImplementation(() => new Promise(() => {}));
  const saving = expect(storeVisitSignatureWriteVersion(scope, version)).rejects.toThrow('signatureWriteVersionSave');
  await vi.advanceTimersByTimeAsync(2_000); await saving;
  h.get.mockImplementation(() => new Promise(() => {}));
  const reading = expect(loadVisitSignatureWriteVersion(scope)).rejects.toThrow('signatureWriteVersionRead');
  await vi.advanceTimersByTimeAsync(2_000); await reading;
});

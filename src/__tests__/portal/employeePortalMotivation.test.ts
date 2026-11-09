import { describe, expect, it, vi } from 'vitest';
import {
  employeePortalMotivationAt, employeePortalMotivationCount, nextEmployeePortalMotivation,
} from '@/lib/portal/employee/employeePortalMotivation';

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  get: vi.fn(async (key: string) => storage.values.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => { storage.values.set(key, value); }),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: storage.get, setItem: storage.set } }));

describe('employee portal motivation', () => {
  it('visits every sentence once without returning to the beginning', () => {
    const texts = Array.from({ length: employeePortalMotivationCount }, (_, index) => employeePortalMotivationAt(index));
    expect(texts).not.toContain(null);
    expect(new Set(texts).size).toBe(employeePortalMotivationCount);
    expect(employeePortalMotivationAt(employeePortalMotivationCount)).toBeNull();
  });

  it('continues the same account history after the app is loaded again', async () => {
    const owner = 'tenant-a/account-reload';
    expect(await nextEmployeePortalMotivation(owner)).toBe(employeePortalMotivationAt(0, owner));
    vi.resetModules();
    const restarted = await import('@/lib/portal/employee/employeePortalMotivation');
    expect(await restarted.nextEmployeePortalMotivation(owner)).toBe(employeePortalMotivationAt(1, owner));
    const other = 'tenant-a/other-account';
    expect(await restarted.nextEmployeePortalMotivation(other)).toBe(employeePortalMotivationAt(0, other));
  });

  it('assigns distinct sentences to simultaneous refresh requests', async () => {
    const owner = 'tenant-b/account-concurrent';
    const notes = await Promise.all(Array.from({ length: 48 }, () => nextEmployeePortalMotivation(owner)));
    expect(notes).toEqual(Array.from({ length: 48 }, (_, index) => employeePortalMotivationAt(index, owner)));
  });

  it('keeps advancing in the current session if one storage write fails', async () => {
    const owner = 'tenant-b/account-offline';
    storage.set.mockRejectedValueOnce(new Error('Storage temporarily unavailable'));
    expect(await nextEmployeePortalMotivation(owner)).toBe(employeePortalMotivationAt(0, owner));
    expect(await nextEmployeePortalMotivation(owner)).toBe(employeePortalMotivationAt(1, owner));
  });
});

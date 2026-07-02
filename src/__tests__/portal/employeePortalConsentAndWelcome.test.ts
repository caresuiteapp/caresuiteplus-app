import { describe, expect, it, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPortalWelcomePending,
  hydratePortalWelcomePending,
  isPortalWelcomeSeen,
  markPortalWelcomePending,
  markPortalWelcomeSeen,
} from '@/lib/auth/portalWelcomeSession';
import {
  applyEmployeePortalLocationConsent,
  getEmployeePortalLocationConsent,
  grantEmployeePortalLocationConsent,
} from '@/lib/portal/employeePortalVisitTrackingService';

const asyncStorageMock = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStorageMock.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStorageMock.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      asyncStorageMock.delete(key);
    }),
  },
}));

describe('portalWelcomeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorageMock.clear();
    clearPortalWelcomePending();
  });

  it('persists seen state per account and clears pending', async () => {
    markPortalWelcomePending('employee');
    await markPortalWelcomeSeen('employee', 'acc-1');
    expect(await hydratePortalWelcomePending()).toBeNull();
    expect(await isPortalWelcomeSeen('employee', 'acc-1')).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});

describe('employee portal location consent store', () => {
  const tenantId = 'tenant-a';
  const assignmentId = 'visit-a';

  it('hydrates granted consent into assignment scope', () => {
    const applied = applyEmployeePortalLocationConsent(tenantId, assignmentId, {
      granted: true,
      grantedAt: '2026-07-02T10:00:00.000Z',
      explainedAt: '2026-07-02T10:00:00.000Z',
    });
    expect(applied.granted).toBe(true);
    expect(getEmployeePortalLocationConsent(tenantId, assignmentId).granted).toBe(true);
  });

  it('keeps consent after reload-style re-read', () => {
    grantEmployeePortalLocationConsent(tenantId, assignmentId);
    const reread = getEmployeePortalLocationConsent(tenantId, assignmentId);
    expect(reread.granted).toBe(true);
    expect(reread.grantedAt).toBeTruthy();
  });
});

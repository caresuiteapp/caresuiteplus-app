import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  resetWfmAssistAdapterState,
  syncAssistTimeEventToWfm,
} from '@/lib/wfm/wfmAssistAdapter';
import { resetWfmDemoStore } from '@/lib/wfm';

const TENANT = DEMO_TENANT_ID;
const EMPLOYEE = 'employee-wfm-fk-test';
const AUTH_USER = 'auth-user-wfm-fk-test';

const insertWorkSessionMock = vi.fn(async (input: { userId: string | null; employeeId: string }) => ({
  ok: true as const,
  data: {
    id: 'session-1',
    tenantId: TENANT,
    employeeId: input.employeeId,
    userId: input.userId,
    workDate: '2026-07-02',
    status: 'on_visit' as const,
    workMode: 'field' as const,
    displayStatus: 'im_einsatz' as const,
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastEventAt: new Date().toISOString(),
    grossMinutes: 0,
    netMinutes: 0,
    pauseMinutes: 0,
    isOnline: true,
  },
}));

const insertTimeEventMock = vi.fn(async () => ({ ok: true as const, data: { id: 'evt-1' } }));

const resolveAuthUserIdMock = vi.fn(async (_tenantId: string, employeeId: string, candidate?: string | null) => {
  if (candidate && candidate !== employeeId) return candidate;
  return null;
});

vi.mock('@/lib/wfm/wfmWorkSessionRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wfm/wfmWorkSessionRepository')>();
  return {
    ...actual,
    resolveAuthUserIdForWfmSession: (...args: Parameters<typeof resolveAuthUserIdMock>) =>
      resolveAuthUserIdMock(...args),
    fetchSessionForDate: vi.fn(async () => ({ ok: true as const, data: null })),
    hasAssistWfmEvent: vi.fn(async () => false),
    insertWorkSession: (...args: Parameters<typeof insertWorkSessionMock>) => insertWorkSessionMock(...args),
    insertTimeEvent: (...args: Parameters<typeof insertTimeEventMock>) => insertTimeEventMock(...args),
    updateWorkSession: vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
      ok: true as const,
      data: { id: 'session-1', ...patch },
    })),
  };
});

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  resetWfmDemoStore();
  resetWfmAssistAdapterState();
  insertWorkSessionMock.mockClear();
  insertTimeEventMock.mockClear();
  resolveAuthUserIdMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmAssistAdapter auth user FK safety', () => {
  it('writes resolved auth user id, never employeeId as user_id', async () => {
    resolveAuthUserIdMock.mockResolvedValueOnce(AUTH_USER);

    const result = await syncAssistTimeEventToWfm(
      TENANT,
      EMPLOYEE,
      EMPLOYEE,
      'visit-fk-1',
      'service_start',
    );

    expect(result.ok).toBe(true);
    expect(resolveAuthUserIdMock).toHaveBeenCalledWith(TENANT, EMPLOYEE, EMPLOYEE);
    expect(insertWorkSessionMock).toHaveBeenCalled();
    const sessionInput = insertWorkSessionMock.mock.calls[0]?.[0];
    expect(sessionInput?.userId).toBe(AUTH_USER);
    expect(sessionInput?.userId).not.toBe(EMPLOYEE);
  });

  it('allows null user_id when no auth mapping exists', async () => {
    resolveAuthUserIdMock.mockResolvedValueOnce(null);

    const result = await syncAssistTimeEventToWfm(
      TENANT,
      EMPLOYEE,
      null,
      'visit-fk-2',
      'service_start',
    );

    expect(result.ok).toBe(true);
    const sessionInput = insertWorkSessionMock.mock.calls[0]?.[0];
    expect(sessionInput?.userId).toBeNull();
  });

  it('uses valid profileId when distinct from employeeId', async () => {
    resolveAuthUserIdMock.mockResolvedValueOnce(AUTH_USER);

    await syncAssistTimeEventToWfm(TENANT, EMPLOYEE, AUTH_USER, 'visit-fk-3', 'service_start');

    expect(resolveAuthUserIdMock).toHaveBeenCalledWith(TENANT, EMPLOYEE, AUTH_USER);
    const sessionInput = insertWorkSessionMock.mock.calls[0]?.[0];
    expect(sessionInput?.userId).toBe(AUTH_USER);
  });
});

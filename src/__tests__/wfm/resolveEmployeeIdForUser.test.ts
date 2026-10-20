import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveEmployeeIdForUser } from '@/lib/wfm/wfmWorkSessionRepository';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EMPLOYEE_KNOWN = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const EMPLOYEE_BUSINESS = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EMPLOYEE_PORTAL = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

function createChain(finalData: unknown = null, finalError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
  };
  return chain;
}

describe('resolveEmployeeIdForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns validated knownEmployeeId when tenant matches', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain({ id: EMPLOYEE_KNOWN });
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_A, USER, EMPLOYEE_KNOWN);
    expect(result).toEqual({ ok: true, data: EMPLOYEE_KNOWN });
    expect(mockFrom).toHaveBeenCalledWith('employees');
  });

  it('rejects knownEmployeeId from another tenant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain(null);
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_A, USER, EMPLOYEE_KNOWN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Portalzugang');
  });

  it('resolves business user via employees.profile_id', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain({ id: EMPLOYEE_BUSINESS });
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_A, USER);
    expect(result).toEqual({ ok: true, data: EMPLOYEE_BUSINESS });
  });

  it('resolves portal-only user via employee_portal_accounts.auth_user_id', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain(null);
      }
      if (table === 'employee_portal_accounts') {
        return createChain({
          employee_id: EMPLOYEE_PORTAL,
          status: 'active',
          blocked_at: null,
        });
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_A, USER);
    expect(result).toEqual({ ok: true, data: EMPLOYEE_PORTAL });
  });

  it('ignores portal account from another tenant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain(null);
      }
      if (table === 'employee_portal_accounts') {
        return createChain(null);
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_B, USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Portalzugang');
  });

  it('returns friendly error when no employee link exists', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain(null);
      }
      if (table === 'employee_portal_accounts') {
        return createChain(null);
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_A, USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(
      'Ihr Portalzugang ist noch keinem Mitarbeiterprofil zugeordnet. Bitte wenden Sie sich an das Office.',
    );
  });

  it('returns friendly German error on Supabase failure', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain(null, { message: 'connection failed', code: 'PGRST000' });
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_A, USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^Datenbankfehler:/);
  });

  it('skips blocked portal accounts', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain(null);
      }
      if (table === 'employee_portal_accounts') {
        return createChain({
          employee_id: EMPLOYEE_PORTAL,
          status: 'blocked',
          blocked_at: null,
        });
      }
      return createChain();
    });

    const result = await resolveEmployeeIdForUser(TENANT_A, USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Portalzugang');
  });
});

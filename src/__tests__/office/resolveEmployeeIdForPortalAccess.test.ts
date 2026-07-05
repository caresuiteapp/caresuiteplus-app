import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockFetchPortalAccount = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table !== 'employees') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: mockMaybeSingle }),
            ilike: () => ({ maybeSingle: mockMaybeSingle }),
          }),
          ilike: () => ({ maybeSingle: mockMaybeSingle }),
        }),
      };
    },
  }),
}));

vi.mock('@/lib/access/accessManagementLiveRepository', () => ({
  fetchEmployeePortalAccountByEmployeeId: (...args: unknown[]) => mockFetchPortalAccount(...args),
}));

describe('resolveEmployeeIdForPortalAccess', () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockFetchPortalAccount.mockReset();
    mockFetchPortalAccount.mockResolvedValue({ ok: true, data: null });
  });

  it('rejects unknown personal numbers without hitting uuid cast errors', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { resolveEmployeeIdForPortalAccess } = await import(
      '@/lib/access/resolveEmployeeIdForPortalAccess'
    );

    const result = await resolveEmployeeIdForPortalAccess('tenant-1', 'CR-2110');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Mitarbeiter:in mit dieser Personalnummer wurde nicht gefunden.');
  });

  it('resolves employees by personal number', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: '8bde1b04-b18f-40f1-88b7-0b619313f676',
        first_name: 'Christian',
        last_name: 'Reinhardt',
        employee_number: 'M-1005',
      },
      error: null,
    });

    const { resolveEmployeeIdForPortalAccess } = await import(
      '@/lib/access/resolveEmployeeIdForPortalAccess'
    );

    const result = await resolveEmployeeIdForPortalAccess('tenant-1', 'M-1005');
    expect(result).toEqual({
      ok: true,
      data: {
        employeeId: '8bde1b04-b18f-40f1-88b7-0b619313f676',
        firstName: 'Christian',
        lastName: 'Reinhardt',
      },
    });
  });

  it('blocks duplicate portal accounts', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: '8bde1b04-b18f-40f1-88b7-0b619313f676',
        first_name: 'Christian',
        last_name: 'Reinhardt',
        employee_number: 'M-1005',
      },
      error: null,
    });
    mockFetchPortalAccount.mockResolvedValue({
      ok: true,
      data: { id: 'epa-existing' },
    });

    const { resolveEmployeeIdForPortalAccess } = await import(
      '@/lib/access/resolveEmployeeIdForPortalAccess'
    );

    const result = await resolveEmployeeIdForPortalAccess('tenant-1', 'M-1005');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Für diese:n Mitarbeiter:in existiert bereits ein Portalzugang.');
  });
});

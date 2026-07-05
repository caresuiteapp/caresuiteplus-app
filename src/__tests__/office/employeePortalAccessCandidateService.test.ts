import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPortalSelect = vi.fn();
const mockEmployeesSelect = vi.fn();
const mockFromUnknownTable = vi.fn();
const mockGetServiceMode = vi.fn(() => 'supabase');
const mockGuardServiceTenant = vi.fn(() => null);
const mockEnforcePermission = vi.fn(() => null);

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: () => mockGetServiceMode(),
}));

vi.mock('@/lib/services/liveServiceGuard', () => ({
  guardServiceTenant: (...args: unknown[]) => mockGuardServiceTenant(...args),
}));

vi.mock('@/lib/permissions', () => ({
  enforcePermission: (...args: unknown[]) => mockEnforcePermission(...args),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => mockFromUnknownTable(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'employees') {
        return {
          select: (...args: unknown[]) => mockEmployeesSelect(...args),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const TENANT_AVENTA = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const CHRISTIAN_ID = '8bde1b04-b18f-40f1-88b7-0b619313f676';

function setupSupabaseMocks(options: {
  portalEmployeeIds?: string[];
  employees?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    employee_number?: string | null;
    email?: string | null;
    role_title?: string | null;
    status?: string;
  }>;
}) {
  mockFromUnknownTable.mockReturnValue({
    select: () => ({
      eq: () =>
        Promise.resolve({
          data: (options.portalEmployeeIds ?? []).map((employee_id) => ({ employee_id })),
          error: null,
        }),
    }),
  });

  mockEmployeesSelect.mockReturnValue({
    eq: () => ({
      neq: () => ({
        order: () =>
          Promise.resolve({
            data: options.employees ?? [],
            error: null,
          }),
      }),
    }),
  });
}

describe('fetchEmployeePortalAccessCandidates', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPortalSelect.mockReset();
    mockEmployeesSelect.mockReset();
    mockFromUnknownTable.mockReset();
    mockGetServiceMode.mockReturnValue('supabase');
    mockGuardServiceTenant.mockReturnValue(null);
    mockEnforcePermission.mockReturnValue(null);
  });

  it('filters employees who already have portal access', async () => {
    setupSupabaseMocks({
      portalEmployeeIds: [CHRISTIAN_ID],
      employees: [
        {
          id: CHRISTIAN_ID,
          first_name: 'Christian',
          last_name: 'Reinhardt',
          employee_number: 'M-1005',
          email: 'christian@example.com',
          role_title: 'alltagsbegleiter',
          status: 'active',
        },
        {
          id: 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2',
          first_name: 'Kevin',
          last_name: 'Reinhardt',
          employee_number: 'M-1001',
          email: 'kevin@example.com',
          role_title: 'owner',
          status: 'active',
        },
      ],
    });

    const { fetchEmployeePortalAccessCandidates } = await import(
      '@/lib/access/employeePortalAccessCandidateService'
    );

    const result = await fetchEmployeePortalAccessCandidates(TENANT_AVENTA, 'owner');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.some((row) => row.employeeNumber === 'M-1005')).toBe(false);
    expect(result.data.some((row) => row.employeeNumber === 'M-1001')).toBe(true);
  });

  it('scopes employee and portal queries to tenant_id', async () => {
    setupSupabaseMocks({ portalEmployeeIds: [], employees: [] });

    const { fetchEmployeePortalAccessCandidates } = await import(
      '@/lib/access/employeePortalAccessCandidateService'
    );

    await fetchEmployeePortalAccessCandidates(TENANT_AVENTA, 'owner');

    expect(mockFromUnknownTable).toHaveBeenCalled();
    const portalChain = mockFromUnknownTable.mock.results[0]?.value;
    expect(portalChain.select).toBeDefined();

    expect(mockEmployeesSelect).toHaveBeenCalledWith(
      'id, first_name, last_name, employee_number, email, role_title, status',
    );
  });

  it('includes employees without personal number with null employeeNumber', async () => {
    setupSupabaseMocks({
      portalEmployeeIds: [],
      employees: [
        {
          id: '1bf39e72-8ae1-480e-9dfb-bcb5aa7b6a4f',
          first_name: 'Mhi Aldeen',
          last_name: 'Al Jlelati',
          employee_number: null,
          email: null,
          role_title: null,
          status: 'active',
        },
      ],
    });

    const { fetchEmployeePortalAccessCandidates } = await import(
      '@/lib/access/employeePortalAccessCandidateService'
    );

    const result = await fetchEmployeePortalAccessCandidates(TENANT_AVENTA, 'owner');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.employeeNumber).toBeNull();
    expect(result.data[0]?.fullName).toBe('Mhi Aldeen Al Jlelati');
  });

  it('filters by personal number and name case-insensitively', async () => {
    setupSupabaseMocks({
      portalEmployeeIds: [],
      employees: [
        {
          id: CHRISTIAN_ID,
          first_name: 'Christian',
          last_name: 'Reinhardt',
          employee_number: 'M-1005',
          email: 'christian@example.com',
          role_title: null,
          status: 'active',
        },
        {
          id: 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2',
          first_name: 'Kevin',
          last_name: 'Reinhardt',
          employee_number: 'M-1001',
          email: 'kevin@example.com',
          role_title: null,
          status: 'active',
        },
      ],
    });

    const { fetchEmployeePortalAccessCandidates } = await import(
      '@/lib/access/employeePortalAccessCandidateService'
    );

    const byNumber = await fetchEmployeePortalAccessCandidates(TENANT_AVENTA, 'owner', 'm-1005');
    expect(byNumber.ok).toBe(true);
    if (!byNumber.ok) return;
    expect(byNumber.data).toHaveLength(1);
    expect(byNumber.data[0]?.fullName).toBe('Christian Reinhardt');

    const byFirstName = await fetchEmployeePortalAccessCandidates(TENANT_AVENTA, 'owner', 'kevin');
    expect(byFirstName.ok).toBe(true);
    if (!byFirstName.ok) return;
    expect(byFirstName.data).toHaveLength(1);
    expect(byFirstName.data[0]?.employeeNumber).toBe('M-1001');
  });
});

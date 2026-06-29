import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: vi.fn(() => 'supabase'),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
    storage: { from: vi.fn() },
  })),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: vi.fn(),
}));

import { setEmployeeRoleAssignments } from '@/lib/permissions/rbacService';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

const TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const EMPLOYEE = '1bf39e72-8ae1-480e-9dfb-bcb5aa7b6a4f';

describe('employee personnel production repairs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServiceMode).mockReturnValue('supabase');
  });

  it('speichert Rollenzuweisungen ohne Demo-Template-UUID in role_template_id', async () => {
    const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
    const deleteBuilder = { delete: vi.fn().mockReturnValue({ eq: deleteEq1 }) };

    const insertedRows: Record<string, unknown>[] = [];
    const insertSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    const insertBuilder = {
      insert: vi.fn((rows: Record<string, unknown>[]) => {
        insertedRows.push(...rows);
        return { select: insertSelect };
      }),
    };

    vi.mocked(fromUnknownTable).mockImplementation((_client, table) => {
      if (table === 'employee_role_assignments') {
        return {
          delete: deleteBuilder.delete,
          insert: insertBuilder.insert,
        } as never;
      }
      return {} as never;
    });

    vi.mocked(getSupabaseClient).mockReturnValue({} as never);

    const result = await setEmployeeRoleAssignments(
      TENANT,
      EMPLOYEE,
      ['employee_portal'],
      'employee_portal',
    );

    expect(result.ok).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.role_template_id).toBeNull();
    expect(insertedRows[0]?.role_key).toBe('employee_portal');
  });
});

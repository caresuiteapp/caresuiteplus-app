import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/0256_wfm_absence_portal_atomic_workflow.sql'),
  'utf8',
);

describe('WFM absence portal database workflow', () => {
  it('resolves the employee within the explicitly requested tenant', () => {
    expect(migration).toContain('resolve_employee_id_for_tenant');
    expect(migration).toContain('epa.tenant_id = p_tenant_id');
    expect(migration).toContain("epa.status IN ('active', 'pending_first_login')");
  });

  it('creates absence and approval atomically', () => {
    expect(migration).toContain('employee_portal_request_wfm_absence');
    expect(migration).toContain('INSERT INTO public.workforce_absences');
    expect(migration).toContain('INSERT INTO public.workforce_approvals');
  });

  it('withdraws only an own requested absence and cancels its approval', () => {
    expect(migration).toContain('employee_portal_withdraw_wfm_absence');
    expect(migration).toContain("AND status = 'requested'");
    expect(migration).toContain("SET status = 'cancelled'");
  });
});

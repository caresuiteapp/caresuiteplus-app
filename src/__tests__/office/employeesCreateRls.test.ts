import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = path.join(__dirname, '..', '..');

describe('employees create RLS (migration 0076)', () => {
  it('erlaubt INSERT/UPDATE über has_permission ohne is_tenant_admin-only Gate', () => {
    const migration = readFileSync(
      path.join(srcRoot, '..', 'supabase', 'migrations', '0076_employees_create_rls_live.sql'),
      'utf8',
    );

    expect(migration).toContain('employees_insert_tenant');
    expect(migration).toContain("has_permission('office.employees.create')");
    expect(migration).toContain('employees_update_tenant');
    expect(migration).toContain("has_permission('office.employees.edit')");
    expect(migration).toContain("p.status IN ('active', 'invited')");
    expect(migration).toContain('split_part(p_permission_key');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated');
  });
});

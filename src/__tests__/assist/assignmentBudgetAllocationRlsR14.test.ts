import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260807130000_assignment_budget_allocation_rls_repair.sql',
  'utf8',
);

describe('R14 assignment budget allocation RLS repair', () => {
  it('binds every allocation read and write to the current tenant', () => {
    expect(migration.match(/tenant_id = public\.current_tenant_id\(\)/g)).toHaveLength(2);
  });

  it('allows the dedicated automatic allocation permission on insert', () => {
    expect(migration).toContain("public.has_permission('assist.assignment.budget.auto_allocate')");
    expect(migration).toContain("public.has_permission('assist.assignments.manage')");
  });

  it('keeps budget and client editing roles compatible', () => {
    expect(migration).toContain("public.has_permission('clients.budgets.edit')");
    expect(migration).toContain("public.has_permission('clients.billing_profile.edit')");
    expect(migration).toContain("public.has_permission('office.clients.edit')");
  });

  it('backfills the automatic allocation permission for existing operational roles', () => {
    expect(migration).toContain("'business_admin'");
    expect(migration).toContain("'business_manager'");
    expect(migration).toContain("'billing'");
    expect(migration).toContain("'dispatch'");
    expect(migration).toContain("'nurse'");
    expect(migration).toContain('ON CONFLICT DO NOTHING');
  });
});

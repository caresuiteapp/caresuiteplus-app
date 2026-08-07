import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260807170000_assist_budget_reservation_rls_repair.sql',
  'utf8',
);

describe('R18 automatic assist budget reservation RLS repair', () => {
  it('repairs the complete reservation chain after assignment allocation', () => {
    expect(migration).toContain('ON public.client_budget_accounts');
    expect(migration).toContain('ON public.client_billing_priority_rules');
    expect(migration).toContain('ON public.client_budget_transactions');
  });

  it('authorizes the dedicated automatic allocation permission', () => {
    expect(migration).toContain(
      "public.has_permission('assist.assignment.budget.auto_allocate')",
    );
  });

  it('keeps every repaired read and write bound to the current tenant', () => {
    expect(migration.match(/tenant_id = public\.current_tenant_id\(\)/g)).toHaveLength(7);
  });

  it('preserves the existing explicit billing and client permissions', () => {
    expect(migration).toContain("public.has_permission('clients.billing_profile.view')");
    expect(migration).toContain("public.has_permission('clients.billing_profile.edit')");
    expect(migration).toContain("public.has_permission('clients.budgets.edit')");
    expect(migration).toContain("public.has_permission('office.clients.view')");
    expect(migration).toContain("public.has_permission('office.clients.edit')");
  });
});

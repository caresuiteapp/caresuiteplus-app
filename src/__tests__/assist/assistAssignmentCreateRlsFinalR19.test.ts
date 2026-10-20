import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260808060000_assist_assignment_create_rls_final.sql',
  'utf8',
);

describe('R19 vollständige RLS-Kette der Einsatzanlage', () => {
  it('deckt Einsatz, Aufgaben, Portalspiegel und Budgettabellen ab', () => {
    for (const table of [
      'assist_visits',
      'assist_visit_tasks',
      'assignments',
      'assignment_tasks',
      'assignment_budget_allocations',
      'client_budget_accounts',
      'client_billing_priority_rules',
      'client_budget_transactions',
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
  });

  it('bindet jede erneuerte Budgetpolicy an Mandant und internen Akteur', () => {
    expect(migration.match(/tenant_id = public\.current_tenant_id\(\)/g)?.length).toBeGreaterThanOrEqual(8);
    expect(migration.match(/public\.is_internal_tenant_actor\(tenant_id\)/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it('autorisiert Einsatzplanung und alle produktiven Verwaltungsrollen', () => {
    expect(migration).toContain("public.has_permission('assist.assignments.manage')");
    for (const role of ['owner', 'admin', 'management', 'office', 'planning', 'business_admin']) {
      expect(migration).toContain(`'${role}'`);
    }
    expect(migration).toContain('AND NOT EXISTS (');
    expect(migration).not.toContain('business_admin auto allocation permission missing');
  });

  it('schaltet RLS nicht ab und bleibt ohne Fachdatenlöschung', () => {
    expect(migration).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});

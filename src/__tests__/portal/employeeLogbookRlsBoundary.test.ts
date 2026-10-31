import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '10000000-0000-4000-8000-000000000002';
const employeeA = '20000000-0000-4000-8000-000000000001';
const employeeB = '20000000-0000-4000-8000-000000000002';
const employeeC = '20000000-0000-4000-8000-000000000003';
let db: PGlite;
let originalClientRowCount = 0;
const additionalTables = ["employee_logbook_daily_confirmations","employee_logbook_profiles","employee_logbook_prompt_decisions","employee_logbook_receipts","employee_logbook_segments","employee_logbook_trips","employee_logbook_vehicles","employee_logbook_points"] as const;

async function actor(role: string, options: { tenant?: string; employee?: string; active?: boolean; member?: boolean } = {}) {
  await db.exec('reset role');
  await db.query(`select set_config('audit.role', $1, false), set_config('audit.tenant', $2, false),
    set_config('audit.employee', $3, false), set_config('audit.active', $4, false),
    set_config('audit.member', $5, false)`, [role, options.tenant ?? tenantA, options.employee ?? employeeA, String(options.active ?? false), String(options.member ?? true)]);
  await db.exec('set role authenticated');
}
async function visible(table: 'employee_visit_mobility_selections' | 'employee_location_consents' | typeof additionalTables[number] | 'employee_logbook_audit_events') {
  return (await db.query<{ count: number }>(`select count(*)::int as count from public.${table}`)).rows[0].count;
}

describe('employee logbook and consent PostgreSQL role boundaries', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role authenticated;
      create function public.current_role_key() returns text language sql stable as
        $$select nullif(current_setting('audit.role', true), '')$$;
      create function public.current_tenant_id() returns uuid language sql stable as
        $$select nullif(current_setting('audit.tenant', true), '')::uuid$$;
      create function public.resolve_current_employee_id() returns uuid language sql stable as
        $$select nullif(current_setting('audit.employee', true), '')::uuid$$;
      create function public.is_employee_portal_rls_context(p_tenant uuid default null) returns boolean language sql stable as
        $$select coalesce(public.current_role_key() = 'employee_portal'
          and current_setting('audit.active', true)::boolean and p_tenant = public.current_tenant_id(), false)$$;
      create function public.is_tenant_member(p_tenant uuid) returns boolean language sql stable as
        $$select coalesce(current_setting('audit.member', true)::boolean and p_tenant = public.current_tenant_id(), false)$$;
      create function public.employee_logbook_own_employee(p_tenant uuid, p_employee uuid)
        returns boolean language sql stable security definer set search_path = public as
        $$select p_tenant = public.current_tenant_id() and
          (not public.is_employee_portal_rls_context(p_tenant) or p_employee = public.resolve_current_employee_id())$$;
      create table public.employee_visit_mobility_selections(tenant_id uuid, employee_id uuid, marker text);
      create table public.employee_location_consents(tenant_id uuid, employee_id uuid);
      insert into public.employee_visit_mobility_selections values
        ('${tenantA}', '${employeeA}', 'a'), ('${tenantA}', '${employeeB}', 'b'), ('${tenantB}', '${employeeC}', 'c');
      insert into public.employee_location_consents select tenant_id, employee_id from public.employee_visit_mobility_selections;
      alter table public.employee_visit_mobility_selections enable row level security;
      alter table public.employee_location_consents enable row level security;
      grant usage on schema public to authenticated;
      grant select, insert, update, delete on public.employee_visit_mobility_selections, public.employee_location_consents to authenticated;
      create policy employee_visit_mobility_write on public.employee_visit_mobility_selections for all to authenticated
        using (public.employee_logbook_own_employee(tenant_id, employee_id))
        with check (public.employee_logbook_own_employee(tenant_id, employee_id));
      create policy employee_location_consents_office_assist_select on public.employee_location_consents for select to authenticated
        using (tenant_id = public.current_tenant_id() and public.is_tenant_member(tenant_id)
          and public.current_role_key() <> 'employee_portal' and public.current_role_key() <> 'client_portal');
      create policy employee_location_consents_portal_employee_all on public.employee_location_consents for all to authenticated
        using (tenant_id = public.current_tenant_id() and public.is_employee_portal_rls_context(tenant_id) and employee_id = public.resolve_current_employee_id())
        with check (tenant_id = public.current_tenant_id() and public.is_employee_portal_rls_context(tenant_id) and employee_id = public.resolve_current_employee_id());
    `);
    // Adversarial legacy fixtures keep direct permissive Office branches:
    // a helper-only patch must not be enough for these tables.
    for (const table of additionalTables) {
      await db.exec(`
        create table public.${table}(tenant_id uuid, employee_id uuid, marker text);
        insert into public.${table} values
          ('${tenantA}', '${employeeA}', 'a'), ('${tenantA}', '${employeeB}', 'b'), ('${tenantB}', '${employeeC}', 'c');
        alter table public.${table} enable row level security;
        grant select, insert, update, delete on public.${table} to authenticated;
        create policy legacy_employee_read on public.${table} for select to authenticated
          using (public.employee_logbook_own_employee(tenant_id, employee_id));
        create policy legacy_office_branch on public.${table} for all to authenticated
          using (tenant_id = public.current_tenant_id() and not public.is_employee_portal_rls_context(tenant_id))
          with check (tenant_id = public.current_tenant_id() and not public.is_employee_portal_rls_context(tenant_id));
      `);
    }
    await db.exec(`
      insert into public.employee_logbook_vehicles values ('${tenantA}', null, 'company');
      create table public.employee_logbook_audit_events(tenant_id uuid, marker text);
      insert into public.employee_logbook_audit_events values ('${tenantA}', 'internal'), ('${tenantB}', 'foreign');
      alter table public.employee_logbook_audit_events enable row level security;
      grant select, insert, update, delete on public.employee_logbook_audit_events to authenticated;
      create policy legacy_internal_read on public.employee_logbook_audit_events for select to authenticated
        using (tenant_id = public.current_tenant_id() and not public.is_employee_portal_rls_context(tenant_id));
    `);
    await actor('client_portal');
    originalClientRowCount = await visible('employee_visit_mobility_selections');
    await db.exec('reset role');
    await db.exec(readFileSync(join(process.cwd(), 'supabase/patches/employee_logbook_portal_role_boundary.sql'), 'utf8'));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('reproduces the original cross-role access against actual RLS before installing the patch', () => {
    expect(originalClientRowCount).toBe(2);
  });
  it.each(['client_portal', 'family_portal'])('denies %s employee mobility and consent reads', async (role) => {
    await actor(role);
    expect(await visible('employee_visit_mobility_selections')).toBe(0);
    expect(await visible('employee_location_consents')).toBe(0);
  });
  it.each(['client_portal', 'family_portal'])('denies %s updates and inserts', async (role) => {
    await actor(role);
    expect((await db.query("update public.employee_visit_mobility_selections set marker = 'unauthorized' returning employee_id")).rows).toHaveLength(0);
    await expect(db.query('insert into public.employee_visit_mobility_selections values ($1,$2,$3)', [tenantA, employeeA, 'unauthorized'])).rejects.toThrow(/row.level security/i);
  });
  it('does not treat a disabled employee portal session as a business account', async () => {
    await actor('employee_portal', { active: false, member: true });
    expect(await visible('employee_visit_mobility_selections')).toBe(0);
    expect(await visible('employee_location_consents')).toBe(0);
  });
  it('allows the active employee to read only their own rows', async () => {
    await actor('employee_portal', { active: true });
    expect(await visible('employee_visit_mobility_selections')).toBe(1);
    expect(await visible('employee_location_consents')).toBe(1);
  });
  it('allows an own update and denies reassignment to another employee or tenant', async () => {
    await actor('employee_portal', { active: true });
    expect((await db.query("update public.employee_visit_mobility_selections set marker = 'own' returning employee_id")).rows).toHaveLength(1);
    await expect(db.query('update public.employee_visit_mobility_selections set employee_id = $1', [employeeB])).rejects.toThrow(/row.level security/i);
    await expect(db.query('insert into public.employee_visit_mobility_selections values ($1,$2,$3)', [tenantB, employeeA, 'foreign'])).rejects.toThrow(/row.level security/i);
  });
  it('retains authenticated business membership access within the current tenant', async () => {
    await actor('office', { member: true });
    expect(await visible('employee_visit_mobility_selections')).toBe(2);
    expect(await visible('employee_location_consents')).toBe(2);
  });
  it.each(additionalTables)('restricts direct legacy read/write policies on %s for every portal role', async (table) => {
    for (const role of ['client_portal', 'family_portal', 'employee_portal']) {
      await actor(role, { active: false, member: true });
      expect(await visible(table)).toBe(0);
      expect((await db.query(`update public.${table} set marker = 'blocked' returning employee_id`)).rows).toHaveLength(0);
      expect((await db.query(`delete from public.${table} returning employee_id`)).rows).toHaveLength(0);
      await expect(db.query(`insert into public.${table} values ($1,$2,$3)`, [tenantA, employeeA, 'blocked'])).rejects.toThrow(/row.level security/i);
    }
    await actor('employee_portal', { active: true });
    expect(await visible(table)).toBe(1);
    await actor('office', { member: true });
    expect(await visible(table)).toBe(table === 'employee_logbook_vehicles' ? 3 : 2);
  });
  it('preserves company vehicles without a personal employee assignment for business members', async () => {
    await actor('office', { member: true });
    expect((await db.query("select marker from public.employee_logbook_vehicles where employee_id is null")).rows).toEqual([{ marker: 'company' }]);
    expect((await db.query<{ allowed: boolean }>('select public.employee_logbook_own_employee($1, null) as allowed', [tenantA])).rows[0].allowed).toBe(true);
  });
  it('keeps internal logbook audit events business-only', async () => {
    for (const role of ['client_portal', 'family_portal', 'employee_portal']) {
      await actor(role, { active: true });
      expect(await visible('employee_logbook_audit_events')).toBe(0);
    }
    await actor('office', { member: true });
    expect(await visible('employee_logbook_audit_events')).toBe(1);
    await actor('office', { member: false });
    expect(await visible('employee_logbook_audit_events')).toBe(0);
  });
  it('denies a business account without membership and an unresolved role', async () => {
    await actor('office', { member: false });
    expect(await visible('employee_visit_mobility_selections')).toBe(0);
    expect(await visible('employee_location_consents')).toBe(0);
    await actor('', { member: true });
    expect(await visible('employee_visit_mobility_selections')).toBe(0);
    expect(await visible('employee_location_consents')).toBe(0);
  });
});

import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tenant = '10000000-0000-4000-8000-000000000001';
const foreign = '10000000-0000-4000-8000-000000000002';
const employee = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const tables = [
  ['employee_expense_claims', 'payroll_expenses_select', ['office.employees.view']],
  ['payroll_month_statements', 'payroll_statements_select', ['office.employees.view']],
  ['workforce_work_sessions', 'wfm_sessions_select', ['time.tracking.team.view', 'time.tracking.admin.view']],
  ['workforce_time_events', 'wfm_events_select', ['time.tracking.team.view', 'time.tracking.admin.view', 'time.audit.view']],
  ['workforce_time_entry_reviews', 'wfm_entry_reviews_select', ['time.tracking.team.view', 'time.tracking.admin.view', 'time.audit.view']],
  ['workforce_time_accounts', 'wfm_accounts_select', ['time.tracking.team.view', 'time.tracking.admin.view']],
] as const;
let db: PGlite;

async function actor(permissions: string, employeeId = '', tenantId = tenant, admin = false) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.tenant',$1,false),set_config('test.employee',$2,false),set_config('test.permissions',$3,false),set_config('test.admin',$4,false)", [tenantId, employeeId, permissions, String(admin)]);
  await db.exec('SET ROLE authenticated');
}
async function counts() {
  return Promise.all(tables.map(async ([table]) => (await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM public.${table}`)).rows[0].count));
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
    CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.employee',true),'')::uuid$$;
    CREATE FUNCTION public.has_permission(p text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT p=ANY(string_to_array(current_setting('test.permissions',true),','))$$;
    CREATE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.admin',true)::boolean$$;`);
  for (const [table, policy, permissions] of tables) {
    await db.exec(`CREATE TABLE public.${table}(id int,tenant_id uuid,employee_id uuid);
      INSERT INTO public.${table} SELECT n,'${tenant}',CASE WHEN n<=1000 THEN '${employee}'::uuid ELSE '${other}'::uuid END FROM generate_series(1,2000) n;
      INSERT INTO public.${table} VALUES(2001,'${foreign}','${employee}');
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,UPDATE ON public.${table} TO authenticated;
      CREATE POLICY ${policy} ON public.${table} FOR SELECT TO authenticated USING (
        tenant_id=public.current_tenant_id() AND (employee_id=public.resolve_current_employee_id()
        OR ${permissions.map(key => `public.has_permission('${key}')`).join(' OR ')} OR public.is_tenant_admin()));`);
  }
}, 30_000);
afterAll(async () => { await db?.close(); });

describe('payroll source revision read-policy execution', () => {
  it('preserves own-employee, staff, audit, admin and foreign-tenant visibility', async () => {
    const scenarios = [
      ['office.employees.view,time.tracking.team.view', '', tenant, false],
      ['', employee, tenant, false], ['time.audit.view', '', tenant, false], ['', '', tenant, false],
      ['', '', tenant, true], ['office.employees.view,time.tracking.team.view', '', foreign, false],
    ] as const;
    const before: number[][] = [];
    for (const [permissions, id, scope, admin] of scenarios) { await actor(permissions, id, scope, admin); before.push(await counts()); }
    expect(before).toEqual([[2000,2000,2000,2000,2000,2000],[1000,1000,1000,1000,1000,1000],
      [0,0,0,2000,2000,0],[0,0,0,0,0,0],[2000,2000,2000,2000,2000,2000],[1,1,1,1,1,1]]);
    await db.exec('RESET ROLE');
    await db.exec(readFileSync('supabase/patches/payroll_source_revision_auth_initplans.sql', 'utf8'));
    for (const [index, [permissions, id, scope, admin]] of scenarios.entries()) {
      await actor(permissions, id, scope, admin); expect(await counts()).toEqual(before[index]);
    }
    await actor('office.employees.view,time.tracking.team.view');
    expect((await db.query('UPDATE public.employee_expense_claims SET id=id RETURNING id')).rows).toEqual([]);
    await db.exec('SET ROLE anon');
    await expect(db.query('SELECT * FROM public.employee_expense_claims')).rejects.toMatchObject({ code: '42501' });
  });

  it('runs authentication initplans at most once for 2,000 rows and refreshes them on the next statement', async () => {
    await actor('time.tracking.team.view');
    type Plan = { 'Subplan Name'?: string; 'Actual Loops'?: number; Plans?: Plan[] };
    const result = await db.query<{ 'QUERY PLAN': { Plan: Plan }[] }>('EXPLAIN (ANALYZE,FORMAT JSON) SELECT count(*) FROM public.workforce_time_events');
    const initplans: Plan[] = [];
    const walk = (plan: Plan) => { if (plan['Subplan Name']?.startsWith('InitPlan')) initplans.push(plan); plan.Plans?.forEach(walk); };
    walk(result.rows[0]['QUERY PLAN'][0].Plan);
    expect(initplans.length).toBeGreaterThan(2);
    expect(initplans.every(plan => (plan['Actual Loops'] ?? 0) <= 1)).toBe(true);
    await actor(''); expect(await counts()).toEqual([0,0,0,0,0,0]);
  });
});

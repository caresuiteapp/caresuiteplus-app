import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PERMISSION_LABELS, ROLE_PERMISSIONS } from '@/lib/permissions/staticRolePermissions';

const patch = readFileSync('supabase/patches/pflege_owner_permission_tenant_repair.sql', 'utf8');
const tenant = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
const foreignOwner = '44444444-4444-4444-8444-444444444444';
const staff = '55555555-5555-4555-8555-555555555555';
const expected = Object.keys(PERMISSION_LABELS).filter(key => key.startsWith('pflege.')).sort();
// Retained independently from the inspected live data, never parsed from the repair.
const legacy = [
  'pflege.acceptance.manage', 'pflege.audit.view', 'pflege.billing.release', 'pflege.billing.view',
  'pflege.deviations.manage', 'pflege.deviations.view', 'pflege.diagnoses.manage', 'pflege.diagnoses.view',
  'pflege.evaluations.manage', 'pflege.evaluations.view', 'pflege.invoices.manage', 'pflege.md.readiness',
  'pflege.measures.review', 'pflege.orders.manage', 'pflege.orders.view', 'pflege.plans.manage', 'pflege.plans.view',
  'pflege.proofs.create', 'pflege.proofs.review', 'pflege.proofs.sign', 'pflege.proofs.view', 'pflege.quality.view',
  'pflege.risks.manage', 'pflege.risks.view', 'pflege.visits.manage', 'pflege.visits.view',
];
let db: PGlite;
const rows = async <T extends Record<string, unknown>>(sql: string, values?: unknown[]) => (await db.query<T>(sql, values)).rows;
async function snapshot() {
  return (await rows<{ value: unknown }>(`select jsonb_build_object(
    'roles',(select jsonb_agg(to_jsonb(r) order by id) from roles r),
    'profiles',(select jsonb_agg(to_jsonb(p) order by id) from profiles p),
    'grants',(select jsonb_agg(to_jsonb(p) order by id) from role_permissions p),
    'replacements',(select jsonb_agg(to_jsonb(p) order by id) from role_permission_sets p),
    'catalog',(select jsonb_agg(to_jsonb(c) order by key) from permission_catalog c),
    'rowAudit',(select jsonb_agg(to_jsonb(a) order by id) from fixture_row_audit a),
    'maintenanceAudit',(select jsonb_agg(to_jsonb(a) order by id) from permission_audit_log a)
  ) value`))[0].value;
}
async function repair(target: string | null = tenant) {
  await db.exec('begin');
  try {
    if (target !== null) await db.query("select set_config('caresuite.pflege_permission_repair_tenant',$1,true)", [target]);
    await db.exec(patch);
    await db.exec('commit');
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
async function visibleGrants(target = owner) {
  await db.query("select set_config('test.current_tenant',$1,false)", [tenant]);
  await db.exec('set role fixture_authenticated');
  try {
    return (await rows<{ permission_key: string }>('select permission_key from role_permissions where role_id=$1 and permission_key like $2 order by permission_key', [target, 'pflege.%'])).map(row => row.permission_key);
  } finally { await db.exec('reset role'); }
}
async function seedRole(id: string, target: string, key: string, permissions: string[], missingScope: string[] = []) {
  await db.query('insert into roles values($1,$2,$3,true,true,$4)', [id, target, key, ['office', 'pflege']]);
  await db.query("insert into profiles(role_id,tenant_id,is_active,status) values($1,$2,true,'active')", [id, target]);
  for (const key of permissions) {
    await db.query(`insert into role_permissions(tenant_id,role_id,permission_key,permission_name,restrictions,can_view,can_update)
      values($1,$2,$3,$4,$5,false,true)`, [missingScope.includes(key) ? null : target, id, key, `Saved ${key}`, { marker: 'retained' }]);
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table roles(id uuid primary key,tenant_id uuid,key text,is_admin_role boolean,can_manage_roles boolean,allowed_products text[]);
    create table profiles(id uuid primary key default gen_random_uuid(),role_id uuid references roles,tenant_id uuid,is_active boolean,status text);
    create table role_permissions(id uuid primary key default gen_random_uuid(),tenant_id uuid,role_id uuid references roles,
      permission_key text not null,permission_name text,product_key text,can_view boolean default false,can_create boolean default false,
      can_update boolean default false,can_delete boolean default false,can_export boolean default false,can_approve boolean default false,
      restrictions jsonb default '{}',created_at timestamptz default '2020-01-01',updated_at timestamptz default '2020-01-01',unique(role_id,permission_key));
    create table role_permission_sets(id uuid primary key default gen_random_uuid(),tenant_id uuid,role_key text,permission_key text);
    create table permission_catalog(key text primary key,module text,label text);
    create table permission_audit_log(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,actor_id uuid,actor_role text,
      action text not null,old_value jsonb,new_value jsonb,reason text,created_at timestamptz default now());
    create table fixture_row_audit(id uuid primary key default gen_random_uuid(),row_id uuid,old_value jsonb,new_value jsonb);
    create role fixture_authenticated;
    grant usage on schema public to fixture_authenticated;
    grant select on role_permissions to fixture_authenticated;
    alter table role_permissions enable row level security;
    create policy fixture_roles on role_permissions to fixture_authenticated using(tenant_id::text=current_setting('test.current_tenant',true));
    create function fixture_set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
    create trigger fixture_set_updated_at before update on role_permissions for each row execute function fixture_set_updated_at();
    create function fixture_row_audit() returns trigger language plpgsql as $$begin
      insert into fixture_row_audit(row_id,old_value,new_value) values(new.id,to_jsonb(old),to_jsonb(new));return new;end$$;
    create trigger fixture_row_audit after update on role_permissions for each row execute function fixture_row_audit();
    create function fixture_audit_failure() returns trigger language plpgsql as $$begin
      if current_setting('test.fail_audit',true)='true' then raise exception 'Synthetic audit failure';end if;return new;end$$;
    create trigger fixture_audit_failure before insert on permission_audit_log for each row execute function fixture_audit_failure();
  `);
}, 60000);
beforeEach(async () => {
  await db.exec("truncate permission_audit_log,fixture_row_audit,role_permission_sets,role_permissions,profiles,roles,permission_catalog;select set_config('caresuite.pflege_permission_repair_tenant','',false),set_config('test.fail_audit','false',false)");
  for (const key of expected) await db.query('insert into permission_catalog values($1,$2,$3)', [key, 'pflege', `Saved ${key}`]);
  await seedRole(owner, tenant, 'owner', [...expected, 'office.clients.view'], legacy);
  await seedRole(foreignOwner, otherTenant, 'owner', expected, legacy);
  await seedRole(staff, tenant, 'caregiver', ['pflege.plans.view']);
});
afterAll(() => db?.close());

describe('existing owner permission tenant scope repair', () => {
  it('makes the existing forty-two grants RLS-visible by attaching exactly the twenty-six NULL scopes to their own role tenant', async () => {
    expect(expected).toHaveLength(42);
    expect([...new Set(ROLE_PERMISSIONS.business_admin.filter(key => key.startsWith('pflege.')))].sort()).toEqual(expected);
    expect(await visibleGrants()).toEqual(expected.filter(key => !legacy.includes(key)));
    const unaffected = await rows("select * from role_permissions where role_id<>$1 or permission_key not like 'pflege.%' order by id", [owner]);
    const stable = () => rows("select to_jsonb(p)-'tenant_id'-'updated_at' value from role_permissions p where role_id=$1 and permission_key like 'pflege.%' order by permission_key", [owner]);
    const metadata = await stable();
    const catalog = await rows('select * from permission_catalog order by key');
    await repair();
    expect(await visibleGrants()).toEqual(expected);
    expect(await visibleGrants(foreignOwner)).toEqual([]);
    expect(await stable()).toEqual(metadata);
    expect(await rows("select * from role_permissions where role_id<>$1 or permission_key not like 'pflege.%' order by id", [owner])).toEqual(unaffected);
    expect(await rows('select * from permission_catalog order by key')).toEqual(catalog);
    expect((await rows<{ count: number }>('select count(*)::int count from fixture_row_audit'))[0].count).toBe(26);
    expect((await rows<{ count: number }>("select count(*)::int count from role_permissions where role_id=$1 and updated_at>'2020-01-01'", [owner]))[0].count).toBe(26);
    const audit = (await rows<{ actor_id: string | null; actor_role: string; action: string; old_value: unknown; new_value: unknown }>('select * from permission_audit_log'))[0];
    expect(audit).toMatchObject({ actor_id: null, actor_role: 'maintenance', action: 'pflege_owner_permission_tenant_repair' });
    expect(audit.old_value).toEqual({ roleId: owner, unscopedKeys: legacy });
    expect(audit.new_value).toEqual({ roleId: owner, pflege: expected, scopeUpdatedKeys: legacy, scopeRowsUpdated: 26 });
  });

  it('is idempotent with no second maintenance or row audit and no timestamp changes', async () => {
    await repair(); const once = await snapshot(); await repair(); expect(await snapshot()).toEqual(once);
  });

  it.each([
    ['missing explicit context', null, null, /Explicit repair tenant/],
    ['no eligible tenant owner', '77777777-7777-4777-8777-777777777777', null, /no rows/],
    ['wrong role key', tenant, `update roles set key='admin' where id='${owner}'`, /no rows/],
    ['non-administrator', tenant, `update roles set is_admin_role=false where id='${owner}'`, /no rows/],
    ['cannot manage roles', tenant, `update roles set can_manage_roles=false where id='${owner}'`, /no rows/],
    ['Pflege not allowed', tenant, `update roles set allowed_products=array['office'] where id='${owner}'`, /no rows/],
    ['inactive owner', tenant, `update profiles set is_active=false where role_id='${owner}'`, /no rows/],
    ['non-active owner status', tenant, `update profiles set status='invited' where role_id='${owner}'`, /no rows/],
    ['foreign profile tenant', tenant, `update profiles set tenant_id='${otherTenant}' where role_id='${owner}'`, /no rows/],
    ['incomplete forty-two baseline', tenant, `delete from role_permissions where role_id='${owner}' and permission_key='pflege.audit.view'`, /baseline differs/],
    ['extra Pflege key', tenant, `insert into role_permissions(role_id,tenant_id,permission_key) values('${owner}','${tenant}','pflege.future.view')`, /baseline differs/],
    ['foreign permission scope', tenant, `update role_permissions set tenant_id='${otherTenant}' where role_id='${owner}' and permission_key='pflege.audit.view'`, /foreign tenant/],
    ['partially repaired legacy subset', tenant, `update role_permissions set tenant_id='${tenant}' where role_id='${owner}' and permission_key='pflege.audit.view'`, /twenty-six legacy/],
    ['newer key unexpectedly unscoped', tenant, `update role_permissions set tenant_id=null where role_id='${owner}' and permission_key='pflege.vitals.view'`, /twenty-six legacy/],
    ['incomplete registered catalog', tenant, "delete from permission_catalog where key='pflege.wounds.view'", /Complete registered Pflege catalog/],
  ] as const)('rejects %s without changing any data', async (_label, target, mutation, message) => {
    if (mutation) await db.exec(mutation);
    const before = await snapshot(); await expect(repair(target)).rejects.toThrow(message); expect(await snapshot()).toEqual(before);
  });

  it.each(['owner', 'business_admin'])('rejects explicit %s replacements', async roleKey => {
    await db.query('insert into role_permission_sets(tenant_id,role_key,permission_key) values($1,$2,$3)', [tenant, roleKey, 'pflege.plans.view']);
    const before = await snapshot(); await expect(repair()).rejects.toThrow(/replacement requires individual review/); expect(await snapshot()).toEqual(before);
  });

  it('refuses ambiguous owner roles', async () => {
    await seedRole('88888888-8888-4888-8888-888888888888', tenant, 'owner', expected, legacy);
    const before = await snapshot(); await expect(repair()).rejects.toThrow(/more than one row/); expect(await snapshot()).toEqual(before);
  });

  it('rolls back all twenty-six scopes, timestamps and normal row audits if the maintenance audit fails', async () => {
    await db.exec("select set_config('test.fail_audit','true',false)");
    const before = await snapshot(); await expect(repair()).rejects.toThrow(/Synthetic audit failure/); expect(await snapshot()).toEqual(before);
  });

  it('leaves RLS, policy definitions and table ACLs unchanged', async () => {
    const security = () => rows("select c.relname,c.relacl::text,c.relrowsecurity,(select jsonb_agg(to_jsonb(p)) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname");
    const before = await security(); await repair(); expect(await security()).toEqual(before);
  });
});

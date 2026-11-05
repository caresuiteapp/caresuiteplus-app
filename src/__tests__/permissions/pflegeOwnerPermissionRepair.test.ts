import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PERMISSION_LABELS, ROLE_PERMISSIONS } from '@/lib/permissions/staticRolePermissions';

const patch = readFileSync('supabase/patches/pflege_owner_permission_repair.sql', 'utf8');
const tenant = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
const foreignOwner = '44444444-4444-4444-8444-444444444444';
const legacyOwner = '55555555-5555-4555-8555-555555555555';
const staff = '66666666-6666-4666-8666-666666666666';
const expected = Object.keys(PERMISSION_LABELS).filter(key => key.startsWith('pflege.')).sort();
// Independently retained production baseline, not parsed from the repair SQL.
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
    'audit',(select jsonb_agg(to_jsonb(a) order by id) from permission_audit_log a)
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
async function grants(role = owner) {
  return (await rows<{ permission_key: string }>('select permission_key from role_permissions where role_id=$1 and permission_key like $2 order by permission_key', [role, 'pflege.%'])).map(row => row.permission_key);
}
async function seedRole(id: string, target: string, key: string, admin: boolean, manage: boolean, products: string[], permissions: string[]) {
  await db.query('insert into roles values($1,$2,$3,$4,$5,$6)', [id, target, key, admin, manage, products]);
  await db.query("insert into profiles(role_id,tenant_id,is_active,status) values($1,$2,true,'active')", [id, target]);
  for (const key of permissions) await db.query('insert into role_permissions(tenant_id,role_id,permission_key,permission_name,restrictions) values($1,$2,$3,$4,$5)', [target, id, key, `Saved ${key}`, { marker: 'retained' }]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table roles(id uuid primary key,tenant_id uuid,key text,is_admin_role boolean,can_manage_roles boolean,allowed_products text[]);
    create table profiles(id uuid primary key default gen_random_uuid(),role_id uuid references roles,tenant_id uuid,is_active boolean,status text);
    create table role_permissions(id uuid primary key default gen_random_uuid(),tenant_id uuid,role_id uuid references roles,
      permission_key text not null,permission_name text,product_key text,can_view boolean default true,can_create boolean default false,
      can_update boolean default false,can_delete boolean default false,can_export boolean default false,can_approve boolean default false,
      restrictions jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),unique(role_id,permission_key));
    create table role_permission_sets(id uuid primary key default gen_random_uuid(),tenant_id uuid,role_key text,permission_key text);
    create table permission_catalog(key text primary key,module text,category text,label text,description text,
      risk_level text check(risk_level in('low','medium','high','critical')),requires_audit boolean,created_at timestamptz default now(),updated_at timestamptz default now());
    create table permission_audit_log(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,actor_id uuid,actor_role text,
      action text not null,old_value jsonb,new_value jsonb,reason text,created_at timestamptz default now());
    alter table role_permissions enable row level security;
    create policy fixture_roles on role_permissions using(tenant_id::text=current_setting('test.current_tenant',true));
    create function fixture_audit_failure() returns trigger language plpgsql as $$begin
      if current_setting('test.fail_audit',true)='true' then raise exception 'Synthetic audit failure';end if;return new;end$$;
    create trigger fixture_audit_failure before insert on permission_audit_log for each row execute function fixture_audit_failure();
  `);
}, 60000);
beforeEach(async () => {
  await db.exec("truncate permission_audit_log,role_permission_sets,role_permissions,profiles,roles,permission_catalog;select set_config('caresuite.pflege_permission_repair_tenant','',false),set_config('test.fail_audit','false',false)");
  for (const key of expected.filter(key => !['pflege.access', 'pflege.vitals.view'].includes(key))) {
    await db.query('insert into permission_catalog(key,module,category,label,description,risk_level,requires_audit) values($1,$2,$3,$4,$5,$6,$7)', [key, 'pflege', 'saved', `Saved ${key}`, 'Existing custom metadata', 'high', true]);
  }
  await seedRole(owner, tenant, 'owner', true, true, ['office', 'pflege'], [...legacy, 'office.clients.view']);
  await seedRole(foreignOwner, otherTenant, 'owner', true, true, ['office', 'pflege'], legacy);
  await seedRole(legacyOwner, tenant, 'owner_legacy_unassigned', true, false, [], legacy);
  await seedRole(staff, tenant, 'caregiver', false, false, ['pflege'], ['pflege.plans.view']);
});
afterAll(() => db?.close());

describe('explicitly scoped Pflege owner permission data repair', () => {
  it('adds exactly the sixteen missing registered owner keys and two catalog entries with a truthful maintenance audit', async () => {
    expect(expected).toHaveLength(42);
    expect([...new Set(ROLE_PERMISSIONS.business_admin.filter(key => key.startsWith('pflege.')))].sort()).toEqual(expected);
    const existingCatalog = await rows('select * from permission_catalog order by key');
    const existingOwnerRows = await rows('select * from role_permissions where role_id=$1 order by permission_key', [owner]);
    const otherRows = await rows('select * from role_permissions where role_id<>$1 order by id', [owner]);
    await repair();
    expect(await grants()).toEqual(expected);
    expect(await grants(foreignOwner)).toEqual(legacy);
    expect(await grants(legacyOwner)).toEqual(legacy);
    expect(await grants(staff)).toEqual(['pflege.plans.view']);
    expect(await rows('select * from role_permissions where role_id<>$1 order by id', [owner])).toEqual(otherRows);
    expect(await rows('select * from role_permissions where role_id=$1 and permission_key=any($2) order by permission_key', [owner, existingOwnerRows.map(row => row.permission_key)])).toEqual(existingOwnerRows);
    expect(await rows("select * from permission_catalog where key not in('pflege.access','pflege.vitals.view') order by key")).toEqual(existingCatalog);
    const audit = (await rows<{ actor_id: string | null; actor_role: string; action: string; old_value: any; new_value: any }>('select * from permission_audit_log'))[0];
    expect(audit).toMatchObject({ actor_id: null, actor_role: 'maintenance', action: 'pflege_owner_permission_repair' });
    expect(audit.old_value).toEqual({ roleId: owner, pflege: legacy });
    expect(audit.new_value).toMatchObject({ roleId: owner, pflege: expected, catalogAdded: 2 });
    expect(audit.new_value.insertedKeys).toEqual(expected.filter(key => !legacy.includes(key)));
    expect(audit.new_value.insertedKeys).toHaveLength(16);
  });

  it('is idempotent without a second audit, timestamp rewrite or repeated insertion', async () => {
    await repair(); const once = await snapshot(); await repair(); expect(await snapshot()).toEqual(once);
  });

  it.each([
    ['missing explicit context', null, null, /Explicit repair tenant/],
    ['tenant with no eligible owner', '77777777-7777-4777-8777-777777777777', null, /no rows/],
    ['wrong role key', tenant, "update roles set key='admin' where id='" + owner + "'", /no rows/],
    ['non-administrator', tenant, "update roles set is_admin_role=false where id='" + owner + "'", /no rows/],
    ['cannot manage roles', tenant, "update roles set can_manage_roles=false where id='" + owner + "'", /no rows/],
    ['Pflege not allowed', tenant, "update roles set allowed_products=array['office'] where id='" + owner + "'", /no rows/],
    ['inactive owner profile', tenant, "update profiles set is_active=false where role_id='" + owner + "'", /no rows/],
    ['non-active profile status', tenant, "update profiles set status='inactive' where role_id='" + owner + "'", /no rows/],
    ['foreign profile tenant', tenant, "update profiles set tenant_id='" + otherTenant + "' where role_id='" + owner + "'", /no rows/],
    ['owner not already managing Pflege', tenant, "delete from role_permissions where role_id='" + owner + "' and permission_key='pflege.plans.manage'", /no rows/],
    ['changed inspected baseline', tenant, "delete from role_permissions where role_id='" + owner + "' and permission_key='pflege.audit.view'", /baseline differs/],
    ['foreign permission scope', tenant, "update role_permissions set tenant_id='" + otherTenant + "' where role_id='" + owner + "' and permission_key='pflege.audit.view'", /foreign tenant/],
    ['incomplete broader catalog', tenant, "delete from permission_catalog where key='pflege.wounds.view'", /Complete registered Pflege catalog/],
  ] as const)('rejects %s and leaves every row unchanged', async (_label, target, mutation, message) => {
    if (mutation) await db.exec(mutation);
    const before = await snapshot(); await expect(repair(target)).rejects.toThrow(message); expect(await snapshot()).toEqual(before);
  });

  it.each(['owner', 'business_admin'])('rejects an explicit %s tenant replacement instead of mixing grants into it', async roleKey => {
    await db.query('insert into role_permission_sets(tenant_id,role_key,permission_key) values($1,$2,$3)', [tenant, roleKey, 'office.clients.view']);
    const before = await snapshot(); await expect(repair()).rejects.toThrow(/replacement requires individual review/); expect(await snapshot()).toEqual(before);
  });

  it('refuses ambiguous eligible owners rather than selecting a role arbitrarily', async () => {
    await seedRole('88888888-8888-4888-8888-888888888888', tenant, 'owner', true, true, ['pflege'], legacy);
    const before = await snapshot(); await expect(repair()).rejects.toThrow(/more than one row/); expect(await snapshot()).toEqual(before);
  });

  it('rolls back catalog, all sixteen grants and audit together when the audit fails', async () => {
    await db.exec("select set_config('test.fail_audit','true',false)");
    const before = await snapshot(); await expect(repair()).rejects.toThrow(/Synthetic audit failure/); expect(await snapshot()).toEqual(before);
  });

  it('does not alter table grants, RLS or existing policies', async () => {
    const security = () => rows("select c.relname,c.relacl::text,c.relrowsecurity,(select jsonb_agg(to_jsonb(p)) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname");
    const before = await security(); await repair(); expect(await security()).toEqual(before);
  });
});

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const patch = readFileSync('supabase/patches/aventa_enable_pflege_preference.sql', 'utf8');
const target = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const other = '11111111-1111-4111-8111-111111111111';
let db: PGlite;

async function runPatch() {
  try { await db.exec(patch); }
  catch (error) { await db.exec('rollback'); throw error; }
}

async function snapshot() {
  const result = await db.query<{ state: Record<string, unknown> }>(`select jsonb_build_object(
    'tenants',(select jsonb_agg(to_jsonb(t) order by id) from tenants t),
    'platformTenants',(select jsonb_agg(to_jsonb(t) order by tenant_id) from platform_tenants t),
    'products',(select jsonb_agg(to_jsonb(t) order by tenant_id,product_key) from tenant_products t),
    'platformModules',(select jsonb_agg(to_jsonb(t) order by tenant_id,module_key) from platform_tenant_modules t),
    'settings',(select jsonb_agg(to_jsonb(t) order by tenant_id) from tenant_module_settings t),
    'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_logs t)
  ) state`);
  return result.rows[0].state;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table tenants(id uuid primary key, slug text, name text);
    create table platform_tenants(tenant_id uuid primary key, status text);
    create table tenant_products(tenant_id uuid, product_key text, status text, is_active boolean,
      billing_status text, access_source text, starts_at timestamptz, ends_at timestamptz,
      trial_ends_at timestamptz, unique(tenant_id,product_key));
    create table platform_tenant_modules(tenant_id uuid, module_key text, status text, starts_at timestamptz,
      ends_at timestamptz, is_trial boolean, trial_ends_at timestamptz, unique(tenant_id,module_key));
    create table tenant_module_settings(tenant_id uuid primary key, assist_enabled boolean, pflege_enabled boolean,
      stationaer_enabled boolean, beratung_enabled boolean, updated_at timestamptz default '2026-09-14T10:18:54Z');
    create table audit_logs(id uuid primary key default gen_random_uuid(), tenant_id uuid, profile_id uuid,
      action text, table_name text, record_id uuid, title text, description text, old_data jsonb, new_data jsonb);
  `);
}, 60000);

beforeEach(async () => {
  await db.exec(`
    alter table audit_logs drop constraint if exists reject_test_audit;
    truncate audit_logs, tenant_module_settings, platform_tenant_modules, tenant_products, platform_tenants, tenants;
    insert into tenants values('${target}','helferhasen','AVENTA – Ambulante Alltagsbegleitung'),('${other}','other','Anderer Mandant');
    insert into platform_tenants values('${target}','active'),('${other}','active');
    insert into tenant_products values
      ('${target}','pflege','active',true,'free_active','free_active','2026-06-15',null,'2026-06-29'),
      ('${target}','office','active',true,'free_active','free_active','2026-06-15',null,'2026-06-29'),
      ('${other}','pflege','active',true,'free_active','free_active',null,null,null);
    insert into platform_tenant_modules values('${target}','consulting','enabled',null,null,false,null),
      ('${other}','care','locked',null,null,false,null);
    insert into tenant_module_settings(tenant_id,assist_enabled,pflege_enabled,stationaer_enabled,beratung_enabled)
    values('${target}',true,false,false,true),('${other}',false,false,true,false);
  `);
});
afterAll(() => db?.close());

describe('AVENTA launcher preference maintenance patch', () => {
  it('enables only the existing AVENTA setting, preserving active products with a historic trial date', async () => {
    const before = await snapshot();
    await runPatch();
    const after = await snapshot();
    expect(after.tenants).toEqual(before.tenants);
    expect(after.platformTenants).toEqual(before.platformTenants);
    expect(after.products).toEqual(before.products);
    expect(after.platformModules).toEqual(before.platformModules);
    const original = (before.settings as Array<Record<string, unknown>>).find(row => row.tenant_id === target)!;
    const changed = (after.settings as Array<Record<string, unknown>>).find(row => row.tenant_id === target)!;
    expect(changed).toEqual({ ...original, pflege_enabled: true, updated_at: changed.updated_at });
    expect(changed.updated_at).not.toBe(original.updated_at);
    expect((after.settings as Array<Record<string, unknown>>).filter(row => row.tenant_id !== target))
      .toEqual((before.settings as Array<Record<string, unknown>>).filter(row => row.tenant_id !== target));
    expect(after.audit).toEqual([expect.objectContaining({
      tenant_id: target, profile_id: null, action: 'update', table_name: 'tenant_module_settings', record_id: target,
      old_data: { pflege_enabled: false, updated_at: original.updated_at },
      new_data: { pflege_enabled: true, updated_at: changed.updated_at },
    })]);
    await runPatch();
    expect(await snapshot()).toEqual(after);
  });

  it.each([
    ['a different tenant identity', `update tenants set slug='unexpected' where id='${target}'`],
    ['a suspended platform tenant', `update platform_tenants set status='suspended' where tenant_id='${target}'`],
    ['a missing Pflege product', `delete from tenant_products where tenant_id='${target}' and product_key='pflege'`],
    ['an inactive Pflege product', `update tenant_products set is_active=false where tenant_id='${target}' and product_key='pflege'`],
    ['an administratively disabled product', `update tenant_products set billing_status='admin_disabled' where tenant_id='${target}' and product_key='pflege'`],
    ['an expired product', `update tenant_products set ends_at=now()-interval '1 day' where tenant_id='${target}' and product_key='pflege'`],
    ['a missing settings row', `delete from tenant_module_settings where tenant_id='${target}'`],
    ['an unknown previous flag', `update tenant_module_settings set pflege_enabled=null where tenant_id='${target}'`],
    ['a failed audit insertion', "alter table audit_logs add constraint reject_test_audit check(action<>'update')"],
  ])('leaves all state unchanged for %s', async (_label, change) => {
    await db.exec(change);
    const before = await snapshot();
    await expect(runPatch()).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['care', 'locked', null, null, false, null],
    ['pflege', 'disabled', null, null, false, null],
    ['office', 'expired', null, null, false, null],
    ['care', 'scheduled', null, null, false, null],
    ['care', 'enabled', '2099-01-01', null, false, null],
    ['care', 'enabled', null, '2000-01-01', false, null],
    ['care', 'trial', null, null, true, '2000-01-01'],
  ])('preserves the %s platform denial (%s)', async (key, status, startsAt, endsAt, isTrial, trialEndsAt) => {
    await db.query('insert into platform_tenant_modules values($1,$2,$3,$4,$5,$6,$7)', [target, key, status, startsAt, endsAt, isTrial, trialEndsAt]);
    const before = await snapshot();
    await expect(runPatch()).rejects.toThrow(/Plattformfreigabe/);
    expect(await snapshot()).toEqual(before);
  });
});

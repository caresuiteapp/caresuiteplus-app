import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const id = n => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = id(1), foreignTenant = id(2), actor = id(3), foreignActor = id(4), viewer = id(5);
const client = id(6), otherClient = id(7), foreignClient = id(8);
const actorRole = id(9), foreignRole = id(10), viewerRole = id(11);
const session = id(12), foreignSession = id(13), viewerSession = id(14);
const view = ['pflege.access', 'pflege.medications.view', 'office.clients.view', 'office.clients.view_sensitive'];
const manage = [...view, 'pflege.medications.manage'];
const patient = { firstName: 'Prüfperson', lastName: 'Beispiel', birthDate: '1941-06-12' };
const baseRow = { kind: 'medication', section: { code: null, label: null }, weekdayCode: null, doseText: null,
  instructions: null, additionalText: null, morning: '1', noon: '0', evening: '1', night: null, unit: null, unitCode: 'v' };
const read = name => readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema care_private;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    grant usage on schema auth to authenticated;
    create table auth.sessions(id uuid primary key, user_id uuid, not_after timestamptz);
    create table public.tenants(id uuid primary key);
    create table public.roles(id uuid primary key, tenant_id uuid, key text);
    create table public.profiles(id uuid primary key, tenant_id uuid, is_active boolean, status text, auth_user_id uuid, role_id uuid,
      display_name text, email text);
    create table public.role_permissions(role_id uuid, permission_key text, restrictions jsonb, tenant_id uuid);
    create table public.role_permission_sets(tenant_id uuid, role_key text, permission_key text);
    create table public.employees(id uuid primary key, tenant_id uuid, profile_id uuid);
    create table public.employee_permission_overrides(employee_id uuid, tenant_id uuid, permission_key text, allowed boolean,
      valid_from timestamptz, valid_until timestamptz);
    create table public.clients(id uuid primary key, tenant_id uuid, first_name text, last_name text,
      date_of_birth date, insurance_number text, status text, deleted_at timestamptz);
    create table public.client_module_assignments(tenant_id uuid, client_id uuid, module_key text, is_active boolean, status text);
    create table public.medications(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
      client_id uuid not null references public.clients(id), name text not null, dosage text, frequency text,
      active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      prescribed_dose text, dose_unit text, minimum_interval_minutes text, maximum_dose text, maximum_dose_unit text, maximum_period_hours text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function public.current_tenant_id() returns uuid language sql stable as $$select nullif(current_setting('test.tenant',true),'')::uuid$$;
    create function public.resolve_current_profile_id() returns uuid language sql stable as $$select auth.uid()$$;
    create function public.current_portal_type() returns text language sql stable as $$select null::text$$;
    create function public.platform_tenant_access_allowed(uuid, boolean) returns boolean language sql stable as $$select true$$;
    create function public.has_permission(text) returns boolean language sql stable as
      $$select $1 = any(string_to_array(current_setting('test.permissions',true), ','))$$;
    create function public.is_active_pfleger_client(uuid) returns boolean language sql stable security definer set search_path='' as
      $$select current_setting('test.order_policy_enabled',true) = 'yes' and exists(
        select 1 from public.client_module_assignments a where a.tenant_id=public.current_tenant_id() and a.client_id=$1
          and a.module_key='pflege' and a.is_active and a.status='active')$$;
    insert into public.tenants values ('${tenant}'), ('${foreignTenant}');
    insert into public.roles values ('${actorRole}','${tenant}','owner'), ('${foreignRole}','${foreignTenant}','owner'), ('${viewerRole}','${tenant}','nurse');
    insert into public.profiles(id,tenant_id,is_active,status,auth_user_id,role_id) values
      ('${actor}','${tenant}',true,'active',null,'${actorRole}'), ('${foreignActor}','${foreignTenant}',true,'active',null,'${foreignRole}'),
      ('${viewer}','${tenant}',true,'active',null,'${viewerRole}');
    insert into public.role_permissions(role_id,permission_key) select r.id, unnest(string_to_array('${manage.join(',')}', ','))
      from public.roles r where r.id in ('${actorRole}','${foreignRole}');
    insert into public.role_permissions(role_id,permission_key) select '${viewerRole}', unnest(string_to_array('${view.join(',')}', ','));
    insert into auth.sessions values ('${session}','${actor}',now()+interval '1 hour'),
      ('${foreignSession}','${foreignActor}',now()+interval '1 hour'), ('${viewerSession}','${viewer}',now()+interval '1 hour');
    insert into public.clients values ('${client}','${tenant}','${patient.firstName}','${patient.lastName}','${patient.birthDate}',null,'active',null),
      ('${foreignClient}','${foreignTenant}','${patient.firstName}','${patient.lastName}','${patient.birthDate}',null,'active',null),
      ('${otherClient}','${tenant}','Andere','Prüfperson','1940-01-01',null,'active',null);
    insert into public.client_module_assignments select tenant_id,id,'pflege',true,'active' from public.clients;
  `);
  for (const migration of [
    '20260812153000_live_medication_ambulatory_intensive', '20261021210737_pflege_medication_structured_order_client_guard',
    '20261112104353_medication_plan_import_drafts', '20261112104503_pflege_master_data_catalogs', '20261112111703_medication_bmp_transfer_provenance',
  ]) await db.exec(read(migration));

  async function identity({ as = actor, scope = tenant, sessionId = session, permissions = manage, orderPolicy = 'yes', claims = {}, role = 'authenticated' } = {}) {
    await db.exec('reset role;');
    await db.query(`select set_config('test.actor',$1,false),set_config('test.tenant',$2,false),set_config('test.permissions',$3,false),
      set_config('request.jwt.claims',$4,false),set_config('test.order_policy_enabled',$5,false)`,
      [as, scope, permissions.join(','), JSON.stringify({ role: 'authenticated', session_id: sessionId, exp: Math.floor(Date.now()/1000)+3600, ...claims }), orderPolicy]);
    await db.exec(`set role ${role};`);
  }
  async function result(sql, args = []) { return (await db.query(sql, args)).rows[0].result; }
  const save = (rows = [baseRow], t = tenant, a = actor, c = client) => result(
    'select public.save_medication_plan_import($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as result',
    [t,a,randomUUID(),c,'exact','','original.xml','application/xml',Buffer.from(`<MP>${randomUUID()}</MP>`).toString('base64'),
      JSON.stringify({ version: '028', patient, rows })]);
  const confirm = (plan, row = 0, t = tenant, a = actor) => result('select public.confirm_medication_plan_import_position($1,$2,$3,$4) as result',[t,a,plan,row]);
  const link = (plan, row = 0, t = tenant, a = actor, c = client) => result('select public.get_medication_plan_order_link($1,$2,$3,$4,$5) as result',[t,a,c,plan,row]);
  const insert = (plan, row = 0, { t = tenant, c = client, a = actor, updated = a, schedule = '1-0-1-0', dose = '1 mg',
    morning = '1', noon = null, evening = '1', night = null, prn = false, structured = null,
    route = 'oral', prescriber = 'Beispielpraxis', startDate = '2026-11-12' } = {}) => result(`insert into public.medications
      (tenant_id,client_id,name,created_by,updated_by,bmp_import_id,bmp_row_index,schedule,dosage,morning_dose,noon_dose,evening_dose,night_dose,is_prn,prescribed_dose,
       route,prescribed_by,start_date)
      values($1,$2,'Manuell geprüfter Beispielname',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id as result`,
    [t,c,a,updated,plan,row,schedule,dose,morning,noon,evening,night,prn,structured,route,prescriber,startDate]);

  await test('no order or administration is created by import or review; unconfirmed and non-medication links are rejected', async () => {
    await identity();
    const { id: plan } = await save([baseRow, { ...baseRow, kind: 'note' }, { ...baseRow, kind: 'formulation' }]);
    await assert.rejects(link(plan), { code: '42501' });
    await assert.rejects(insert(plan), { code: '42501' });
    await assert.rejects(insert(plan,null), { code: '22023' });
    await assert.rejects(insert(null,0), { code: '22023' });
    await assert.rejects(link(plan,200), { code: '22023' });
    for (const row of [1,2]) {
      await confirm(plan,row);
      await assert.rejects(link(plan,row), { code: '42501' });
      await assert.rejects(insert(plan,row), { code: '42501' });
    }
    await confirm(plan);
    assert.equal(await link(plan), null);
    assert.equal(await result('select count(*)::int as result from public.medications'),0);
    await db.exec('reset role;');
    assert.equal(await result('select count(*)::int as result from public.medication_administrations'),0);
  });

  await test('exact doses and times are required; previous structured field restrictions still apply', async () => {
    await identity();
    const { id: plan } = await save();
    await confirm(plan);
    for (const change of [{ schedule: '1-0-0-0' }, { morning: '2' }, { noon: '0' }, { evening: null }, { night: '1' },
      { dose: '1 g' }, { dose: null }, { prn: true }]) await assert.rejects(insert(plan,0,change), { code: '23514' });
    for (const change of [{ route: null }, { prescriber: ' \t' }, { startDate: null }, { startDate: 'infinity' }]) {
      await assert.rejects(insert(plan,0,change), { code: '23514', message: /Therapiebeginn/ });
    }
    await assert.rejects(insert(plan,0,{ structured: '1' }), { code: '42501', message: /serverseitigen Originalbeleg/ });
    assert.equal(await link(plan), null);
    const medication = await insert(plan);
    assert.equal(await link(plan), medication);
  });

  await test('weekly, free text, unsafe slots and unrecognised units remain in archive', async () => {
    await identity();
    const variants = [ { section: { code: '425', label: null } }, { section: { code: null, label: 'Frei' } }, { weekdayCode: '2' },
      { doseText: '2 bei Bedarf' }, { instructions: 'Bitte verdünnen' }, { additionalText: 'abweichender Zeitpunkt' },
      { morning: '0,5' }, { morning: '01' }, { morning: 1 }, { morning: '2' }, { morning: '0', evening: '0' },
      { unitCode: 'z' }, { unitCode: null }, { unit: 'mg' }, { unit: 'MG', unitCode: null } ];
    const { id: plan } = await save(variants.map(change => ({ ...baseRow,...change })));
    for (let row = 0; row < variants.length; row++) {
      await confirm(plan,row);
      await assert.rejects(link(plan,row), { code: '22023' });
      await assert.rejects(insert(plan,row), { code: '22023' });
    }
    const { id: valid } = await save([{ ...baseRow, section: { code: '412', label: null }, instructions: ' \t\u00a0',
      unit: 'Tablette', unitCode: null, morning: '9999', evening: '9999' }]);
    await confirm(valid);
    assert.equal(await link(valid), null);
    const order = await insert(valid,0,{ dose: '9999 Tablette', schedule: '9999-0-9999-0', morning: '9999', evening: '9999' });
    assert.equal(await link(valid), order);
  });

  await test('other cases, other tenants, revoked sessions and altered actors cannot resolve or use a link', async () => {
    await identity();
    const { id: plan } = await save();
    await confirm(plan);
    const medication = await insert(plan);
    await assert.rejects(link(plan,0,tenant,actor,otherClient), { code: '42501' });
    await assert.rejects(insert(plan,0,{ c: otherClient }), { code: '42501' });
    await assert.rejects(insert(plan,0,{ a: viewer }), { code: '42501' });
    await assert.rejects(insert(plan,0,{ updated: viewer }), { code: '42501' });
    await identity({ as: foreignActor, scope: foreignTenant, sessionId: foreignSession });
    await assert.rejects(link(plan,0,foreignTenant,foreignActor,foreignClient), { code: '42501' });
    await assert.rejects(insert(plan,0,{ t: foreignTenant, c: foreignClient, a: foreignActor }), { code: '42501' });
    await identity({ claims: { exp: 1 } });
    await assert.rejects(link(plan), { code: '42501' });
    await identity({ claims: { app_metadata: { portal_type: 'employee' } } });
    await assert.rejects(link(plan), { code: '42501' });
    await identity({ as: viewer, sessionId: viewerSession, permissions: view });
    assert.equal(await link(plan,0,tenant,viewer), medication);
    await assert.rejects(insert(plan,0,{ a: viewer }), { code: '42501' });
    await identity({ orderPolicy: 'no' });
    assert.equal(await link(plan), null); // INVOKER keeps existing orders RLS effective.
    await identity({ role: 'anon' });
    await assert.rejects(link(plan), { code: '42501' });
  });

  await test('link remains unique after stop, cannot be rebound, and leaves manual orders alone', async () => {
    await identity();
    const manual = await insert(null,null);
    const { id: plan } = await save([baseRow,baseRow]);
    await confirm(plan); await confirm(plan,1);
    const first = await insert(plan), second = await insert(plan,1);
    assert.notEqual(first,second);
    assert.equal(await result("update public.medications set status='stopped' where id=$1 returning status as result",[first]),'stopped');
    assert.equal(await link(plan), first);
    await assert.rejects(insert(plan), { code: '23505', constraint: 'medications_bmp_position_unique' });
    await assert.rejects(db.query('update public.medications set bmp_import_id=null,bmp_row_index=null where id=$1',[first]), { code: '42501' });
    await assert.rejects(db.query('update public.medications set client_id=$2 where id=$1',[first,otherClient]), { code: '42501' });
    await assert.rejects(db.query('update public.medications set bmp_import_id=$2,bmp_row_index=0 where id=$1',[manual,plan]), { code: '42501' });
    await db.exec('reset role;');
    await assert.rejects(db.query('delete from public.medications where id=$1',[first]), { code: '42501' });
    assert.equal(await result('delete from public.medications where id=$1 returning id as result',[manual]),manual);
  });
} finally {
  await db.close();
}

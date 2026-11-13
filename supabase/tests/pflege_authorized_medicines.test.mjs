// Real migrations in an isolated synthetic dataset; no production connection.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const uuid = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = uuid(1), other = uuid(2), actor = uuid(3), otherActor = uuid(4);
const first = uuid(5), second = uuid(6), foreign = uuid(7);
const db = new PGlite();
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create function public.current_tenant_id() returns uuid language sql stable as $$select nullif(current_setting('test.tenant',true),'')::uuid$$;
    create function public.resolve_current_profile_id() returns uuid language sql stable as $$select auth.uid()$$;
    create function public.current_portal_type() returns text language sql stable as $$select nullif(current_setting('test.portal',true),'')$$;
    create function public.has_permission(text) returns boolean language sql stable as $$select true$$;
    create table public.tenants(id uuid primary key);
    create table public.roles(id uuid primary key, tenant_id uuid, key text, is_admin_role boolean);
    create table public.profiles(id uuid primary key, auth_user_id uuid, tenant_id uuid, role_id uuid, is_active boolean, status text);
    create table public.role_permissions(role_id uuid, tenant_id uuid, permission_key text, restrictions jsonb);
    create table public.role_permission_sets(tenant_id uuid, role_key text, permission_key text);
    create table public.employees(id uuid primary key, tenant_id uuid, profile_id uuid);
    create table public.employee_permission_overrides(tenant_id uuid, employee_id uuid, permission_key text, allowed boolean, valid_from timestamptz, valid_until timestamptz);
    create table public.medications(id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
      name text, active_ingredient text, strength text, form text, prescribed_by text, dosage text);
    insert into public.tenants values ('${tenant}'), ('${other}');
    insert into public.roles values ('${actor}','${tenant}','nurse',false), ('${otherActor}','${other}','owner',true);
    insert into public.profiles select id,null,tenant_id,id,true,'active' from public.roles;
    insert into public.role_permissions
      select id,tenant_id,k.needed,'{}' from public.roles cross join unnest(array['pflege.access','pflege.medications.view']) k(needed);
  `);
  const migrate = name => db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  await migrate('20261112104503_pflege_master_data_catalogs.sql');
  await migrate('20261113083630_pflege_authorized_medicines.sql');
  await db.query(`insert into pflege_catalog.authorized_medicines
    (tenant_id,id,source,source_version,external_id,name,active_substance,authorization_holder,authorization_scope)
    values ($1,$2,'ema-article57','test-revision','de-pruef','Prüfmittel 5 G','Testwirkstoff','Testunternehmen','DE'),
      ($1,$3,'ema-article57','test-revision','eu-pruef','Prüfmittel 5 G','Testwirkstoff',null,'EU'),
      ($4,$5,'ema-article57','test-revision','eu-pruef','Prüfmittel Andere Akte',null,null,'EU')`,
  [tenant, first, second, other, foreign]);

  const session = async (profile, ownTenant, portal = '', role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('test.actor',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false)", [profile, ownTenant, portal]);
    await db.exec(`set role ${role}`);
  };
  const search = async (target, needle) => (await db.query('select public.search_pflege_authorized_medicines($1,$2) result',[target,needle])).rows[0].result;

  await test('search returns exact own reference data with distinct Germany and EU scopes and no PZN', async () => {
    await session(actor, tenant);
    const results = await search(tenant, 'Prüf Testwirk');
    assert.deepEqual(results, [
      {id:first,source:'ema-article57',sourceVersion:'test-revision',name:'Prüfmittel 5 G',activeSubstance:'Testwirkstoff',authorizationHolder:'Testunternehmen',authorizationScope:'DE'},
      {id:second,source:'ema-article57',sourceVersion:'test-revision',name:'Prüfmittel 5 G',activeSubstance:'Testwirkstoff',authorizationHolder:null,authorizationScope:'EU'},
    ]);
    assert.equal((await search(tenant, 'Testunter')).length, 1);
    assert.equal((await db.query('select count(*)::int total from pflege_catalog.authorized_medicines')).rows[0].total, 2);
    await assert.rejects(search(other,'Prüfmittel'),{code:'42501'});
    await session(otherActor, other);
    assert.equal((await search(other,'Prüfmittel'))[0].id,foreign);
    assert.deepEqual((await db.query('select public.search_pflege_medication_packages($1,$2) result',[other,'Prüfmittel'])).rows[0].result, []);
  });

  await test('anonymous, portal and restricted users are blocked with actual catalog authorization', async () => {
    await session('',tenant,'','anon');
    await assert.rejects(search(tenant,'Prüfmittel'),{code:'42501'});
    await session(actor,tenant,'employee');
    await assert.rejects(search(tenant,'Prüfmittel'),{code:'42501'});
    await db.exec('reset role');
    await db.query("insert into public.role_permission_sets values ($1,'nurse','pflege.access')",[tenant]);
    await session(actor,tenant);
    await assert.rejects(search(tenant,'Prüfmittel'),{code:'42501'});
    await db.exec('reset role; delete from public.role_permission_sets');
  });

  await test('results are bounded and even tenant owners cannot write or alter downloaded reference rows', async () => {
    await db.exec('reset role');
    await db.query(`insert into pflege_catalog.authorized_medicines (tenant_id,source,source_version,external_id,name,authorization_scope)
      select $1,'ema-article57','test-revision','test-'||g,'Grenzpräparat '||g,'DE' from generate_series(1,40) g`,[other]);
    await session(otherActor,other);
    assert.equal((await search(other,'Grenzpräparat')).length, 30);
    await assert.rejects(search(other,'x'.repeat(121)),{code:'22023'});
    await assert.rejects(db.query(`insert into pflege_catalog.authorized_medicines (tenant_id,source,source_version,external_id,name,authorization_scope)
      values ($1,'ema-article57','test-revision','probe','Probe','DE')`,[other]),{code:'42501'});
    await assert.rejects(db.query(`update pflege_catalog.authorized_medicines set name='Probe' where id=$1`,[foreign]),{code:'42501'});
    await assert.rejects(db.query(`delete from pflege_catalog.authorized_medicines where id=$1`,[foreign]),{code:'42501'});
  });
} finally { await db.close(); }

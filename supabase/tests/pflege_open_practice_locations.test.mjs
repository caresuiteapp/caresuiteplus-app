// Isolated database tests using synthetic names, not a connection to a project.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = uuid(1), other = uuid(2), actor = uuid(3), otherActor = uuid(4), practice = uuid(5);
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
    insert into public.roles values ('${actor}','${tenant}','owner',true), ('${otherActor}','${other}','owner',true);
    insert into public.profiles select id,null,tenant_id,id,true,'active' from public.roles;
    insert into public.role_permissions
      select id,tenant_id,k.needed,'{}' from public.roles cross join unnest(array['pflege.access','pflege.medications.view','pflege.medications.manage','business.tenant.manage']) k(needed);
  `);
  const migrate = name => db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  await migrate('20261112104503_pflege_master_data_catalogs.sql');
  await migrate('20261112125312_pflege_open_practice_locations.sql');
  await db.query(`insert into pflege_catalog.practice_locations
    (tenant_id,id,source,source_version,source_updated_at,external_id,display_name,practice_name,specialty,postal_code,city,street,phone)
    values ($1,$2,'rvr-ruhr-praxis','test-stand','2026-01-02','test-same-id','Prüfpraxis A','Hausarztpraxis A','Allgemeinmedizin','01234','Prüfort','Teststraße 1','000 00'),
      ($3,$4,'rvr-ruhr-praxis','test-stand',null,'test-same-id','Prüfpraxis B',null,null,null,'Prüfort',null,null)`,
  [tenant, practice, other, uuid(6)]);

  const session = async (profile, ownTenant, portal = '', role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('test.actor',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false)", [profile, ownTenant, portal]);
    await db.exec(`set role ${role}`);
  };
  const search = async (target, needle) => (await db.query('select public.search_pflege_practice_locations($1,$2) result',[target,needle])).rows[0].result;

  await test('practice search returns only the current tenant with exact provenance and professional fields', async () => {
    await session(actor, tenant);
    assert.deepEqual(await search(tenant,'Prüfort 0123'), [{id:practice,source:'rvr-ruhr-praxis',sourceVersion:'test-stand',sourceUpdatedAt:'2026-01-02',
      displayName:'Prüfpraxis A',practiceName:'Hausarztpraxis A',specialty:'Allgemeinmedizin',postalCode:'01234',city:'Prüfort',street:'Teststraße 1',phone:'000 00'}]);
    assert.equal((await db.query('select count(*)::integer total from pflege_catalog.practice_locations')).rows[0].total,1);
    await assert.rejects(search(other,'Prüfpraxis'),{code:'42501'});
    await session(otherActor, other);
    assert.equal((await search(other,'Prüfpraxis'))[0].displayName,'Prüfpraxis B');
    assert.equal((await search(other,'Prüfort'))[0].sourceUpdatedAt,null);
  });

  await test('anonymous, portal and explicitly restricted actors cannot search', async () => {
    await session('',tenant,'','anon');
    await assert.rejects(search(tenant,'Prüfpraxis'),{code:'42501'});
    await session(actor,tenant,'employee');
    await assert.rejects(search(tenant,'Prüfpraxis'),{code:'42501'});
    await db.exec('reset role');
    await db.query(`insert into public.role_permission_sets values ($1,'business_admin','pflege.access')`,[tenant]);
    await session(actor,tenant);
    await assert.rejects(search(tenant,'Prüfpraxis'),{code:'42501'});
    await db.exec('reset role; delete from public.role_permission_sets;');
  });

  await test('practice search is bounded and browser actors, including owners, have read-only access', async () => {
    await db.exec('reset role');
    await db.query(`insert into pflege_catalog.practice_locations (tenant_id,source,source_version,external_id,display_name)
      select $1,'rvr-ruhr-praxis','test-stand','more-'||g,'Grenzpraxis '||g from generate_series(1,40) g`,[tenant]);
    await session(actor,tenant);
    assert.equal((await search(tenant,'Grenzpraxis')).length,30);
    await assert.rejects(search(tenant,'x'.repeat(121)),{code:'22023'});
    await assert.rejects(db.query(`insert into pflege_catalog.practice_locations (tenant_id,source,source_version,external_id,display_name)
      values ($1,'rvr-ruhr-praxis','test-stand','not-authorized','Probe')`,[tenant]),{code:'42501'});
    await assert.rejects(db.query(`update pflege_catalog.practice_locations set display_name='Probe' where id=$1`,[practice]),{code:'42501'});
    await assert.rejects(db.query(`delete from pflege_catalog.practice_locations where id=$1`,[practice]),{code:'42501'});
  });

  await test('practice locations cannot be accepted as the prescriber of an order', async () => {
    await db.exec('reset role');
    await assert.rejects(db.query(`insert into public.medications (tenant_id,name,prescribed_by,prescriber_directory_id)
      values ($1,'Prüfpräparat','Prüfpraxis A',$2)`,[tenant,practice]),{code:'23514'});
    await session(actor,tenant);
    assert.deepEqual((await db.query(`select public.search_pflege_physicians($1,'Prüfpraxis') result`,[tenant])).rows[0].result,[]);
  });
} finally { await db.close(); }

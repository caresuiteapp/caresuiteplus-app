// Real catalog migrations in an isolated synthetic dataset.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const uuid = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = uuid(1), other = uuid(2), actor = uuid(3), otherActor = uuid(4);
const berlin = uuid(5), ruhr = uuid(6), foreign = uuid(7);
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
      select id,tenant_id,k.needed,'{}' from public.roles cross join unnest(array['pflege.access','pflege.medications.view']) k(needed);
  `);
  const migrate = name => db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  await migrate('20261112104503_pflege_master_data_catalogs.sql');
  await migrate('20261112125312_pflege_open_practice_locations.sql');
  await migrate('20261113083637_pflege_osm_practice_locations.sql');
  await migrate('20261113103607_pflege_practice_location_pages.sql');
  await db.query(`insert into pflege_catalog.osm_practice_locations
    (tenant_id,id,source,source_version,source_updated_at,external_id,display_name,practice_name,specialty,postal_code,city,street,phone,state_code,state_name)
    values ($1,$2,'osm-de-praxis','test-stand','2026-01-02','n:123','Prüfpraxis Berlin',null,'Allgemeinmedizin','01234','Berlin',null,null,'DE-BE','Berlin'),
      ($1,$3,'osm-de-praxis','test-stand',null,'w:124','Prüfpraxis Herne','Testpraxis','Innere Medizin','44623','Herne','Teststraße 1',null,'DE-NW','Nordrhein-Westfalen'),
      ($4,$5,'osm-de-praxis','test-stand',null,'n:123','Prüfpraxis Fremd',null,null,null,'Berlin',null,null,'DE-BE','Berlin')`,
  [tenant, berlin, ruhr, other, foreign]);
  await db.query(`insert into pflege_catalog.practice_locations(tenant_id,source,source_version,external_id,display_name)
    values ($1,'rvr-ruhr-praxis','test-stand','n:123','Prüfpraxis RVR')`,[tenant]);

  const session = async (profile, ownTenant, portal = '', role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('test.actor',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false)", [profile, ownTenant, portal]);
    await db.exec(`set role ${role}`);
  };
  const search = async (target, needle, state = null) => (await db.query('select public.search_pflege_osm_practice_locations($1,$2,$3) result',[target,needle,state])).rows[0].result;
  const searchPage = async (target, needle, state = null, cursor = null) =>
    (await db.query('select public.search_pflege_osm_practice_locations_page($1,$2,$3,$4) result',[target,needle,state,cursor])).rows[0].result;
  const searchRuhrPage = async (target, needle, cursor = null) =>
    (await db.query('select public.search_pflege_practice_locations_page($1,$2,$3) result',[target,needle,cursor])).rows[0].result;
  const insertProbe = (code, name, external = 'n:999') => db.query(`insert into pflege_catalog.osm_practice_locations
    (tenant_id,source,source_version,external_id,display_name,state_code,state_name) values ($1,'osm-de-praxis','test-stand',$2,'Probe',$3,$4)`,
  [tenant,external,code,name]);

  await test('state, city, specialty and postcode search isolate RVR, foreign tenants and physicians', async () => {
    await session(actor, tenant);
    assert.deepEqual(await search(tenant,'herne 446','DE-NW'),[{id:ruhr,source:'osm-de-praxis',sourceVersion:'test-stand',sourceUpdatedAt:null,
      displayName:'Prüfpraxis Herne',practiceName:'Testpraxis',specialty:'Innere Medizin',postalCode:'44623',city:'Herne',street:'Teststraße 1',phone:null,
      stateCode:'DE-NW',stateName:'Nordrhein-Westfalen'}]);
    assert.deepEqual((await search(tenant,'Prüfpraxis')).map(row=>row.id),[berlin,ruhr]);
    assert.equal((await search(tenant,'allgemein','DE-BE'))[0].sourceUpdatedAt,'2026-01-02');
    assert.deepEqual(await search(tenant,'herne','DE-BE'),[]);
    assert.deepEqual((await db.query('select public.search_pflege_practice_locations($1,$2) result',[tenant,'Prüfpraxis'])).rows[0].result.map(row=>row.displayName),['Prüfpraxis RVR']);
    assert.deepEqual((await db.query('select public.search_pflege_physicians($1,$2) result',[tenant,'Prüfpraxis'])).rows[0].result,[]);
    assert.equal((await db.query('select count(*)::int total from pflege_catalog.osm_practice_locations')).rows[0].total,2);
    await assert.rejects(search(other,'Berlin'),{code:'42501'});
  });

  await test('filter bounds, role-based read restrictions and absence of browser write grants', async () => {
    await db.exec('reset role');
    await db.query(`insert into pflege_catalog.osm_practice_locations(tenant_id,source,source_version,external_id,display_name,state_code,state_name)
      select $1,'osm-de-praxis','test-stand','n:'||g,'Grenzpraxis '||g,'DE-NW','Nordrhein-Westfalen' from generate_series(200,240) g`,[tenant]);
    await session(actor,tenant);
    assert.equal((await search(tenant,'Grenzpraxis','DE-NW')).length,30);
    await assert.rejects(search(tenant,'Prüfpraxis','DE-XX'),{code:'22023'});
    await assert.rejects(search(tenant,'x'.repeat(121)),{code:'22023'});
    await assert.rejects(insertProbe('DE-NW','Nordrhein-Westfalen'),{code:'42501'});
    await assert.rejects(db.query('update pflege_catalog.osm_practice_locations set display_name=$1 where id=$2',['Probe',ruhr]),{code:'42501'});
    await assert.rejects(db.query('delete from pflege_catalog.osm_practice_locations where id=$1',[ruhr]),{code:'42501'});
    await session('',tenant,'','anon');
    await assert.rejects(search(tenant,'Prüfpraxis'),{code:'42501'});
    await session(actor,tenant,'employee');
    await assert.rejects(search(tenant,'Prüfpraxis'),{code:'42501'});
  });

  await test('mislabelled states, invalid point IDs and a practice used as a prescriber are rejected', async () => {
    await db.exec('reset role');
    await assert.rejects(insertProbe('DE-BE','Nordrhein-Westfalen'),{code:'23514'});
    await assert.rejects(insertProbe('DE-BE',null),{code:'23514'});
    await assert.rejects(insertProbe(null,'Berlin'),{code:'23514'});
    await assert.rejects(insertProbe('DE-BE','Berlin','untyped-7'),{code:'23514'});
    await assert.rejects(db.query(`insert into public.medications(tenant_id,name,prescribed_by,prescriber_directory_id)
      values($1,'Prüfpräparat','Prüfpraxis Herne',$2)`,[tenant,ruhr]),{code:'23514'});
  });

  await test('paged practice searches return every row once across name ties, with correctly bounded final pages', async () => {
    await db.exec('reset role');
    await db.query(`insert into pflege_catalog.osm_practice_locations(tenant_id,id,source,source_version,external_id,display_name,city,state_code,state_name)
      select $1,('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'osm-de-praxis','test-stand','n:'||g,
      case when g < 435 then 'Seitentest A' else 'Seitentest B' end,'Herne','DE-NW','Nordrhein-Westfalen' from generate_series(400,464) g
      order by g desc`, [tenant]);
    await db.query(`insert into pflege_catalog.practice_locations(tenant_id,id,source,source_version,external_id,display_name,city)
      select $1,('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'rvr-ruhr-praxis','test-stand','paged-'||g,
      case when g < 530 then 'Seitentest A' else 'Seitentest B' end,'Dortmund' from generate_series(500,559) g
      order by g desc`, [tenant]);
    await session(actor,tenant);
    const first = await searchPage(tenant,'Seitentest Herne','DE-NW');
    const second = await searchPage(tenant,'Seitentest Herne','DE-NW',first.nextCursor);
    const third = await searchPage(tenant,'Seitentest Herne','DE-NW',second.nextCursor);
    assert.deepEqual([first.rows.length,second.rows.length,third.rows.length],[30,30,5]);
    assert.deepEqual([first.nextCursor,second.nextCursor,third.nextCursor],[uuid(429),uuid(459),null]);
    assert.deepEqual([...first.rows,...second.rows,...third.rows].map(row=>row.id),Array.from({length:65},(_,i)=>uuid(400+i)));
    assert.deepEqual(first.rows,await search(tenant,'Seitentest Herne','DE-NW'));
    const ruhrFirst = await searchRuhrPage(tenant,'Seitentest Dortmund');
    const ruhrSecond = await searchRuhrPage(tenant,'Seitentest Dortmund',ruhrFirst.nextCursor);
    assert.deepEqual([ruhrFirst.rows.length,ruhrSecond.rows.length,ruhrFirst.nextCursor,ruhrSecond.nextCursor],[30,30,uuid(529),null]);
    assert.deepEqual([...ruhrFirst.rows,...ruhrSecond.rows].map(row=>row.id),Array.from({length:60},(_,i)=>uuid(500+i)));
    assert.deepEqual(await searchPage(tenant,'Seitentest Herne','DE-BE'),{rows:[],nextCursor:null});
    assert.deepEqual(await searchRuhrPage(tenant,'Seitentest Herne'),{rows:[],nextCursor:null});
  });

  await test('paged lookup validates scope, state and cursor without disclosing a foreign location', async () => {
    await session(actor,tenant);
    await assert.rejects(searchPage(other,'Prüfpraxis'),{code:'42501'});
    await assert.rejects(searchRuhrPage(other,'Prüfpraxis'),{code:'42501'});
    await assert.rejects(searchPage(tenant,'Prüfpraxis','DE-XX'),{code:'22023'});
    await assert.rejects(searchPage(tenant,'Prüfpraxis','DE-BE',ruhr),{code:'22023'});
    await assert.rejects(searchPage(tenant,'Seitentest','DE-NW',ruhr),{code:'22023'});
    await assert.rejects(searchPage(tenant,'Prüfpraxis',null,foreign),{code:'22023'});
    await assert.rejects(searchRuhrPage(tenant,'Prüfpraxis',foreign),{code:'22023'});
    await session('',tenant,'','anon');
    await assert.rejects(searchPage(tenant,'Prüfpraxis'),{code:'42501'});
    await assert.rejects(searchRuhrPage(tenant,'Prüfpraxis'),{code:'42501'});
    await session(actor,tenant,'employee');
    await assert.rejects(searchPage(tenant,'Prüfpraxis'),{code:'42501'});
    await assert.rejects(searchRuhrPage(tenant,'Prüfpraxis'),{code:'42501'});
  });
} finally { await db.close(); }

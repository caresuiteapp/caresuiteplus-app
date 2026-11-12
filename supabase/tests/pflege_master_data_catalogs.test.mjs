// Isolated SQL tests: no project connection and no real patient/provider data.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isValidPzn, validateMedicationPackageFeed, validatePhysicianFeed, validateManualPhysician }
  from '../../src/lib/pflege/medicationMasterDataValidation.ts';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = uuid(1), foreign = uuid(2), owner = uuid(3), clinician = uuid(4), viewer = uuid(5);
const med = { pzn: '27580899', name: 'Prüfpräparat Eindeutig', dosageForm: 'Tablette' };
const makePzn = n => {
  const prefix = String(n).padStart(7,'0');
  const sum = [...prefix].reduce((total, digit, index) => total + Number(digit) * (index + 1), 0);
  return sum % 11 < 10 ? prefix + String(sum % 11) : null;
};

await test('client feed validation preserves the PZN text and requires exact bounded records', () => {
  const pzn = makePzn(12345);
  assert.ok(pzn.startsWith('00'));
  assert.equal(isValidPzn(pzn), true);
  assert.equal(isValidPzn(Number(pzn)), false);
  assert.equal(isValidPzn('00000000'), false);
  assert.equal(isValidPzn(pzn.slice(0,-1) + ((Number(pzn[7])+1)%10)), false);
  const feed = { source: 'bfarm-31b', sourceVersion: '2026-11-01', rows: [{...med, pzn, dosageForm: 'a'.repeat(200)}] };
  const validated = validateMedicationPackageFeed(feed);
  assert.equal(validated.ok, true);
  assert.equal(validated.data.rows[0].pzn, pzn);
  assert.equal(validated.data.rows[0].manufacturer, null);
  assert.equal(validateMedicationPackageFeed({...feed, rows: [med, med]}).ok, false);
  assert.equal(validateMedicationPackageFeed({...feed, rows: [{...med, age: 'unexpected'}]}).ok, false);
  assert.equal(validatePhysicianFeed({...feed, rows: [{displayName:'Test ohne Quell-ID'}]}).ok, false);
  assert.equal(validateManualPhysician({displayName:'Test', postalCode:'01234'}).ok, true);
  assert.equal(validateManualPhysician({displayName:'Test', postalCode:'1234'}).ok, false);
});

const db = new PGlite();
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create function public.current_tenant_id() returns uuid language sql stable as $$select nullif(current_setting('test.tenant',true),'')::uuid$$;
    create function public.resolve_current_profile_id() returns uuid language sql stable as $$select auth.uid()$$;
    create function public.current_portal_type() returns text language sql stable as $$select nullif(current_setting('test.portal',true),'')$$;
    -- Deliberately permissive stand-in; the catalogue must additionally bind the exact own grant.
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
    insert into public.tenants values ('${tenant}'),('${foreign}');
    insert into public.roles values
      ('${owner}','${tenant}','owner',true), ('${clinician}','${tenant}','nurse',false), ('${viewer}','${tenant}','caregiver',false);
    insert into public.profiles select id,null,tenant_id,id,true,'active' from public.roles;
    insert into public.role_permissions
      select id,tenant_id,k.needed,'{}' from public.roles cross join unnest(array['pflege.access','pflege.medications.view']) k(needed);
    insert into public.role_permissions values ('${owner}','${tenant}','pflege.medications.manage','{}'), ('${clinician}','${tenant}','pflege.medications.manage','{}');
  `);
  await db.exec(readFileSync(new URL('../migrations/20261112104503_pflege_master_data_catalogs.sql', import.meta.url),'utf8'));
  const identity = async (actor, portal = '', role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('test.actor',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false)", [actor,tenant,portal]);
    await db.exec(`set role ${role}`);
  };
  const run = async (sql, args = []) => (await db.query(sql,args)).rows[0].result;
  const upload = (rows, source = 'bfarm-31b', version = '2026-11-01', target = tenant) =>
    run('select public.import_pflege_medication_packages($1,$2,$3,$4::jsonb) result',[target,source,version,JSON.stringify(rows)]);
  const medSearch = (query, target = tenant) => run('select public.search_pflege_medication_packages($1,$2) result',[target,query]);
  const doctor = row => run('select public.save_pflege_manual_physician($1,$2::jsonb) result',[tenant,JSON.stringify(row)]);

  await test('same PZN from two sources retains both identities and never erases manufacturer', async () => {
    await identity(owner);
    assert.equal(await upload([med]),1);
    assert.equal(await upload([{...med,manufacturer:'Testanbieter',brand:'Testmarke'}],'licensed-fixture'),1);
    assert.equal(await upload([med]),1);
    const rows = await medSearch(`PZN-${med.pzn}`);
    assert.deepEqual(rows.map(({source,manufacturer})=>[source,manufacturer]),[['bfarm-31b',null],['licensed-fixture','Testanbieter']]);
    assert.equal((await medSearch('Prüfpräpar Ei')).length,2);
    assert.equal((await medSearch('Testanbieter')).length,1);
  });

  await test('same-version change and invalid whole batches fail atomically', async () => {
    await identity(owner);
    const added = { pzn: makePzn(99), name:'Prüfzweites' };
    assert.ok(added.pzn);
    await assert.rejects(upload([added,{...med,name:'Andere Bezeichnung'}]),{code:'23505'});
    assert.deepEqual(await medSearch('Prüfzweites'),[]);
    await assert.rejects(upload([added,{...med,pzn:12345678}]),{code:'22023'});
    await assert.rejects(upload([added,{...med,pzn:'00000000'}]),{code:'22023'});
    await assert.rejects(upload([med,med]),{code:'22023'});
    await assert.rejects(upload(Array(501).fill(med)),{code:'22023'});
    assert.equal(await upload([{...med,name:'Prüfpräparat Aktualisiert'}],'bfarm-31b','2026-11-15'),1);
    assert.equal((await medSearch('Aktualisiert'))[0].sourceVersion,'2026-11-15');
  });

  await test('manual directory entries deduplicate identical contacts but preserve different locations', async () => {
    await identity(clinician);
    const contact = {displayName:'Dr. Testperson',practiceName:'Praxis Beispiel',postalCode:'01234',city:'Musterstadt'};
    const one = await doctor(contact), same = await doctor({...contact,displayName:' DR. Testperson '});
    assert.equal(one.id,same.id);
    assert.equal(one.source,'manual');
    const different = await doctor({...contact,postalCode:'02345'});
    assert.notEqual(one.id,different.id);
    const rows = await run('select public.search_pflege_physicians($1,$2) result',[tenant,'Muster 0123']);
    assert.deepEqual(rows.map(row=>row.id),[one.id]);
    await assert.rejects(run('select public.import_pflege_physicians($1,$2,$3,$4::jsonb) result',[tenant,'licensed-kv','v1',JSON.stringify([{...contact,externalId:'id-1'}])]),{code:'42501'});
    await identity(owner);
    const importDoctors = rows => run('select public.import_pflege_physicians($1,$2,$3,$4::jsonb) result',[tenant,'licensed-kv','v1',JSON.stringify(rows)]);
    assert.equal(await importDoctors([{...contact,externalId:'id-1'}]),1);
    await assert.rejects(importDoctors([{...contact,externalId:'id-1',city:'Andere Stadt'}]),{code:'23505'});
  });

  await test('catalog rights cannot be borrowed from another role, tenant, or portal', async () => {
    await identity(viewer);
    assert.equal((await medSearch(med.pzn)).length,2);
    await assert.rejects(upload([med]),{code:'42501'});
    await assert.rejects(doctor({displayName:'Test'}),{code:'42501'});
    await identity(owner);
    await assert.rejects(medSearch(med.pzn,foreign),{code:'42501'});
    await assert.rejects(upload([med],'bfarm-31b','v2',foreign),{code:'42501'});
    await identity(owner,'employee');
    await assert.rejects(medSearch(med.pzn),{code:'42501'});
    await identity('', '', 'anon');
    await assert.rejects(medSearch(med.pzn),{code:'42501'});
    await db.exec(`reset role; insert into public.role_permission_sets values ('${tenant}','business_admin','pflege.access')`);
    await identity(owner);
    await assert.rejects(medSearch(med.pzn),{code:'42501'});
    await db.exec(`reset role; delete from public.role_permission_sets; insert into public.employees values ('${uuid(99)}','${tenant}','${clinician}');
      insert into public.employee_permission_overrides values ('${tenant}','${uuid(99)}','pflege.medications.manage',false,null,null)`);
    await identity(clinician);
    assert.equal((await medSearch(med.pzn)).length,2);
    await assert.rejects(doctor({displayName:'Test'}),{code:'42501'});
  });

  await test('search is bounded and immutable identity FKs prevent cross-tenant catalog attribution', async () => {
    await identity(owner);
    const more = Array.from({length:100},(_,n)=>makePzn(300+n)).filter(Boolean).map(pzn=>({pzn,name:'Kataloggrenze Prüfartikel'}));
    await upload(more);
    assert.equal((await medSearch('Kataloggrenze')).length,30);
    await assert.rejects(medSearch('a'.repeat(121)),{code:'22023'});
    await assert.rejects(db.query('update pflege_catalog.medication_packages set source=$1 where pzn=$2',['changed',med.pzn]),{code:'42501'});
    await db.exec('reset role');
    await assert.rejects(db.query('insert into public.medications(tenant_id,product_pzn,product_catalog_source,product_catalog_version) values($1,$2,$3,$4)',[foreign,med.pzn,'bfarm-31b','v1']),{code:'23514'});
    const batches = await run('select count(*)::integer result from pflege_catalog.change_log where tenant_id=$1',[tenant]);
    assert.equal(batches, 8);
  });

  await test('orders bind exact selected source, and identity revisions remove stale references', async () => {
    await identity(owner);
    const prescriber = await doctor({displayName:'Testpraxis Verordnung'});
    await db.exec('reset role');
    const insert = (version, name = 'Prüfpräparat Aktualisiert') => run(`insert into public.medications
      (tenant_id,name,form,prescribed_by,product_pzn,product_catalog_source,product_catalog_version,prescriber_directory_id)
      values($1,$2,$3,$4,$5,'bfarm-31b',$6,$7) returning id result`,[tenant,name,med.dosageForm,prescriber.displayName,med.pzn,version,prescriber.id]);
    await assert.rejects(insert('2026-11-01'),{code:'23514'});
    await assert.rejects(insert('2026-11-15','Fremde Bezeichnung'),{code:'23514'});
    const id = await insert('2026-11-15');
    await db.query("update public.medications set dosage='synthetische Testangabe' where id=$1",[id]);
    assert.equal(await run('select product_pzn result from public.medications where id=$1',[id]),med.pzn);
    await db.query("update public.medications set strength='andere Teststärke',prescribed_by='andere Testpraxis' where id=$1",[id]);
    const refs = await run('select jsonb_build_array(product_pzn,product_catalog_source,product_catalog_version,prescriber_directory_id) result from public.medications where id=$1',[id]);
    assert.deepEqual(refs,[null,null,null,null]);
  });
} finally { await db.close(); }

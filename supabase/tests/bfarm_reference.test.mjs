import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),foreign=id(2),owner=id(3),viewer=id(4);
const date='2020-11-15',pzn='00000017';
const product={pzn,name:'Prüfpräparat',ingredient:'Testwirkstoff',strength:null,dosageForm:'Tablette',brand:null,manufacturer:null,packageSize:null,source:'bfarm-31b',sourceVersion:date};
const components=[{number:1,dosageForm:'Tablette',description:null,substances:[{name:'Testwirkstoff',strength:null,id:'00127',rank:0}]}];
const archive=Buffer.from('private unmodified fixture archive'),digest=createHash('sha256').update(archive).digest('hex');
const query=(sql,args=[])=>db.query(sql,args);
const result=async(sql,args=[])=> (await query(sql,args)).rows[0].result;
const identity=async(actor=owner,portal='',target=tenant,role='authenticated')=>{
  await db.exec('reset role');
  await query("select set_config('test.actor',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false)",[actor,target,portal]);
  await db.exec(`set role ${role}`);
};
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create function public.current_tenant_id() returns uuid language sql stable as $$select nullif(current_setting('test.tenant',true),'')::uuid$$;
    create function public.resolve_current_profile_id() returns uuid language sql stable as $$select auth.uid()$$;
    create function public.current_portal_type() returns text language sql stable as $$select nullif(current_setting('test.portal',true),'')$$;
    create function public.has_permission(text) returns boolean language sql stable as $$select true$$;
    create table public.tenants(id uuid primary key);
    create table public.roles(id uuid primary key,tenant_id uuid,key text,is_admin_role boolean);
    create table public.profiles(id uuid primary key,auth_user_id uuid,tenant_id uuid,role_id uuid,is_active boolean,status text);
    create table public.role_permissions(role_id uuid,tenant_id uuid,permission_key text,restrictions jsonb);
    create table public.role_permission_sets(tenant_id uuid,role_key text,permission_key text);
    create table public.employees(id uuid primary key,tenant_id uuid,profile_id uuid);
    create table public.employee_permission_overrides(tenant_id uuid,employee_id uuid,permission_key text,allowed boolean,valid_from timestamptz,valid_until timestamptz);
    create table public.medications(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,name text,active_ingredient text,strength text,form text,prescribed_by text,dosage text);
    insert into public.tenants values ('${tenant}'),('${foreign}');
    insert into public.roles values ('${owner}','${tenant}','owner',true),('${viewer}','${tenant}','nurse',false);
    insert into public.profiles select id,null,tenant_id,id,true,'active' from public.roles;
    insert into public.role_permissions select id,tenant_id,k,'{}' from public.roles cross join unnest(array['pflege.access','pflege.medications.view']) k;
    insert into public.role_permissions values ('${owner}','${tenant}','pflege.medications.manage','{}');
    grant select,insert,update on public.medications to authenticated;
  `);
  await db.exec(readFileSync(new URL('../migrations/20261112104503_pflege_master_data_catalogs.sql',import.meta.url),'utf8'));
  const migration=readdirSync(new URL('../migrations/',import.meta.url)).find(n=>n.endsWith('_bfarm_reference_single_record.sql'));
  await db.exec(readFileSync(new URL(migration?'../migrations/'+migration:'../changes/bfarm_reference_single_record.sql',import.meta.url),'utf8'));

  await test('activation rejects a partial or modified original and preserves the prior active snapshot',async()=>{
    await query('insert into bfarm_reference.deliveries(source_date,archive_sha256,archive_bytes,medicinal_count,component_count,substance_count,file_manifest) values($1,$2,$3,1,1,1,$4)',
      [date,digest,archive.length,JSON.stringify([{name:'medicinal'},{name:'product'},{name:'substance'}])]);
    await assert.rejects(query('select bfarm_reference.activate_delivery($1)',[date]),/Originalexport/);
    await query('insert into bfarm_reference.archive_chunks values($1,0,$2)',[date,Buffer.from('wrong bytes')]);
    await assert.rejects(query('select bfarm_reference.activate_delivery($1)',[date]),/Originalexport/);
    await query('update bfarm_reference.archive_chunks set bytes=$2 where source_date=$1',[date,archive]);
    await assert.rejects(query('select bfarm_reference.activate_delivery($1)',[date]),/vollständig/);
    await query('insert into bfarm_reference.packages values($1,$2,$3,$4)',[date,pzn,JSON.stringify(product),JSON.stringify(components)]);
    await query('select bfarm_reference.activate_delivery($1)',[date]);
    await query('select bfarm_reference.activate_delivery($1)',[date]);
    assert.equal((await query('select source_date::text d from bfarm_reference.current_delivery')).rows[0].d,date);
  });
  await test('one authorized exact lookup preserves rank zero, missing strength, date and provenance',async()=>{
    await identity();
    const data=await result('select public.get_pflege_bfarm_reference($1,$2) result',[tenant,pzn]);
    assert.deepEqual(data.product,product);assert.deepEqual(data.components,components);
    assert.equal(data.stale,true);assert.equal(data.nextExpectedOn,'2020-12-01');
    assert.equal(await result('select public.get_pflege_bfarm_reference($1,$2) result',[tenant,'01234562']),null);
  });
  await test('anonymous callers, foreign tenants, portals and non-active actors are denied',async()=>{
    await identity(owner,'',tenant,'anon');
    await assert.rejects(query('select public.get_pflege_bfarm_reference($1,$2)',[tenant,pzn]),/permission denied/);
    await identity();await assert.rejects(query('select public.get_pflege_bfarm_reference($1,$2)',[foreign,pzn]),/Leseberechtigung/);
    await identity(owner,'employee');await assert.rejects(query('select public.get_pflege_bfarm_reference($1,$2)',[tenant,pzn]),/Leseberechtigung/);
    await identity();await db.exec('reset role');await query('update public.profiles set is_active=false where id=$1',[owner]);
    await identity();await assert.rejects(query('select public.get_pflege_bfarm_reference($1,$2)',[tenant,pzn]),/Leseberechtigung/);
    await db.exec('reset role');await query('update public.profiles set is_active=true where id=$1',[owner]);
  });
  await test('prefixes, multiple PZN, wildcards, null and malformed checksums cannot query the data',async()=>{
    await identity();
    for(const invalid of [null,'00','%','00000017,01234562','PZN 00000017','00000018','00000000']){
      await assert.rejects(query('select public.get_pflege_bfarm_reference($1,$2)',[tenant,invalid]),/vollständige/);
    }
  });
  await test('full originals and derived tables are hidden and do not enter the legacy catalogue',async()=>{
    await identity();
    for(const table of ['archive_chunks','packages','deliveries','current_delivery']){
      await assert.rejects(query(`select * from bfarm_reference.${table}`),/permission denied/);
    }
    assert.equal((await query("select * from pflege_catalog.medication_packages where source='bfarm-31b'")).rows.length,0);
    assert.deepEqual(await result('select public.search_pflege_medication_packages($1,$2) result',[tenant,'Prüfpräparat']),[]);
    assert.equal(await result('select public.import_pflege_medication_packages($1,$2,$3,$4) result',[tenant,'other-licensed',date,JSON.stringify([{pzn,name:'Andere Quelle'}])]),1);
    const visible=await result('select public.search_pflege_medication_packages($1,$2) result',[tenant,pzn]);
    assert.equal(visible.length,1);assert.equal(visible[0].source,'other-licensed');
  });
  await test('a verified original and its records cannot be changed after activation',async()=>{
    await db.exec('reset role');
    await assert.rejects(query('update bfarm_reference.archive_chunks set bytes=$1 where source_date=$2',[Buffer.from('changed'),date]),/unveränderlich/);
    await assert.rejects(query('delete from bfarm_reference.packages where source_date=$1',[date]),/unveränderlich/);
    await assert.rejects(query('update bfarm_reference.deliveries set medicinal_count=2 where source_date=$1',[date]),/unveränderlich/);
    assert.equal(await result("select encode(sha256(string_agg(bytes,''::bytea order by chunk_no)),'hex') result from bfarm_reference.archive_chunks"),digest);
  });
} finally { await db.close(); }

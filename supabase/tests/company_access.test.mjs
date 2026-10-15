import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFixture,id } from './company_access_fixture.mjs';

const f=await companyFixture();
const {db,actor,owner,permission,access,scope,organization,entityA,entityB,siteA,siteB,department}=f;
const granted = (kind,targetId)=>({kind,targetId});
const record = async(entity=null,site=null,dep=null)=>(await db.query("SELECT care_security.company_record_access($1,'business.tenant.manage',$2,$3,$4) AS ok",[id(10),entity,site,dep])).rows[0].ok;
try {
  await test('active verified primary grants work; portal, foreign tenant, anonymous and inactive identities fail',async()=>{
    await actor();assert.equal(await permission(),true);
    await actor(21);assert.equal(await permission(),true);
    await actor(22);assert.equal(await permission(),false);
    await actor(24,11);assert.equal(await permission('business.tenant.manage',10),false);
    await actor(20,10,{app_metadata:{role_key:'employee_portal'}});assert.equal(await permission(),false);
    await actor(20,10,{user_metadata:{role_key:'employee_portal'}});assert.equal(await permission(),true);
    await owner();await db.query('UPDATE profiles SET is_active=false WHERE id=$1',[id(21)]);await actor(21);assert.equal(await permission(),false);
    await owner();await db.query('UPDATE profiles SET is_active=true WHERE id=$1',[id(21)]);
    await actor(null);await assert.rejects(db.query('SELECT public.company_access_permissions($1)',[id(10)]),/permission denied/i);
  });
  await test('tenant role replacements remove inherited permissions instead of restoring static defaults',async()=>{
    await owner();await db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'business_manager','office.employees.view')",[id(10)]);
    await actor(21);assert.equal(await permission(),false);assert.equal(await permission('office.employees.view'),true);
    await owner();await db.exec('DELETE FROM role_permission_sets');
  });
  await test('seeded exact permission keys remain grants when legacy can_view defaults to false',async()=>{
    await owner();await db.query("UPDATE role_permissions SET can_view=false WHERE role_id=$1 AND permission_key='business.tenant.manage'",[id(2)]);
    await actor(21);assert.equal(await permission(),true);
    await owner();await db.query("UPDATE role_permissions SET can_view=true WHERE role_id=$1",[id(2)]);
  });
  await test('template and individual grants are effective, active explicit deny wins over all sources',async()=>{
    await owner();await db.query("INSERT INTO role_templates VALUES($1,$2,'special','Special')",[id(60),id(10)]);
    await db.query("INSERT INTO role_template_permissions(role_template_id,permission_key,allowed) VALUES($1,'business.tenant.manage',true)",[id(60)]);
    await db.query('INSERT INTO employee_role_assignments(tenant_id,employee_id,role_template_id) VALUES($1,$2,$3)',[id(10),id(42),id(60)]);
    await actor(23);assert.equal(await permission(),true);
    await owner();await db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'business.tenant.manage',false)",[id(10),id(42)]);
    await actor(23);assert.equal(await permission(),false);
    await owner();await db.exec("UPDATE employee_permission_overrides SET valid_until=now()-interval '1 day'");await actor(23);assert.equal(await permission(),true);
    await owner();await db.exec("UPDATE employee_permission_overrides SET valid_until=NULL,valid_from=now()+interval '1 day'");await actor(23);assert.equal(await permission(),true);
    await owner();await db.exec('DELETE FROM employee_permission_overrides; DELETE FROM employee_role_assignments');
  });
  await test('permission sources cannot be self edited, system templates stay immutable, administrators retain tenant writes',async()=>{
    await actor(21);await assert.rejects(db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'office.documents.view',true)",[id(10),id(40)]),/row-level security/);
    await assert.rejects(db.query("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'business_manager','office.documents.view')",[id(10)]),/row-level security/);
    await assert.rejects(db.query('UPDATE employees SET profile_id=$1 WHERE id=$2',[id(21),id(42)]),/identity changes/);
    await actor();await db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'office.documents.view',true)",[id(10),id(40)]);
    await assert.rejects(db.query("INSERT INTO role_templates(id,tenant_id,role_key,name) VALUES($1,NULL,'forged','Forged')",[id(61)]),/row-level security/);
    await owner();await db.exec('DELETE FROM employee_permission_overrides');
  });
  await test('legacy text scopes fail closed until a real controlled site is mapped',async()=>{
    await owner();await db.query("INSERT INTO employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'office','location','Alpha Site')",[id(10),id(40)]);
    await actor(21);assert.equal(await permission(),false);assert.deepEqual((await access()).permissions,[]);
    await actor();await scope(21,[granted('site',siteA.id)]);
    await actor(21);assert.equal(await permission(),false);assert.equal((await access()).scopeLimited,true);assert.equal((await access()).permissions.includes('business.tenant.manage'),true);
    assert.equal(await record(entityA.id,siteA.id),true);assert.equal(await record(entityB.id,siteB.id),false);
    assert.equal(await record(entityA.id),false);assert.equal(await record(),false);
    assert.deepEqual((await db.query('SELECT id FROM company_sites')).rows.map(r=>r.id),[siteA.id]);
    await assert.rejects(db.query('SELECT public.company_scope_people($1)',[id(10)]),/Zugriffsverwaltung/);
  });
  await test('a controlled site scope permits authorized edits only within old and destination scope',async()=>{
    await actor(21);
    const saved=await organization('site',{name:'Alpha revised'},siteA.id,1);assert.equal(saved.version,2);
    await assert.rejects(organization('site',{name:'Not authorized'},siteB.id,1),/Zuständigkeitsbereich/);
    await assert.rejects(organization('site',{entity_id:entityB.id},siteA.id,2),/Zuordnungen|Zuständigkeitsbereich|Organisationszuordnung/);
    await assert.rejects(organization('entity',{name:'New company'}),/Zuständigkeitsbereich/);
    await assert.rejects(db.query("INSERT INTO company_sites(id,tenant_id,name,kind) VALUES($1,$2,'Direct','office')",[id(95),id(10)]),/permission denied/);
  });
  await test('grant changes require role administrator, CAS and valid tenant references; invalid sets roll back completely',async()=>{
    await actor(21);await assert.rejects(scope(23,[granted('site',siteA.id)]),/Zugriffsverwaltung/);
    await actor();await assert.rejects(scope(20,[granted('site',siteA.id)]),/eigene/);
    await assert.rejects(scope(21,[granted('site',siteB.id)],0),/inzwischen geändert/);
    await assert.rejects(scope(21,[granted('site',siteB.id),granted('site',id(999))],1),/nicht aktiv/);
    await actor(21);assert.equal(await record(entityA.id,siteA.id),true);assert.equal(await record(entityB.id,siteB.id),false);
    await actor();await assert.rejects(scope(21,[],1,false),/Personalakte/);
  });
  await test('last scope revocation denies all and never silently restores company-wide access',async()=>{
    await actor();await scope(21,[],1);
    await actor(21);assert.equal((await access()).scopeLimited,true);assert.deepEqual((await access()).permissions,[]);assert.deepEqual((await db.query('SELECT id FROM company_sites')).rows,[]);
    await actor();await scope(21,[granted('department',department.id)],2);
    await actor(21);assert.equal(await record(entityA.id,siteA.id,department.id),true);assert.equal(await record(entityA.id,siteA.id),false);
  });
  await test('controlled scope grants never override removed feature permission',async()=>{
    await owner();await db.query("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'business.tenant.manage',false)",[id(10),id(40)]);
    await actor(21);assert.equal(await record(entityA.id,siteA.id,department.id),false);assert.equal((await access()).permissions.includes('business.tenant.manage'),false);
    await owner();await db.exec('DELETE FROM employee_permission_overrides');
  });
  await test('scope targets are tenant-bound and archived targets stop authorizing immediately',async()=>{
    await actor();await organization('department',{status:'archived'},department.id,1);
    await actor(21);assert.equal(await record(entityA.id,siteA.id,department.id),false);
    await owner();await db.query("INSERT INTO company_legal_entities(id,tenant_id,name) VALUES($1,$2,'Foreign')",[id(90),id(11)]);
    await actor();await assert.rejects(scope(21,[granted('entity',id(90))],3),/anderes|anderen/);
    await actor(21);assert.deepEqual((await db.query('SELECT id FROM company_legal_entities')).rows,[]);
  });
  await test('all scope RPCs are invoker wrappers and private privileged functions are denied to anonymous',async()=>{
    await owner();const rows=(await db.query("SELECT proname,prosecdef FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('company_access_permissions','company_scope_people','company_scope_save')")).rows;
    assert.equal(rows.length,3);assert.equal(rows.every(r=>r.prosecdef===false),true);
    for(const fn of ['care_security.company_scope_save(uuid,uuid,boolean,jsonb,integer)','care_security.company_scope_people(uuid)']) assert.equal((await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[fn])).rows[0].allowed,false);
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','company_scope_grants','INSERT') AS allowed")).rows[0].allowed,false);
  });
} finally { await db.close(); }

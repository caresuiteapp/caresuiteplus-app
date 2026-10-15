import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFixture,id } from './company_access_fixture.mjs';

const f=await companyFixture({resources:true});
const {db,actor,owner,scope,organization,entityA,entityB,siteA,siteB}=f;
const resource=async(kind,input)=>(await db.query('SELECT public.company_resources_save($1,$2,$3) AS result',[id(10),kind,JSON.stringify(input)])).rows[0].result;
const snapshot=async()=>(await db.query('SELECT public.company_resources_snapshot($1) AS result',[id(10)])).rows[0].result;
const rows=async table=>(await db.query(`SELECT id FROM ${table} ORDER BY id`)).rows.map(r=>r.id);
const contextA={entity_id:entityA.id,site_id:siteA.id},contextB={entity_id:entityB.id,site_id:siteB.id};
let vehicleA,vehicleB,policyB,allocation;
try {
  await test('combined migrations execute real organization and resource commands with tenant references',async()=>{
    await actor();
    await organization('placement',{employee_id:id(40),...contextA,starts_on:'2020-01-01',is_primary:true});
    await organization('placement',{employee_id:id(42),...contextB,starts_on:'2020-01-01',is_primary:true});
    const contract=await resource('contract',{title:'Office lease',contract_type:'rent',counterparty:'Example lessor',...contextA});
    assert.equal(contract.version,1);
    policyB=await resource('insurance',{title:'Vehicle policy',insurance_type:'vehicle',provider:'Example insurer',policy_number:'X-100',...contextB});
    vehicleA=await resource('vehicle',{plate:'HER-AA 1',ownership:'owned',vehicle_type:'car',mileage:100,...contextA});
    vehicleB=await resource('vehicle',{plate:'HER-BB 2',ownership:'leased',vehicle_type:'car',mileage:200,insurance_policy_id:policyB.id,...contextB});
    assert.equal((await snapshot()).vehicles.length,2);
  });
  await test('vehicle issue, overlap protection and return are transactional with monotonic mileage',async()=>{
    const start=new Date(Date.now()-60*60*1000).toISOString(),end=new Date(Date.now()+60*60*1000).toISOString();
    allocation=await resource('allocation',{vehicle_id:vehicleA.id,employee_id:id(40),starts_at:start,ends_at:end,status:'active',issue_mileage:100,issue_condition:'Good'});
    const count=(await db.query('SELECT count(*)::integer AS count FROM company_resource_audit')).rows[0].count;
    await assert.rejects(resource('allocation',{vehicle_id:vehicleA.id,employee_id:id(40),starts_at:start,ends_at:end,status:'active',issue_mileage:100,issue_condition:'Good'}),/bereits vergeben/);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM company_resource_audit')).rows[0].count,count);
    const returned={id:allocation.id,expected_version:1,returned_at:new Date().toISOString(),return_mileage:99,return_condition:'Good'};
    await assert.rejects(db.query('SELECT public.company_resources_return_vehicle($1,$2)',[id(10),JSON.stringify(returned)]),/Kilometer|Rückgabe/);
    const receipt=(await db.query('SELECT public.company_resources_return_vehicle($1,$2) AS result',[id(10),JSON.stringify({...returned,return_mileage:110})])).rows[0].result;
    assert.equal(receipt.status,'returned');
    assert.equal((await db.query('SELECT mileage FROM company_vehicles WHERE id=$1',[vehicleA.id])).rows[0].mileage,'110.00');
  });
  await test('resource writes reject stale versions, cross-scope reassignment and direct table updates',async()=>{
    vehicleA=(await db.query('SELECT * FROM company_vehicles WHERE id=$1',[vehicleA.id])).rows[0];
    await assert.rejects(resource('vehicle',{id:vehicleA.id,expected_version:1,model:'Stale'}),/inzwischen|Version/);
    await scope(21,[{kind:'site',targetId:siteA.id}]);await actor(21);
    const result=await resource('vehicle',{id:vehicleA.id,expected_version:vehicleA.version,model:'Updated'});vehicleA=result;
    assert.equal(result.model,'Updated');
    await assert.rejects(resource('vehicle',{id:vehicleA.id,expected_version:vehicleA.version,...contextB}),/Zielzuordnung/);
    await assert.rejects(resource('vehicle',{id:vehicleB.id,expected_version:1,model:'Forbidden'}),/Zugriffsbereich/);
    await assert.rejects(resource('vehicle',{id:vehicleA.id,expected_version:vehicleA.version,insurance_policy_id:policyB.id}),/Versicherung/);
    await assert.rejects(db.query("UPDATE company_vehicles SET model='Direct' WHERE id=$1",[vehicleA.id]),/permission denied/);
  });
  await test('server snapshot and direct reads enforce identical site boundary and hide mixed audit/documents',async()=>{
    const result=await snapshot();
    assert.equal(result.scopeLimited,true);assert.equal(result.canManageScopes,false);
    assert.deepEqual(result.vehicles.map(v=>v.id),[vehicleA.id]);assert.deepEqual(await rows('company_vehicles'),[vehicleA.id]);
    assert.deepEqual(result.employees.map(e=>e.id),[id(40)]);assert.deepEqual(result.audit,[]);assert.deepEqual(result.documents,[]);
    assert.equal(result.entities.some(e=>e.id===entityA.id),true);assert.equal(result.entities.some(e=>e.id===entityB.id),false);
  });
  await test('linked inventory exposes only matching items, categories, locations and employees to limited actors',async()=>{
    await owner();
    await db.query("INSERT INTO inventory_categories VALUES($1,$3,'devices','Alpha'),($2,$3,'devices','Beta')",[id(70),id(71),id(10)]);
    await db.query("INSERT INTO inventory_locations VALUES($1,$3,'A'),($2,$3,'B')",[id(72),id(73),id(10)]);
    for(const [item,category,location] of [[80,70,72],[81,71,73],[82,70,72]]) await db.query("INSERT INTO inventory_items VALUES($1,$2,$3,$4,$5,'available')",[id(item),id(10),id(category),id(location),`Item ${item}`]);
    await actor();await resource('asset',{inventory_item_id:id(80),...contextA});await resource('asset',{inventory_item_id:id(81),...contextB});
    await actor(21);
    assert.deepEqual(await rows('inventory_items'),[id(80)]);assert.deepEqual(await rows('inventory_categories'),[id(70)]);assert.deepEqual(await rows('inventory_locations'),[id(72)]);
    const people=(await db.query('SELECT public.company_inventory_employee_choices($1) AS result',[id(10)])).rows[0].result;
    assert.deepEqual(people.map(p=>p.id),[id(40)]);
    assert.deepEqual((await db.query('UPDATE inventory_items SET name=$1 WHERE id=$2 RETURNING id',['Allowed',id(80)])).rows,[{id:id(80)}]);
    assert.deepEqual((await db.query('UPDATE inventory_items SET name=$1 WHERE id=$2 RETURNING id',['Forbidden',id(81)])).rows,[]);
    await assert.rejects(db.query("INSERT INTO inventory_items VALUES($1,$2,$3,$4,'New','available')",[id(83),id(10),id(70),id(72)]),/row-level security/);
    assert.deepEqual((await db.query("UPDATE inventory_categories SET label='Global' RETURNING id")).rows,[]);
  });
  await test('direct inventory writes cannot assign foreign personnel or mix return/assignment identities',async()=>{
    await db.query("INSERT INTO inventory_assignments(id,tenant_id,item_id,recipient_employee_id,status) VALUES($1,$2,$3,$4,'issued')",[id(85),id(10),id(80),id(40)]);
    await assert.rejects(db.query("INSERT INTO inventory_assignments(id,tenant_id,item_id,recipient_employee_id,status) VALUES($1,$2,$3,$4,'issued')",[id(86),id(10),id(80),id(42)]),/Personalzuordnung|row-level security/);
    await assert.rejects(db.query('UPDATE inventory_assignments SET responsible_employee_id=$1 WHERE id=$2',[id(42),id(85)]),/Personalzuordnung/);
    await assert.rejects(db.query('INSERT INTO inventory_return_records VALUES($1,$2,$3,$4,$5)',[id(90),id(10),id(80),id(85),id(42)]),/gehören nicht zusammen/);
    await assert.rejects(db.query('INSERT INTO inventory_damage_reports VALUES($1,$2,$3,NULL,$4)',[id(94),id(10),id(80),id(42)]),/Personalzuordnung/);
    await db.query('INSERT INTO inventory_return_records VALUES($1,$2,$3,$4,$5)',[id(90),id(10),id(80),id(85),id(40)]);
    await db.query("INSERT INTO inventory_audit_events VALUES($1,$2,'inventory_return',$3,$4) RETURNING id",[id(91),id(10),id(90),id(21)]);
    assert.deepEqual(await rows('inventory_return_records'),[id(90)]);
  });
  await test('portal inventory policy behavior stays intact while new company resources remain inaccessible',async()=>{
    await actor(22);assert.equal((await rows('inventory_items')).length,3);assert.deepEqual(await rows('company_vehicles'),[]);
    await assert.rejects(snapshot(),/Berechtigung/);
    await actor(20,10,{app_metadata:{role_key:'employee_portal'}});assert.equal((await rows('inventory_items')).length,3);assert.deepEqual(await rows('company_vehicles'),[]);
  });
  await test('ordinary manager onboarding and employee edits remain allowed without identity privilege escalation',async()=>{
    await owner();await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'office.employees.create'),($1,'office.employees.edit')",[id(2)]);
    await db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,'active',true)",[id(25),id(125),id(10),id(3)]);
    await actor();await scope(21,[],1,false);await actor(21);
    await db.query("INSERT INTO employees(id,tenant_id,first_name,last_name,status) VALUES($1,$2,'New','Employee','active')",[id(45),id(10)]);
    await db.query('UPDATE employees SET profile_id=$1 WHERE id=$2',[id(25),id(45)]);
    await db.query("UPDATE employees SET first_name='Changed' WHERE id=$1",[id(45)]);
    await assert.rejects(db.query('UPDATE employees SET profile_id=$1 WHERE id=$2',[id(21),id(45)]),/identity changes/);
  });
} finally { await db.close(); }

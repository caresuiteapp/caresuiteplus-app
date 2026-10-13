// Isolated PostgreSQL with synthetic identities. No network/remote connections.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const read = name => JSON.parse(readFileSync(new URL('../../docs/'+name,import.meta.url),'utf8'));
const objects=read('workflow-server-object-metadata-20261011.json');
const deletion=read('workflow-server-visit-delete-schema-metadata-20261011.json');
const core=read('workflow-server-core-schema-metadata-20261011.json');
const state=read('workflow-server-execution-state-schema-metadata-20261011.json');
const schema=read('workflow-server-schema-metadata-20261011.json');
const permission=read('workflow-server-permission-metadata-20261011.json');
const captured=read('workflow-server-write-rpc-metadata-20261011.json').functions.find(f=>f.name==='delete_assist_visit').definition;
const member=read('workflow-server-identity-helper-metadata-20261011.json').helpers.find(f=>f.name==='is_tenant_member').definition;
const draft=readFileSync(new URL('../../docs/workflow-server-visit-delete-draft.sql',import.meta.url),'utf8');
const db=new PGlite();
const ids={tenant:'10000000-0000-4000-8000-000000000001',foreignTenant:'10000000-0000-4000-8000-000000000002',
  user:'20000000-0000-4000-8000-000000000001',clientUser:'20000000-0000-4000-8000-000000000002',employeeUser:'20000000-0000-4000-8000-000000000003',
  profile:'30000000-0000-4000-8000-000000000001',role:'40000000-0000-4000-8000-000000000001',
  client:'50000000-0000-4000-8000-000000000001',employee:'60000000-0000-4000-8000-000000000001',
  visit:'70000000-0000-4000-8000-000000000001',legacy:'70000000-0000-4000-8000-000000000002',
  account:'80000000-0000-4000-8000-000000000001',transaction:'90000000-0000-4000-8000-000000000001'};
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('fixture.uid',true),'')::uuid$$;
 CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('fixture.tenant',true),'')::uuid$$;
 CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('fixture.portal',true),'')$$;
 CREATE FUNCTION platform_tenant_access_allowed(uuid,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;
 CREATE TABLE tenants(id uuid PRIMARY KEY);`);
const enums=new Map();
for(const row of objects.enums){const labels=enums.get(row.type)??[];labels.push(row.label);enums.set(row.type,labels);}
for(const [name,labels] of enums)await db.exec('CREATE TYPE public."'+name+'" AS ENUM ('+labels.map(quote).join(',')+');');
const tables=['roles','role_permissions','profiles','tenant_users','clients','employees','assignments','assist_visits',
 'client_budget_accounts','client_budget_transactions','assignment_budget_allocations','assist_time_events',
 'assist_visit_documentation','assist_visit_signatures','assist_visit_proofs','assist_visit_execution_state',
 'documentation_entries','signatures','time_entries','service_records'];
const sources=[deletion,state,core,objects,schema,permission];
for(const table of tables){
 let columns=[];
 for(const source of sources){columns=source.columns.filter(c=>c.table?.replace('public.','')===table);if(columns.length)break;}
 assert.ok(columns.length,'Captured columns required: '+table);
 const definitions=columns.map(c=>{
   const name=c.column??c.name;
   const type=c.udt_name??c.type;
   const defaultValue=c.column_default??c.default;
   const actualType=type==='ARRAY' ? /::([a-z_]+\[\])/.exec(defaultValue??'')?.[1]
     : type==='USER-DEFINED' ? (c.udt_name??(/::([a-z_]+)/.exec(defaultValue??'')?.[1])??(name==='product_key'?'product_key':undefined))
     : type.startsWith('_')?type.slice(1)+'[]':type;
   assert.ok(actualType,'Confirmed type required: '+table+'.'+name);
   return '"'+name+'" '+actualType+(defaultValue?' DEFAULT '+defaultValue:'')+(name==='id'?' PRIMARY KEY':'');
 });
 // Catalogue-shaped columns, enums and CHECK/UNIQUE/FK contracts; required
 // business fields irrelevant to this endpoint remain nullable in the fixture.
 await db.exec('CREATE TABLE '+table+'('+definitions.join(',')+');');
}
await db.exec(`CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,is_active boolean);
 CREATE TABLE employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,status text);
 CREATE TABLE client_portal_access(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,portal_enabled boolean);
 CREATE TABLE assist_visit_tasks(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,status text,not_done_reason text);
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public,auth TO authenticated,anon;`);
const constraints=[...deletion.constraints,...state.constraints,...schema.constraints];
const constraintNames=new Set();
for(const constraint of constraints){
 if(!tables.includes(constraint.table)||constraint.type==='p'||constraint.definition.startsWith('PRIMARY KEY'))continue;
 if(constraintNames.has(constraint.name))continue;
 const reference=/REFERENCES (?:public\.)?(\w+)/.exec(constraint.definition)?.[1];
 if(reference&&!tables.includes(reference)&&reference!=='tenants')continue;
 if(!/^(CHECK|UNIQUE|FOREIGN KEY)/.test(constraint.definition))continue;
 await db.exec('ALTER TABLE '+constraint.table+' ADD CONSTRAINT "'+constraint.name+'" '+constraint.definition);
 constraintNames.add(constraint.name);
}
for(const table of [...tables,'assist_visit_tasks']){
 await db.exec('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY; CREATE POLICY synthetic_no_direct_delete ON '+table+' FOR SELECT TO authenticated USING(false);');
 await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON '+table+' TO authenticated;');
}
await db.exec(member);await db.exec(captured+';');
await db.exec('REVOKE ALL ON FUNCTION delete_assist_visit(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION delete_assist_visit(uuid,uuid) TO authenticated;');
async function actor(changes={}){
 const values={uid:ids.user,tenant:ids.tenant,portal:'business',...changes};
 await db.exec('RESET ROLE');
 for(const [key,value] of Object.entries(values))await db.query('SELECT set_config($1,$2,false)',['fixture.'+key,value??'']);
 await db.exec('SET ROLE authenticated');
}
async function insert(table,row){
 const keys=Object.keys(row);await db.query('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
}
async function reset(){
 await db.exec('RESET ROLE; DROP TRIGGER IF EXISTS synthetic_delete_failure ON assignments; TRUNCATE tenants,'+tables.join(',')+',tenant_memberships,employee_portal_accounts,client_portal_access,assist_visit_tasks CASCADE;');
 for(const id of [ids.tenant,ids.foreignTenant])await insert('tenants',{id});
 await insert('roles',{id:ids.role,tenant_id:ids.tenant,key:'office',name:'Office',is_admin_role:false});
 await insert('profiles',{id:ids.profile,auth_user_id:ids.user,tenant_id:ids.tenant,role_id:ids.role,status:'active',is_active:true});
 await insert('tenant_users',{id:ids.profile,tenant_id:ids.tenant,auth_user_id:ids.user,status:'active',must_change_password:false,first_login_completed:true});
 await insert('clients',{id:ids.client,tenant_id:ids.tenant});await insert('employees',{id:ids.employee,tenant_id:ids.tenant});
 await insert('assignments',{id:ids.legacy,tenant_id:ids.tenant,client_id:ids.client,employee_id:ids.employee,status:'planned'});
 await insert('assist_visits',{id:ids.visit,tenant_id:ids.tenant,legacy_assignment_id:ids.legacy,client_id:ids.client,employee_id:ids.employee,
  planning_status:'draft',execution_status:'pending',documentation_status:'none',proof_status:'none',billing_status:'reserved',canonical_status:'planned'});
 await insert('client_budget_accounts',{id:ids.account,tenant_id:ids.tenant,client_id:ids.client,allocated_cents:1000,used_cents:200,reserved_cents:100});
 await insert('client_budget_transactions',{id:ids.transaction,tenant_id:ids.tenant,client_id:ids.client,budget_account_id:ids.account,
  transaction_type:'reservation',amount_cents:100,reference_type:'assist_visit',reference_id:ids.visit,lifecycle_status:'geplant'});
 await insert('assignment_budget_allocations',{tenant_id:ids.tenant,assignment_id:ids.visit,client_id:ids.client,budget_account_id:ids.account,
  allocation_status:'reserved',planned_amount_cents:100,reserved_amount_cents:100});
 await insert('employee_portal_accounts',{id:ids.employee,tenant_id:ids.tenant,auth_user_id:ids.employeeUser,status:'active'});
 await insert('client_portal_access',{id:ids.client,tenant_id:ids.tenant,auth_user_id:ids.clientUser,portal_enabled:true});
 await actor();
}
async function admin(sql,params=[]){await db.exec('RESET ROLE');const result=await db.query(sql,params);await db.exec('SET ROLE authenticated');return result.rows;}
const remove=(tenant=ids.tenant,visit=ids.visit)=>db.query('SELECT delete_assist_visit($1,$2) AS receipt',[tenant,visit]);
async function snapshot(){
 await db.exec('RESET ROLE');const data={};
 for(const table of ['assist_visits','assignments','client_budget_accounts','client_budget_transactions','assignment_budget_allocations',
  'assist_time_events','assist_visit_documentation','assist_visit_signatures','assist_visit_proofs','assist_visit_execution_state','documentation_entries','signatures','time_entries','service_records','assist_visit_tasks'])data[table]=(await db.query('SELECT * FROM '+table+' ORDER BY id')).rows;
 await db.exec('SET ROLE authenticated');return data;
}
async function deny(changes={},tenant=ids.tenant,visit=ids.visit){
 await actor(changes);const before=await snapshot();await assert.rejects(()=>remove(tenant,visit));assert.deepEqual(await snapshot(),before);
}
async function grantManage(){await admin("INSERT INTO role_permissions(tenant_id,role_id,permission_key) VALUES($1,$2,'assist.assignments.manage')",[ids.tenant,ids.role]);}

await test('captured production body reproduces portal deletion of completed evidence and performed budget',async()=>{
 for(const portal of ['client','employee']){
  await reset();await admin("UPDATE assist_visits SET execution_status='completed',canonical_status='completed',proof_status='signed',actual_start_at=now()-interval '1 hour',actual_end_at=now()");
  await admin("UPDATE client_budget_transactions SET lifecycle_status='durchgefuehrt'");
  await admin('UPDATE client_budget_accounts SET reserved_cents=0');
  await admin("INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,'service_end',now())",[ids.tenant,ids.visit]);
  await actor({portal,uid:portal==='client'?ids.clientUser:ids.employeeUser});
  assert.equal((await remove()).rows[0].receipt.deleted,true);
  const after=await snapshot();assert.equal(after.assist_visits.length,0);assert.equal(after.assignments.length,0);
  assert.equal(after.assist_time_events.length,0);assert.equal(after.client_budget_accounts[0].used_cents,100);
 }
});
await test('review draft applies twice without modifying any business row',async()=>{
 await reset();const before=await snapshot();await db.exec('RESET ROLE');await db.exec(draft);await db.exec(draft);assert.deepEqual(await snapshot(),before);
});
await test('null auth, client/employee/relative portals and missing bound profile deny without writes',async()=>{
 await reset();await grantManage();
 for(const changes of [{uid:''},{portal:'client',uid:ids.clientUser},{portal:'employee',uid:ids.employeeUser},{portal:'relative'},
  {portal:'business',uid:ids.clientUser}])await deny(changes);
});
await test('cross-tenant membership and spoofed current tenant cannot borrow permission',async()=>{
 await reset();await grantManage();await admin('INSERT INTO tenant_memberships VALUES($1,$2,true)',[ids.foreignTenant,ids.user]);
 await deny({},ids.foreignTenant);await deny({tenant:ids.foreignTenant},ids.foreignTenant);
 await deny({tenant:ids.foreignTenant},ids.tenant);await deny({tenant:''});await deny({},null);await deny({},ids.tenant,null);
});
await test('Office requires the exact role-bound planning action, active profile and ready account',async()=>{
 await reset();await deny();await admin("INSERT INTO role_permissions(tenant_id,role_id,permission_key) VALUES($1,$2,'office.clients.edit')",[ids.tenant,ids.role]);await deny();
 await grantManage();for(const update of ["UPDATE profiles SET status='invited'","UPDATE profiles SET is_active=false", "UPDATE tenant_users SET status='blocked'", "UPDATE tenant_users SET must_change_password=true", "UPDATE tenant_users SET first_login_completed=false"]){
  await reset();await grantManage();await admin(update);await deny();
 }
});
await test('profile/Auth collision and foreign role/permission bindings deny without mutation',async()=>{
 await reset();await grantManage();await admin('UPDATE profiles SET id=$1,auth_user_id=$2',[ids.user,ids.clientUser]);await deny();
 await reset();await grantManage();await admin('UPDATE roles SET tenant_id=$1',[ids.foreignTenant]);await deny();
 await reset();await grantManage();await admin('UPDATE role_permissions SET tenant_id=$1',[ids.foreignTenant]);await deny();
});
await test('begun/final status dimensions and canonical/legacy times block even an authorized business user',async()=>{
 for(const [table,expression] of [['assist_visits',"execution_status='completed'"],['assist_visits',"canonical_status='cancelled'"],['assist_visits',"documentation_status='completed'"],
  ['assist_visits',"proof_status='signed'"],['assist_visits',"billing_status='billed'"],['assist_visits',"on_the_way_at=now()"],['assignments',"actual_start_at=now()"],['assignments',"documentation_notes='Gespeicherte Leistung'"]]){
  await reset();await grantManage();await admin('UPDATE '+table+' SET '+expression);await deny();
 }
});
await test('canonical/legacy evidence and handed-off service records are retained',async()=>{
 const records=[['assist_time_events',{event_type:'service_start',occurred_at:new Date().toISOString()}],['assist_visit_documentation',{short_description:'Leistung'}],
  ['assist_visit_signatures',{signer_name:'Synthetic',storage_path:'synthetic.png',payload_hash:'hash',signature_hash:'hash'}],['assist_visit_proofs',{status:'draft',portal_release_status:'none'}],
  ['documentation_entries',{assignment_id:ids.legacy}],['signatures',{assignment_id:ids.legacy}],['time_entries',{assignment_id:ids.legacy,entry_type:'started'}],['service_records',{assignment_id:ids.legacy}]];
 for(const [table,fields] of records){await reset();await grantManage();await db.exec('RESET ROLE');
  await insert(table,{tenant_id:ids.tenant,...(table.startsWith('assist_')?{visit_id:ids.visit}:{}),...fields});await deny();}
});
await test('actual execution-state evidence and completed tasks cannot be erased',async()=>{
 for(const field of [{service_started_at:new Date().toISOString()},{travel_started_at:new Date().toISOString()},{signature_complete:true},
  {proof_generated:true},{current_step:'documentation'},{metadata:{consentAccepted:true}}]){
  await reset();await grantManage();await db.exec('RESET ROLE');await insert('assist_visit_execution_state',{tenant_id:ids.tenant,visit_id:ids.visit,...field});await deny();
 }
 await reset();await grantManage();await db.exec('RESET ROLE');await insert('assist_visit_tasks',{id:ids.employee,tenant_id:ids.tenant,visit_id:ids.visit,status:'done'});await deny();
});
await test('performed/invoiced/finalized or inconsistent budget cannot be reset',async()=>{
 for(const statement of ["UPDATE client_budget_transactions SET lifecycle_status='durchgefuehrt'", "UPDATE client_budget_transactions SET lifecycle_status='abgerechnet'",
  "UPDATE client_budget_transactions SET invoice_id='10000000-0000-4000-8000-000000000003'", "UPDATE client_budget_transactions SET transaction_type='usage'",
  "UPDATE assignment_budget_allocations SET allocation_status='executed'", "UPDATE assignment_budget_allocations SET allocation_status='finalized'",
  'UPDATE client_budget_accounts SET reserved_cents=99', 'DELETE FROM client_budget_transactions',
  "UPDATE client_budget_accounts SET tenant_id='10000000-0000-4000-8000-000000000002'"]){await reset();await grantManage();await admin(statement);await deny();}
});
await test('foreign client/employee/mirror binding and another visit sharing its mirror deny',async()=>{
 for(const table of ['clients','employees','assignments','assist_visits']){await reset();await grantManage();await admin('UPDATE '+table+' SET tenant_id=$1',[ids.foreignTenant]);await deny();}
 await reset();await grantManage();await admin('INSERT INTO assist_visits(id,tenant_id,legacy_assignment_id) VALUES($1,$2,$3)',[ids.user,ids.tenant,ids.legacy]);await deny();
});
await test('allowed planning deletion releases only reservations and repeats without another release',async()=>{
 await reset();await grantManage();const first=(await remove()).rows[0].receipt;
 assert.deepEqual(first,{deleted:true,visitId:ids.visit,legacyAssignmentId:ids.legacy,budgetReservationsReleased:1,alreadyDeleted:false});
 const after=await snapshot();assert.equal(after.assist_visits.length,0);assert.equal(after.assignments.length,0);
 assert.equal(after.client_budget_accounts[0].used_cents,200);assert.equal(after.client_budget_accounts[0].reserved_cents,0);
 assert.equal(after.assignment_budget_allocations[0].allocation_status,'released');
 const release=after.client_budget_transactions.find(tx=>tx.transaction_type==='release');assert.equal(release.balance_after_cents,800);assert.equal(release.created_by,ids.profile);
 assert.equal((await remove()).rows[0].receipt.alreadyDeleted,true);assert.deepEqual(await snapshot(),after);
});
await test('verified tenant admin and captured legacy manage alias preserve permitted planning deletion',async()=>{
 await reset();await admin('UPDATE roles SET is_admin_role=true');assert.equal((await remove()).rows[0].receipt.deleted,true);
 await reset();await admin("INSERT INTO role_permissions(tenant_id,role_id,permission_key,can_update) VALUES($1,$2,'assignments',true)",[ids.tenant,ids.role]);assert.equal((await remove()).rows[0].receipt.deleted,true);
});
await test('late mirror-delete failure rolls every budget/source mutation back atomically',async()=>{
 await reset();await grantManage();await db.exec(`RESET ROLE;
 CREATE OR REPLACE FUNCTION synthetic_reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic late delete failure'; END$$;
 CREATE TRIGGER synthetic_delete_failure BEFORE DELETE ON assignments FOR EACH ROW EXECUTE FUNCTION synthetic_reject_delete(); SET ROLE authenticated;`);
 const before=await snapshot();await assert.rejects(()=>remove(),/synthetic late delete failure/);assert.deepEqual(await snapshot(),before);
});
await test('anon has no EXECUTE privilege',async()=>{await reset();await db.exec('SET ROLE anon');await assert.rejects(()=>remove(),/permission denied/);});
await db.close();

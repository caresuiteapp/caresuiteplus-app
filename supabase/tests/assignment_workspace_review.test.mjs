// Synthetic local PostgreSQL only; no remote connection or production records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyFixture, id } from './company_access_fixture.mjs';

const sql = readFileSync(new URL('../migrations/20261016082544_assignment_workspace_review.sql', import.meta.url), 'utf8');
const permissionSql = readFileSync(new URL('../patches/assignment_legacy_manage_permission.sql', import.meta.url), 'utf8');
const { db, actor, owner } = await companyFixture();
const tenant = id(10), foreignTenant = id(11), visit = id(60), assignment = id(61), account = id(70), portalAccount = id(80);
const captured = JSON.parse(readFileSync(new URL('../../docs/workflow-server-identity-helper-metadata-20261011.json', import.meta.url), 'utf8'));
const membership = captured.helpers.find(f => f.name === 'is_tenant_member').definition;

try {
  await owner();
  await db.exec(`
    CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,is_active boolean);
    CREATE TABLE employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
    CREATE TABLE client_portal_access(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,portal_enabled boolean);
    CREATE FUNCTION platform_tenant_access_allowed(uuid,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce(current_setting('fixture.platform',true),'true')<>'false'$$;
    CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$SELECT auth.jwt()->'app_metadata'->>'portal_type'$$;
    CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (auth.jwt()->'app_metadata'->>'portal_account_id')::uuid$$;
    CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (auth.jwt()->'app_metadata'->>'employee_id')::uuid$$;
    CREATE TYPE assignment_status AS ENUM ('planned','confirmed','on_the_way','arrived','started','paused','finished','documentation_open','signature_open','completed','cancelled','no_show');
    CREATE TYPE time_entry_type AS ENUM ('system','on_the_way','arrived','started','paused','finished');
    CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,client_id uuid,status assignment_status,
      actual_start_at timestamptz,actual_end_at timestamptz,updated_at timestamptz);
    CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,legacy_assignment_id uuid,canonical_status text,employee_id uuid,planning_status text,
      actual_start_at timestamptz,actual_end_at timestamptz,duration_minutes integer,documentation_status text,proof_status text,
      execution_status text,billing_status text,finished_at timestamptz,updated_by uuid,updated_at timestamptz);
    CREATE TABLE assist_visit_tasks(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid REFERENCES assist_visits(id) ON DELETE CASCADE,title text,sort_order integer,status text,is_required boolean,not_done_reason text,completed_at timestamptz,updated_at timestamptz);
    CREATE TABLE assignment_tasks(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,title text,sort_order integer,status text,is_required boolean,not_done_reason text,updated_at timestamptz);
    CREATE TABLE assist_visit_admin_audit(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,action text,previous_value jsonb,new_value jsonb,reason text,created_at timestamptz DEFAULT now());
    CREATE TABLE assist_visit_signature_requests(tenant_id uuid,visit_id uuid,status text);
    CREATE TABLE assist_visit_proofs(tenant_id uuid,visit_id uuid,portal_visible boolean,portal_release_status text,signature_id uuid,updated_at timestamptz);
    CREATE TABLE assist_visit_execution_state(tenant_id uuid,visit_id uuid,finalized_at timestamptz,signature_complete boolean,proof_generated boolean,updated_at timestamptz);
    CREATE TABLE assist_visit_documentation(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,short_description text,submitted_at timestamptz,locked boolean,metadata jsonb,updated_at timestamptz);
    CREATE FUNCTION is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce($1=public.current_tenant_id() AND public.current_portal_type()='employee',false)$$;
    CREATE FUNCTION resolve_current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT care_security.company_profile(public.current_tenant_id())$$;
    CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT care_security.company_rbac_administrator(public.current_tenant_id())$$;
    CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT care_security.company_actor(public.current_tenant_id(),$1)$$;
    CREATE TABLE client_budget_accounts(id uuid PRIMARY KEY,tenant_id uuid,allocated_cents bigint,used_cents bigint,reserved_cents bigint,updated_at timestamptz);
    CREATE TABLE client_budget_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,client_id uuid,budget_account_id uuid,
      reference_type text,reference_id uuid,transaction_type text,lifecycle_status text,amount_cents bigint,balance_after_cents bigint,note text,created_by uuid);
    CREATE TABLE assignment_budget_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid,
      allocation_status text,reserved_amount_cents bigint,updated_at timestamptz);
    CREATE TABLE assist_visit_signatures(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid REFERENCES assist_visits(id) ON DELETE CASCADE,is_valid boolean DEFAULT true,invalidated_at timestamptz,invalidation_reason text,updated_at timestamptz);
    CREATE TABLE time_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid,employee_id uuid,entry_type time_entry_type,
      event_at timestamptz,latitude numeric,longitude numeric,source text,note text CHECK(note IS DISTINCT FROM 'synthetic failure'));
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public,auth TO authenticated,anon;
  `);
  await db.exec(membership);
  for (const table of ['assignments','assist_visits','client_budget_accounts','client_budget_transactions','assignment_budget_allocations','assist_visit_signatures','time_entries']) {
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated; CREATE POLICY no_direct_access ON ${table} TO authenticated USING(false) WITH CHECK(false)`);
  }
  // Start with an intentionally broad same-tenant table grant: restrictive
  // ceilings must still block signed/final writes in either task store.
  for (const table of ['assist_visit_tasks','assignment_tasks']) {
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated; CREATE POLICY old_task_tenant_access ON ${table} TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id())`);
  }
  await db.exec(readFileSync(new URL('../migrations/20260911210000_admin_task_counterpart_matching.sql', import.meta.url), 'utf8'));
  const documentGuard = readFileSync(new URL('../migrations/20260906100000_employee_open_visit_time_edit.sql', import.meta.url), 'utf8').match(/CREATE OR REPLACE FUNCTION public\.guard_employee_open_visit_documentation\(\)[\s\S]*?FOR EACH ROW EXECUTE FUNCTION public\.guard_employee_open_visit_documentation\(\);/)?.[0];
  assert.ok(documentGuard, 'Existing production documentation correction trigger is present');
  await db.exec(documentGuard);
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'assist.assignments.manage'),($1,'assist.execution.manage'),($2,'assist.assignments.manage')", [id(2),id(3)]);
  await db.exec(sql);
  await db.exec(permissionSql);

  async function reset() {
    await owner();
    await db.exec(`DROP TRIGGER IF EXISTS reject_mirror_delete ON assignments;
      TRUNCATE assist_visit_signatures,assist_visit_tasks,assignment_tasks,assist_visit_admin_audit,assist_visit_proofs,assist_visit_signature_requests,assist_visit_documentation,assist_visit_execution_state,assist_visits,assignments,client_budget_accounts,client_budget_transactions,assignment_budget_allocations,time_entries,employee_portal_accounts,tenant_memberships,client_portal_access;
      DELETE FROM employee_permission_overrides; DELETE FROM employee_data_scopes; DELETE FROM company_scope_profiles;
      UPDATE profiles SET status='active',is_active=true; UPDATE employees SET status='active',deleted_at=NULL;
      SELECT set_config('fixture.platform','true',false);`);
    await db.query("INSERT INTO assignments VALUES($1,$2,$3,$4,'planned',NULL,NULL,now())", [assignment,tenant,id(41),id(90)]);
    await db.query("INSERT INTO assist_visits(id,tenant_id,legacy_assignment_id,canonical_status,proof_status,employee_id,planning_status) VALUES($1,$2,$3,'planned','none',$4,'confirmed')", [visit,tenant,assignment,id(41)]);
    await db.query('INSERT INTO client_budget_accounts VALUES($1,$2,1000,200,100,now())', [account,tenant]);
    await db.query("INSERT INTO client_budget_transactions(tenant_id,client_id,budget_account_id,reference_type,reference_id,transaction_type,lifecycle_status,amount_cents) VALUES($1,$2,$3,'assist_visit',$4,'reservation','geplant',100)", [tenant,id(90),account,visit]);
    await db.query("INSERT INTO assignment_budget_allocations(tenant_id,assignment_id,allocation_status,reserved_amount_cents) VALUES($1,$2,'reserved',100)", [tenant,visit]);
    await db.query("INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,'active')", [portalAccount,tenant,id(41),id(122)]);
    await actor(21);
  }
  async function admin(query, params=[]) { await db.exec('RESET ROLE'); const result=await db.query(query,params); await db.exec('SET ROLE authenticated'); return result.rows; }
  const remove=(t=tenant,v=visit)=>db.query('SELECT public.delete_assist_visit($1,$2) receipt',[t,v]);
  const status=(next='on_the_way',options={})=>db.query('SELECT public.set_assignment_status($1,$2,$3,NULL,NULL,$4) receipt',[options.assignment??assignment,next,options.employee??null,options.note??null]);
  const portal=(changes={})=>actor(22,10,{app_metadata:{portal_type:'employee',portal_account_id:portalAccount,employee_id:id(41),...changes}});
  async function snapshot(){ const result={}; for(const table of ['assignments','assist_visits','client_budget_accounts','client_budget_transactions','assignment_budget_allocations','assist_visit_signatures','time_entries','assist_visit_tasks','assignment_tasks','assist_visit_admin_audit']) result[table]=await admin(`SELECT * FROM ${table} ORDER BY id`); return result; }
  async function deny(call){ const before=await snapshot(); await assert.rejects(call,/Berechtigung|Anmeldung|zugeordnet|Zuordnung|Mandant|permission denied|erforderlich|nicht gefunden/i); assert.deepEqual(await snapshot(),before); }
  async function pairTasks() {
    await admin("INSERT INTO assist_visit_tasks(id,tenant_id,visit_id,title,sort_order,status,is_required) VALUES($1,$2,$3,'Kontrolle',1,'open',true)",[id(150),tenant,visit]);
    await admin("INSERT INTO assignment_tasks(id,tenant_id,assignment_id,title,sort_order,status,is_required) VALUES($1,$2,$3,'Kontrolle',1,'open',true)",[id(151),tenant,assignment]);
  }
  const single=()=>db.query('SELECT public.admin_update_assist_visit_task($1,$2,$3,$4)',[visit,id(150),'done','Verwaltung geprüft']);
  const bulk=()=>db.query('SELECT public.admin_bulk_update_assist_visit_tasks($1,$2,$3) result',[visit,JSON.stringify([{task_id:id(151),status:'done'}]),'Verwaltung geprüft']);
  const finish=()=>db.query('SELECT public.admin_reconcile_complete_assist_visit_follow_up($1,$2,$3)',[visit,JSON.stringify([{task_id:id(151),status:'done'}]),'Abschluss geprüft']);

  await test('migration is repeatable and leaves all business rows untouched',async()=>{await reset(); const before=await snapshot(); await owner(); await db.exec(sql); await db.exec(sql); await db.exec(permissionSql); await db.exec(permissionSql); assert.deepEqual(await snapshot(),before);});
  await test('authorized planning deletion releases budget, deletes its exact mirror and cascades atomically',async()=>{
    await reset(); const receipt=(await remove()).rows[0].receipt;
    assert.deepEqual(receipt,{deleted:true,visitId:visit,legacyAssignmentId:assignment,budgetReservationsReleased:1});
    const after=await snapshot(); assert.equal(after.assist_visits.length,0);assert.equal(after.assignments.length,0);
    assert.equal(after.client_budget_accounts[0].reserved_cents,0); assert.equal(after.client_budget_accounts[0].used_cents,200);
    assert.equal(after.assignment_budget_allocations[0].allocation_status,'released'); assert.equal(after.client_budget_transactions.filter(x=>x.transaction_type==='release').length,1);
  });
  await test('legacy assignment management authorizes the same atomic deletion without requiring a newly seeded exact key',async()=>{
    await reset();
    await admin("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='assist.assignments.manage'",[id(2)]);
    try {
      await admin("INSERT INTO role_permissions(role_id,permission_key,can_view,can_update,can_delete) VALUES($1,'assignments',true,true,false)",[id(2)]);
      const receipt=(await remove()).rows[0].receipt;
      assert.equal(receipt.deleted,true);
      const after=await snapshot();
      assert.equal(after.assist_visits.length,0);
      assert.equal(after.assignments.length,0);
      assert.equal(after.client_budget_accounts[0].reserved_cents,0);
      assert.equal(after.client_budget_transactions.filter(row=>row.transaction_type==='release').length,1);
    } finally {
      await admin("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='assignments'",[id(2)]);
      await admin("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'assist.assignments.manage')",[id(2)]);
    }
  });
  await test('legacy assignment management still respects read-only flags, tenant role replacements, explicit denies and scope',async()=>{
    await reset();
    await admin("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='assist.assignments.manage'",[id(2)]);
    try {
      await admin("INSERT INTO role_permissions(role_id,permission_key,can_view,can_update,can_delete) VALUES($1,'assignments',true,false,true)",[id(2)]);
      await deny(()=>remove());
      await admin("UPDATE role_permissions SET can_update=true WHERE role_id=$1 AND permission_key='assignments'",[id(2)]);
      await admin("UPDATE role_permissions SET tenant_id=$1 WHERE role_id=$2 AND permission_key='assignments'",[foreignTenant,id(2)]);
      await deny(()=>remove());
      await admin("UPDATE role_permissions SET tenant_id=NULL WHERE role_id=$1 AND permission_key='assignments'",[id(2)]);
      await admin("INSERT INTO role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'business_manager','assist.assignments.view')",[tenant]);
      await deny(()=>remove());
      await admin("DELETE FROM role_permission_sets WHERE tenant_id=$1 AND role_key='business_manager'",[tenant]);
      await admin("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'assist.assignments.manage',false)",[tenant,id(40)]);
      await deny(()=>remove());
      await admin('DELETE FROM employee_permission_overrides');
      await admin('INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,updated_by) VALUES($1,$2,true,$2)',[tenant,id(21)]);
      await deny(()=>remove());
      await deny(()=>remove(foreignTenant));
      await admin('DELETE FROM company_scope_profiles');
      await portal();
      await deny(()=>remove());
    } finally {
      await admin("DELETE FROM role_permission_sets WHERE tenant_id=$1 AND role_key='business_manager'",[tenant]);
      await admin('DELETE FROM employee_permission_overrides');
      await admin('DELETE FROM company_scope_profiles');
      await admin("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='assignments'",[id(2)]);
      await admin("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'assist.assignments.manage')",[id(2)]);
    }
  });
  await test('existing authorized deletion of completed work keeps the established performed-budget and evidence semantics',async()=>{
    await reset(); await admin("UPDATE assist_visits SET canonical_status='completed'"); await admin("UPDATE client_budget_transactions SET lifecycle_status='durchgefuehrt'");
    await admin('UPDATE client_budget_accounts SET reserved_cents=0'); await admin('INSERT INTO assist_visit_signatures(id,tenant_id,visit_id) VALUES($1,$2,$3)',[id(91),tenant,visit]);
    assert.equal((await remove()).rows[0].receipt.deleted,true); const after=await snapshot(); assert.equal(after.assist_visit_signatures.length,0);assert.equal(after.client_budget_accounts[0].used_cents,100);
  });
  await test('portal membership does not grant deletion, including an otherwise valid own employee account',async()=>{
    await reset(); await portal(); await deny(()=>remove());
    await actor(22,10,{app_metadata:{portal_type:'client'}}); await deny(()=>remove());
    await actor(21,10,{app_metadata:{portal_type:'employee'}}); await deny(()=>remove());
  });
  await test('missing permissions, explicit denies, inactive profiles and limited company scope cannot delete or set status',async()=>{
    await reset(); await actor(23); await deny(()=>remove()); await deny(()=>status());
    await actor(21); await admin("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'assist.assignments.manage',false),($1,$2,'assist.execution.manage',false)",[tenant,id(40)]);
    await deny(()=>remove()); await deny(()=>status());
    await reset(); await admin("UPDATE profiles SET is_active=false WHERE id=$1",[id(21)]); await deny(()=>remove()); await deny(()=>status());
    await reset(); await admin("INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,updated_by) VALUES($1,$2,true,$2)",[tenant,id(21)]); await deny(()=>remove()); await deny(()=>status());
  });
  await test('tenant mismatch, null identity and platform suspension fail without writes',async()=>{
    await reset(); await deny(()=>remove(foreignTenant)); await actor(21,11); await deny(()=>remove()); await deny(()=>status());
    await actor(24,11); await deny(()=>remove(tenant)); await deny(()=>status());
    await actor(21); await admin("SELECT set_config('fixture.platform','false',false)"); await deny(()=>remove()); await deny(()=>status());
    await reset(); await admin("SELECT set_config('fixture.uid','',false)"); await deny(()=>remove()); await deny(()=>status());
  });
  await test('authorized business planning and execution retain the current status writer and exact event receipt',async()=>{
    await reset(); assert.equal((await status('confirmed')).rows[0].receipt,assignment);
    await admin("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'assist.assignments.manage',false)",[tenant,id(40)]);
    assert.equal((await status('on_the_way')).rows[0].receipt,assignment);
    const after=await snapshot(); assert.equal(after.assignments[0].status,'on_the_way'); assert.equal(after.time_entries.length,2); assert.ok(after.time_entries.every(e=>e.employee_id===id(41)&&e.tenant_id===tenant));
    await deny(()=>remove());
  });
  await test('active own employee portal preserves start, pause and finish lifecycle while deletion stays forbidden',async()=>{
    await reset(); await portal(); for(const next of ['on_the_way','arrived','started','paused','started','finished'])assert.equal((await status(next)).rows[0].receipt,assignment);
    const after=await snapshot();assert.equal(after.assignments[0].status,'finished');assert.ok(after.assignments[0].actual_start_at);assert.ok(after.assignments[0].actual_end_at);assert.equal(after.time_entries.length,6);await deny(()=>remove());
  });
  await test('portal JWT claims alone, foreign employee or account, disabled account and inactive linked staff cannot change status',async()=>{
    for(const changes of [{employee_id:id(40)},{portal_account_id:id(81)},{portal_type:'client'}]){await reset();await portal(changes);await deny(()=>status());}
    for(const query of ["UPDATE employee_portal_accounts SET status='disabled'","UPDATE employee_portal_accounts SET auth_user_id='00000000-0000-4000-8000-000000000121'","UPDATE employees SET status='inactive' WHERE id='00000000-0000-4000-8000-000000000041'","UPDATE employees SET deleted_at=now() WHERE id='00000000-0000-4000-8000-000000000041'","UPDATE profiles SET is_active=false WHERE id='00000000-0000-4000-8000-000000000022'","UPDATE assignments SET employee_id='00000000-0000-4000-8000-000000000040'","UPDATE assignments SET tenant_id='00000000-0000-4000-8000-000000000011'"]){await reset();await admin(query);await portal();await deny(()=>status());}
    await reset();await portal();await deny(()=>status('on_the_way',{employee:id(40)}));
  });
  await test('late event failure and mirror deletion failure roll back their entire transaction',async()=>{
    await reset();const before=await snapshot();await assert.rejects(()=>status('started',{note:'synthetic failure'}),/check constraint/);assert.deepEqual(await snapshot(),before);
    await admin(`CREATE OR REPLACE FUNCTION reject_mirror_delete() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic late failure'; END$$`);
    await admin('CREATE TRIGGER reject_mirror_delete BEFORE DELETE ON assignments FOR EACH ROW EXECUTE FUNCTION reject_mirror_delete()');
    await assert.rejects(()=>remove(),/synthetic late failure/);assert.deepEqual(await snapshot(),before);
  });
  await test('all six task ceilings protect signed and final rows despite broad legacy grants',async()=>{
    for(const state of ["proof_status='signed'","proof_status='verified'","canonical_status='completed'","canonical_status='cancelled'","canonical_status='no_show'"]){
      await reset();await pairTasks();
      assert.equal((await db.query("UPDATE assist_visit_tasks SET status='done' RETURNING id")).rows.length,1);
      assert.equal((await db.query("UPDATE assignment_tasks SET status='done' RETURNING id")).rows.length,1);
      await admin('UPDATE assist_visits SET '+state);
      for(const [table,parent] of [['assist_visit_tasks','visit_id'],['assignment_tasks','assignment_id']]){
        assert.equal((await db.query(`UPDATE ${table} SET status='open' RETURNING id`)).rows.length,0);
        assert.equal((await db.query(`DELETE FROM ${table} RETURNING id`)).rows.length,0);
        await assert.rejects(()=>db.query(`INSERT INTO ${table}(id,tenant_id,${parent},status) VALUES($1,$2,$3,'open')`,[id(152),tenant,parent==='visit_id'?visit:assignment]),/row-level security/);
      }
    }
    await reset();await pairTasks();await admin('INSERT INTO assist_visit_signatures(id,tenant_id,visit_id) VALUES($1,$2,$3)',[id(91),tenant,visit]);
    assert.equal((await db.query("UPDATE assist_visit_tasks SET status='done' RETURNING id")).rows.length,0,'actual signature protects an outdated none status too');
  });
  await test('existing employee documentation correction invalidates old signature then unlocks tasks before the new signature',async()=>{
    await reset();await pairTasks();
    await admin("UPDATE assist_visits SET canonical_status='signature_open',proof_status='signed'");
    await admin("UPDATE assignments SET status='signature_open',actual_start_at=now()-interval '1 hour',actual_end_at=now()");
    await admin('INSERT INTO assist_visit_signatures(id,tenant_id,visit_id) VALUES($1,$2,$3)',[id(91),tenant,visit]);
    await admin("INSERT INTO assist_visit_documentation(tenant_id,visit_id,short_description) VALUES($1,$2,'Alte Fassung')",[tenant,visit]);
    await portal();
    assert.equal((await db.query("UPDATE assignment_tasks SET status='done' RETURNING id")).rows.length,0);
    // Run the actual pre-existing documentation trigger with the portal JWT.
    await admin("UPDATE assist_visit_documentation SET short_description='Neue Fassung',submitted_at=now()");
    assert.equal((await admin('SELECT is_valid FROM assist_visit_signatures'))[0].is_valid,false);
    assert.equal((await db.query("UPDATE assignment_tasks SET status='done' RETURNING id")).rows.length,1);
    await admin('INSERT INTO assist_visit_signatures(id,tenant_id,visit_id) VALUES($1,$2,$3)',[id(92),tenant,visit]);
    assert.equal((await db.query("UPDATE assignment_tasks SET status='open' RETURNING id")).rows.length,0);
    assert.equal((await status('completed')).rows[0].receipt,assignment,'finalization changes status, not signed tasks');
  });
  await test('all three authorized administrative task paths retain audited correction and repeated finalization',async()=>{
    await reset();await pairTasks();await admin("UPDATE assist_visits SET proof_status='signed',canonical_status='signature_open',actual_start_at=now()-interval '1 hour',actual_end_at=now(),duration_minutes=60,documentation_status='complete'");
    await single();assert.equal((await admin('SELECT status FROM assist_visit_tasks'))[0].status,'done');
    assert.equal((await bulk()).rows[0].result.updated,1);assert.equal((await bulk()).rows[0].result.updated,0);
    await finish();await finish();
    const after=await snapshot();assert.equal(after.assist_visits[0].canonical_status,'completed');assert.equal(after.assist_visits[0].proof_status,'signed');
    assert.equal(after.assignments[0].status,'completed');assert.ok(after.assist_visit_admin_audit.some(a=>a.action==='task_updated'));assert.ok(after.assist_visit_admin_audit.some(a=>a.action==='follow_up_completed_reconciled'));
  });
  await test('task administration rejects missing, denied, inactive, portal and scoped authority for every entry point',async()=>{
    const callers=[()=>actor(23),()=>portal(),()=>actor(24,11),
      async()=>{await actor(21);await admin("INSERT INTO employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'assist.execution.manage',false)",[tenant,id(40)]);},
      async()=>{await actor(21);await admin('UPDATE profiles SET is_active=false WHERE id=$1',[id(21)]);},
      async()=>{await actor(21);await admin('INSERT INTO company_scope_profiles(tenant_id,profile_id,scope_limited,updated_by) VALUES($1,$2,true,$2)',[tenant,id(21)]);},
      async()=>{await actor(21);await admin("SELECT set_config('fixture.platform','false',false)");}];
    for(const caller of callers){await reset();await pairTasks();await caller();for(const call of [single,bulk,finish])await deny(call);}
    await reset();await pairTasks();await admin('UPDATE assist_visits SET tenant_id=$1',[foreignTenant]);for(const call of [single,bulk,finish]){const before=await snapshot();await assert.rejects(call,/nicht gefunden/);assert.deepEqual(await snapshot(),before);}
  });
  await test('failed administrative completion rolls back task reconciliation and audit',async()=>{
    await reset();await pairTasks();const before=await snapshot();await assert.rejects(finish,/Ist-Zeiten fehlen/);assert.deepEqual(await snapshot(),before);
  });
  await test('anonymous callers have no execute privilege on either RPC',async()=>{
    await reset(); await db.exec('SET ROLE anon');for(const call of [remove,status,single,bulk,finish])await assert.rejects(()=>call(),/permission denied/);
  });
} finally {await db.close();}

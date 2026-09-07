/* Isolated PostgreSQL behavior tests. No connection to production. */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID: uuid } = require('node:crypto');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/desktop-support-schema.json'),'utf8'));
const migrations = ['20260907170000_atomic_free_company_registration.sql','20260907171000_support_tickets_and_consent.sql','20260907172000_support_attachments_and_workspace.sql','20260907173000_platform_company_directory.sql'];
const db = new PGlite();
let passed=0;
async function test(name,run){await run();passed++;process.stdout.write(`PASS ${name}\n`);}
async function scalar(sql,args=[]){return (await db.query(sql,args)).rows[0]?.value;}
async function asUser(user,sql,args=[],role='authenticated'){
  await db.query("SELECT set_config('test.actor',$1,false)",[user??'']);
  await db.exec(`SET ROLE ${role}`);
  try{return await scalar(sql,args);}finally{await db.exec('RESET ROLE');}
}
(async()=>{
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;
    CREATE TYPE product_key AS ENUM('office','assist','pflege','beratung','akademie','stationaer');
    CREATE TYPE profile_status AS ENUM('invited','active','inactive','locked');
    CREATE TYPE theme_mode AS ENUM('system','light','dark');`);
  const enums={};for(const row of fixture.extra.enums)(enums[row.type]??=[]).push(row.label);
  for(const [type,values] of Object.entries(enums))await db.exec(`CREATE TYPE ${type} AS ENUM(${values.map(v=>`'${v}'`).join(',')})`);
  const groups={};for(const col of fixture.columns)(groups[col.table]??=[]).push(col);
  for(const [table,cols] of Object.entries(groups)){
    const definitions=cols.map(c=>{
      let type=c.type;
      if(type==='USER-DEFINED')type=c.column.includes('product_key')?'product_key':c.default?.split('::').at(-1)||'text';
      if(type==='ARRAY')type='product_key[]';
      return `"${c.column}" ${type}${c.nullable==='NO'?' NOT NULL':''}${c.default?' DEFAULT '+c.default:''}`;
    });
    await db.exec(`CREATE TABLE public.${table}(${definitions.join(',')})`);
  }
  for(const c of fixture.constraints.filter(c=>!c.definition.startsWith('FOREIGN KEY'))){await db.exec(`ALTER TABLE public.${c.table} ADD CONSTRAINT ${c.name} ${c.definition}`);}
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS platform_tenant_modules_tenant_id_module_key_key ON platform_tenant_modules(tenant_id,module_key); CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_tenant_id_email_key ON tenant_users(tenant_id,email); CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_tenant_id_username_key ON tenant_users(tenant_id,username);');
  for(const [table,cols] of Object.entries(fixture.extra.tables)){
    await db.exec(`CREATE TABLE ${table}(${cols.map(c=>`"${c.name}" ${/^(uuid|text|boolean|jsonb|integer|bigint|numeric|date|timestamp|double|real|smallint|time)/.test(c.type)?c.type:c.type==='ARRAY'||c.type.startsWith('_')?'text[]':'text'}${c.name==='id'?' PRIMARY KEY':''}${c.default?` DEFAULT ${c.default.replace(/::(?:[a-z_]+_status|transport_mode|assignment_source|[a-z_]*employment_type|gender|recurrence_type|care_level|billing_party)\b/g,'::text')}`:''}`).join(',')})`);
  }
  await db.exec(`CREATE TABLE IF NOT EXISTS platform_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,full_name text,email text,status text,role text);
    CREATE TABLE IF NOT EXISTS platform_modules(module_key text PRIMARY KEY,status text);
    CREATE TABLE IF NOT EXISTS tenant_environment_settings(tenant_id uuid PRIMARY KEY,mode text CHECK(mode IN('production','pilot','demo','internal_test','sandbox')),is_pilot_tenant boolean,provider_sandbox_only boolean,notes text);
    CREATE TABLE demo_data_sets(tenant_id uuid,is_synthetic boolean);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
    CREATE FUNCTION platform_has_capability(text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
      SELECT EXISTS(SELECT 1 FROM platform_users WHERE user_id=auth.uid() AND status='active' AND role IN('platform_owner','platform_support') AND $1 IN('support.read','support.write','tenants.read')) $$;
    CREATE FUNCTION platform_assert_capability(text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF NOT platform_has_capability($1) THEN RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501'; END IF; END $$;
    INSERT INTO products(product_key,name,short_name,is_active,sort_order) SELECT x::product_key,x,x,true,1 FROM unnest(ARRAY['office','assist','pflege','beratung','akademie','stationaer'])x;
    INSERT INTO platform_modules SELECT product_key::text,'available' FROM products;`);
  for(const file of migrations)await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
  const body={companyName:'Testbetrieb',legalForm:'GmbH',industry:'Pflege',street:'Testweg 1',zip:'12345',city:'Teststadt',phone:'01234',email:'office@example.test',adminFirstName:'Test',adminLastName:'Owner',adminEmail:'owner@example.test',termsAccepted:true,selectedModules:[]};
  const owner=uuid(),otherOwner=uuid(),employee=uuid(),operator=uuid(),otherOperator=uuid();
  for(const [id,email] of [[owner,body.adminEmail],[otherOwner,'other@example.test']])await db.query('INSERT INTO auth.users VALUES($1,$2)',[id,email]);
  let tenant,otherTenant;
  await test('registration transaction provisions all free products and platform workspace',async()=>{
    const result=await asUser(null,'SELECT register_business_workspace($1,$2) AS value',[owner,body],'service_role');tenant=result.tenantId;
    assert.equal(result.ok,true);
    assert.equal(await scalar("SELECT count(*)::int AS value FROM tenant_products WHERE tenant_id=$1 AND status='active' AND price_cents=0",[tenant]),6);
    assert.equal(await scalar('SELECT billing_status AS value FROM platform_tenants WHERE tenant_id=$1',[tenant]),'manual_free');
    assert.equal(await scalar('SELECT mode AS value FROM tenant_environment_settings WHERE tenant_id=$1',[tenant]),'production');
    assert.equal(await scalar('SELECT terms_accepted_at IS NOT NULL AS value FROM profiles WHERE auth_user_id=$1',[owner]),true);
  });
  await test('registration retry is idempotent and RPC cannot be called by anonymous users',async()=>{
    const again=await asUser(null,'SELECT register_business_workspace($1,$2) AS value',[owner,body],'service_role');assert.equal(again.tenantId,tenant);
    await assert.rejects(asUser(null,'SELECT register_business_workspace($1,$2) AS value',[owner,body],'anon'),/permission denied/);
  });
  await test('registration failure rolls back every workspace row',async()=>{
    const actor=uuid();await db.query('INSERT INTO auth.users VALUES($1,$2)',[actor,'fail@example.test']);
    await db.exec("CREATE FUNCTION fail_registration() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected_failure'; END $$; CREATE TRIGGER fail_registration BEFORE INSERT ON platform_tenant_modules FOR EACH ROW EXECUTE FUNCTION fail_registration();");
    const before=await scalar('SELECT count(*)::int AS value FROM tenants');
    await assert.rejects(asUser(null,'SELECT register_business_workspace($1,$2) AS value',[actor,{...body,adminEmail:'fail@example.test'}],'service_role'),/injected_failure/);
    assert.equal(await scalar('SELECT count(*)::int AS value FROM tenants'),before);
    assert.equal(await scalar('SELECT count(*)::int AS value FROM profiles WHERE auth_user_id=$1',[actor]),0);
    await db.exec('DROP TRIGGER fail_registration ON platform_tenant_modules');
  });
  otherTenant=(await asUser(null,'SELECT register_business_workspace($1,$2) AS value',[otherOwner,{...body,adminEmail:'other@example.test',companyName:'Other'}],'service_role')).tenantId;
  await db.query("INSERT INTO profiles(auth_user_id,tenant_id,first_name,last_name,status,is_active) VALUES($1,$2,'Team','Member','active',true)",[employee,tenant]);
  for(const id of [operator,otherOperator])await db.query("INSERT INTO platform_users(user_id,full_name,email,status,role) VALUES($1,'Support','support@example.test','active','platform_support')",[id]);
  await test('company directory filters across all records before pagination and enforces platform access',async()=>{
    const result=await asUser(operator,"SELECT platform_list_companies(NULL,NULL,'manual_free',NULL,1,0,'production') AS value");
    assert.equal(result.items.length,1);
    assert.equal(result.items[0].billingStatus,'manual_free');
    const next=await asUser(operator,"SELECT platform_list_companies(NULL,NULL,'manual_free',NULL,1,1,'production') AS value");
    assert.notEqual(result.items[0].tenantId,next.items[0].tenantId);
    await assert.rejects(asUser(owner,'SELECT platform_list_companies() AS value'),/platform_forbidden/);
  });
  let ticket,grant,upload;
  const createArgs=['Problem mit Einsatz','Beschreibung des Problems','technical','normal',uuid()];
  await test('ticket and initial message are atomic and retries do not duplicate',async()=>{
    ticket=(await asUser(owner,'SELECT support_create_ticket($1,$2,$3,$4,$5) AS value',createArgs)).id;
    assert.equal((await asUser(owner,'SELECT support_create_ticket($1,$2,$3,$4,$5) AS value',createArgs)).id,ticket);
    assert.equal(await scalar('SELECT count(*)::int AS value FROM support_messages WHERE ticket_id=$1',[ticket]),1);
  });
  await test('ticket RLS excludes other tenant and non-participating employee',async()=>{
    for(const actor of [otherOwner,employee]){
      assert.equal(await asUser(actor,'SELECT count(*)::int AS value FROM support_tickets'),0);
      await assert.rejects(asUser(actor,'SELECT support_get_ticket($1) AS value',[ticket]),/support_forbidden/);
    }
    await assert.rejects(asUser(owner,"UPDATE support_tickets SET tenant_id=$1 WHERE id=$2 RETURNING id AS value",[otherTenant,ticket]),/permission denied/);
  });
  await test('support can read messages but cannot use old tenant-access bypass',async()=>{
    assert.equal((await asUser(operator,'SELECT support_get_ticket($1) AS value',[ticket])).messages.length,1);
    await assert.rejects(asUser(operator,'SELECT platform_start_support_session($1,$2,now()) AS value',[tenant,'Old bypass']),/approval_required/);
    await assert.rejects(asUser(operator,'SELECT support_assert_access($1,$2) AS value',[uuid(),'company.read']),/permission denied/);
  });
  await test('only the tenant administrator can approve a scoped request',async()=>{
    grant=(await asUser(operator,"SELECT support_request_access($1,$2,$3,15) AS value",[ticket,'Unternehmensdaten prüfen',['company.read','company.write']])).id;
    await assert.rejects(asUser(operator,"SELECT support_workspace_read($1,'company.read') AS value",[grant]),/support_access_denied/);
    for(const actor of [employee,otherOwner,operator])await assert.rejects(asUser(actor,"SELECT support_decide_access($1,'approve') AS value",[grant]),/approval_required/);
    await asUser(owner,"SELECT support_decide_access($1,'approve') AS value",[grant]);
    const data=await asUser(operator,"SELECT support_workspace_read($1,'company.read') AS value",[grant]);assert.equal(data.rows.length,1);assert.equal(data.rows[0].id,tenant);
    await assert.rejects(asUser(otherOperator,"SELECT support_workspace_read($1,'company.read') AS value",[grant]),/support_access_denied/);
    await assert.rejects(asUser(operator,"SELECT support_workspace_read($1,'clients.read') AS value",[grant]),/support_access_denied/);
  });
  await test('scoped editing checks tenant, field allowlist and concurrent changes',async()=>{
    const record=(await asUser(operator,"SELECT support_workspace_read($1,'company.read') AS value",[grant])).rows[0];
    for(const [id,patch] of [[otherTenant,{name:'Wrong'}],[tenant,{status:'locked'}]])await assert.rejects(asUser(operator,"SELECT support_workspace_update($1,'company.write',$2,$3,$4) AS value",[grant,id,record.updated_at,patch]),/support_access_denied|support_patch_invalid/);
    await asUser(operator,"SELECT support_workspace_update($1,'company.write',$2,$3,$4) AS value",[grant,tenant,record.updated_at,{name:'Updated company'}]);
    await assert.rejects(asUser(operator,"SELECT support_workspace_update($1,'company.write',$2,$3,$4) AS value",[grant,tenant,record.updated_at,{name:'Stale'}]),/support_record_changed/);
  });
  await test('revocation and expiration deny the next request immediately',async()=>{
    await asUser(owner,"SELECT support_decide_access($1,'revoke') AS value",[grant]);
    await assert.rejects(asUser(operator,"SELECT support_workspace_read($1,'company.read') AS value",[grant]),/support_access_denied/);
    grant=(await asUser(operator,"SELECT support_request_access($1,$2,$3,15) AS value",[ticket,'Zugriff zur Prüfung',['company.read']])).id;
    await asUser(owner,"SELECT support_decide_access($1,'approve') AS value",[grant]);
    await db.query("UPDATE support_access_requests SET expires_at=now()-interval '1 second' WHERE id=$1",[grant]);
    await assert.rejects(asUser(operator,"SELECT support_workspace_read($1,'company.read') AS value",[grant]),/support_access_denied/);
  });
  await test('attachments are private, upload-bound and visible only after sending',async()=>{
    upload=await asUser(owner,"SELECT support_reserve_attachment($1,'proof.pdf','application/pdf',100) AS value",[ticket]);
    await assert.rejects(asUser(owner,'SELECT support_finalize_attachment($1) AS value',[upload.id]),/support_upload_incomplete/);
    const sql="INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('support-ticket-attachments',$1,$2) RETURNING id AS value";
    await assert.rejects(asUser(otherOwner,sql,[upload.storage_path,{size:100,mimetype:'application/pdf'}]),/row-level security/);
    await asUser(owner,sql,[upload.storage_path,{size:100,mimetype:'application/pdf'}]);
    assert.equal(await asUser(operator,'SELECT count(*)::int AS value FROM storage.objects'),0);
    await asUser(owner,'SELECT support_finalize_attachment($1) AS value',[upload.id]);
    const args=[ticket,'Datei zum Problem',uuid(),[upload.id]];
    const message=await asUser(owner,'SELECT support_send_message($1,$2,$3,$4) AS value',args);
    assert.equal((await asUser(owner,'SELECT support_send_message($1,$2,$3,$4) AS value',args)).id,message.id);
    assert.equal(await asUser(operator,'SELECT count(*)::int AS value FROM storage.objects'),1);
    assert.equal(await asUser(otherOwner,'SELECT count(*)::int AS value FROM storage.objects'),0);
    await assert.rejects(asUser(owner,'SELECT support_discard_attachment($1) AS value',[upload.id]),/support_forbidden/);
  });
  await test('discarding prevents a simultaneous send or re-finalization',async()=>{
    const file=await asUser(owner,"SELECT support_reserve_attachment($1,'draft.txt','text/plain',10) AS value",[ticket]);
    await asUser(owner,"INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('support-ticket-attachments',$1,$2) RETURNING id AS value",[file.storage_path,{size:10,mimetype:'text/plain'}]);
    await asUser(owner,'SELECT support_finalize_attachment($1) AS value',[file.id]);
    await asUser(owner,'SELECT support_begin_discard_attachment($1) AS value',[file.id]);
    await assert.rejects(asUser(owner,'SELECT support_finalize_attachment($1) AS value',[file.id]),/support_forbidden/);
    await assert.rejects(asUser(owner,'SELECT support_send_message($1,$2,$3,$4) AS value',[ticket,'Race',uuid(),[file.id]]),/support_invalid_attachment/);
    await asUser(owner,'DELETE FROM storage.objects WHERE name=$1 RETURNING id AS value',[file.storage_path]);
    await asUser(owner,'SELECT support_discard_attachment($1) AS value',[file.id]);
    assert.equal(await scalar('SELECT count(*)::int AS value FROM support_attachments WHERE id=$1',[file.id]),0);
  });
  await test('closing a ticket revokes every active grant and audit is append-only',async()=>{
    await asUser(owner,"SELECT support_set_ticket_status($1,'resolved') AS value",[ticket]);
    assert.equal(await scalar("SELECT count(*)::int AS value FROM support_access_requests WHERE ticket_id=$1 AND status IN('requested','approved')",[ticket]),0);
    assert.ok(await scalar('SELECT count(*)::int AS value FROM support_audit_events WHERE ticket_id=$1',[ticket])>5);
    await assert.rejects(asUser(owner,'DELETE FROM support_audit_events WHERE ticket_id=$1 RETURNING id AS value',[ticket]),/permission denied/);
  });
  process.stdout.write(JSON.stringify({ok:true,passed,liveDatabaseAccess:false})+'\n');
} finally {await db.close();}
})().catch(error=>{process.stderr.write(String(error.stack||error)+'\n'+JSON.stringify({detail:error.detail,where:error.where,query:error.query})+'\n');process.exitCode=1;});

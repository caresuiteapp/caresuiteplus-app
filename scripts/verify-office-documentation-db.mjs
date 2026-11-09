import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// All writes stay in this isolated database; no hosted credentials or records.
const db = new PGlite();
const ids = Object.fromEntries(['tenant','foreignTenant','admin','staff','clientUser','profile','role','employee','foreignEmployee','client','foreignClient','account','visit','documentation'].map(k => [k,randomUUID()]));
const sql = readFileSync('supabase/patches/office_documentation_workspace.sql','utf8');
const migration = readFileSync('supabase/migrations/20261105090254_office_documentation_workspace.sql','utf8');
assert.equal(sql,migration);
const registeredClientsSql = readFileSync('supabase/patches/office_documentation_registered_clients.sql','utf8');
const mediaSql = readFileSync('supabase/patches/office_documentation_media.sql','utf8');
const visitMediaSql = readFileSync('supabase/patches/office_documentation_visit_media.sql','utf8');
const releaseSql = readFileSync('supabase/patches/office_documentation_release.sql','utf8');
const employeeAttachmentMigration = readFileSync('supabase/migrations/20261109072535_office_documentation_employee_attachments.sql','utf8');
const employeeAttachmentRelease = readFileSync('supabase/patches/office_documentation_employee_attachments_release.sql','utf8');
assert.ok(employeeAttachmentRelease.includes(employeeAttachmentMigration.replace('\nBEGIN;\n','\n').split('\nCOMMIT;')[0]));
for (const source of [mediaSql,visitMediaSql]) assert.ok(releaseSql.includes(source.replace('\nBEGIN;\n','\n').split('\nCOMMIT;')[0]));
assert.equal(mediaSql,readFileSync('supabase/migrations/20261106185632_office_documentation_media.sql','utf8'));
assert.equal(visitMediaSql,readFileSync('supabase/migrations/20261106191229_office_documentation_visit_media.sql','utf8'));
assert.equal(registeredClientsSql,readFileSync('supabase/migrations/20261105102248_office_documentation_registered_clients.sql','utf8'));
const result = async (q,params=[]) => (await db.query(q,params)).rows[0]?.result;
const owner = async (q,params=[]) => { await db.exec('RESET ROLE'); return db.query(q,params); };
async function actor(user=ids.admin,portal='business',tenant=ids.tenant) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.jwt',$3,false)",[user,tenant,JSON.stringify({app_metadata:{portal_type:portal,portal_account_id:portal==='employee'?ids.account:null,role_key:portal==='employee'?'employee_portal':'business_admin'}})]);
  await db.exec('SET ROLE authenticated');
}
const payload = (patch={}) => ({area:'client',clientId:ids.client,employeeId:ids.employee,category:'care',priority:'normal',title:' Freier Bericht ',body:' Beobachtung und Absprache ',occurredAt:'2026-03-31T22:30:00Z',...patch});
const create = (draft=payload(),id=randomUUID(),tenant=ids.tenant) => result('SELECT public.office_documentation_create($1,$2,$3::jsonb) AS result',[tenant,id,JSON.stringify(draft)]);
const list = (filters={},tenant=ids.tenant) => result('SELECT public.office_documentation_workspace($1,$2::jsonb) AS result',[tenant,JSON.stringify(filters)]);
const denied = async (promise,code='42501') => assert.rejects(promise,e=>{assert.equal(e.code,code,e.message);return true;});
let checks=0;
const pass = async(name,fn)=>{await fn();checks++;console.log(`[office-documentation-db] PASS ${name}`);};
try {
  await db.exec(readFileSync('scripts/fixtures/office-internal-notes-test-schema.sql','utf8'));
  await db.exec(`ALTER TABLE public.profiles ADD first_name text,ADD last_name text;
    CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text,status text DEFAULT 'active',deleted_at timestamptz);
    CREATE TABLE public.assist_visits(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,title text,service_name text,actual_end_at timestamptz,execution_status text,canonical_status text);
    CREATE TABLE public.assist_visit_documentation(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,short_description text,special_notes text,deviations text,deviation_justification text,referral_required boolean,emergency_or_problem boolean,sis_notes text,vitals_summary text,body_map_notes text,medication_notes text,care_report_notes text,submitted_at timestamptz,submitted_by uuid,created_at timestamptz DEFAULT now());`);
  await db.exec(sql);
  await db.exec(registeredClientsSql);
  await db.exec(`CREATE SCHEMA storage;GRANT USAGE ON SCHEMA storage TO authenticated;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz DEFAULT now());
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
    CREATE POLICY existing_broad_policy ON storage.objects TO authenticated USING(true) WITH CHECK(true);`);
  await db.exec('CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);');
  await db.exec(`CREATE FUNCTION public.portal_employee_assigned_visit_ids(p_tenant uuid) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT id FROM public.assist_visits WHERE tenant_id=p_tenant AND employee_id=public.resolve_current_employee_id() $$;`);
  await db.exec(releaseSql);
  await db.exec(employeeAttachmentRelease);
  await db.query('INSERT INTO public.tenants(id) VALUES($1),($2)',[ids.tenant,ids.foreignTenant]);
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2),($3)',[ids.admin,ids.staff,ids.clientUser]);
  await db.query("INSERT INTO public.roles(id,key,is_admin_role) VALUES($1,'business_admin',true)",[ids.role]);
  await db.query("INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id,display_name) VALUES($1,$2,$3,$4,'Office Test')",[ids.profile,ids.admin,ids.tenant,ids.role]);
  await db.query("INSERT INTO public.employees(id,tenant_id,first_name,last_name) VALUES($1,$2,'Team','Test'),($3,$4,'Foreign','Staff')",[ids.employee,ids.tenant,ids.foreignEmployee,ids.foreignTenant]);
  await db.query("INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES($1,$2,'Client','Test'),($3,$4,'Foreign','Client')",[ids.client,ids.tenant,ids.foreignClient,ids.foreignTenant]);
  await db.query('INSERT INTO public.employee_portal_accounts(id,tenant_id,employee_id,auth_user_id) VALUES($1,$2,$3,$4)',[ids.account,ids.tenant,ids.employee,ids.staff]);
  await actor(); let receipt,employeeEntryId;const id=randomUUID();
  await pass('free entry persists without any assignment and retries exactly once',async()=>{
    receipt=await create(payload(),id);assert.equal(receipt.id,id);assert.equal((await list()).total,1);
    assert.deepEqual(await create(payload(),id),receipt);assert.equal((await list()).total,1);
    await denied(create(payload({body:'Changed'}),id),'40001');
    const entry=(await list()).items[0];assert.equal(entry.author_name,'Office Test');assert.equal(entry.body,'Beobachtung und Absprache');assert.equal(entry.source,'manual');
  });
  await pass('entity isolation, required content, future dates and priorities are enforced on server',async()=>{
    for(const patch of [{clientId:ids.foreignClient},{employeeId:ids.foreignEmployee},{title:''},{body:' '},{priority:'fake'},{area:'client',clientId:''},{occurredAt:'2099-01-01T00:00:00Z'}]) await denied(create(payload(patch)),'22023');
    await denied(list({},ids.foreignTenant));assert.equal((await list()).total,1);
  });
  await pass('client choices exclude intake drafts and deleted records but retain registered lifecycle states',async()=>{
    const registered=['active','paused','inactive','archived','deceased','blocked'];
    const candidates=[];
    for(const status of [...registered,'lead','deleted']) {
      const clientId=randomUUID();candidates.push({clientId,status});
      // A fully named draft may share a name with the actual registered client.
      await owner('INSERT INTO public.clients(id,tenant_id,first_name,last_name,status) VALUES($1,$2,$3,$4,$5)',[clientId,ids.tenant,'Client','Test',status]);
    }
    const removedId=randomUUID();
    await owner("INSERT INTO public.clients(id,tenant_id,first_name,last_name,status,deleted_at) VALUES($1,$2,'Deleted','Client','active',now())",[removedId,ids.tenant]);
    for(const [user,portal] of [[ids.admin,'business'],[ids.staff,'employee']]) {
      await actor(user,portal);
      const choices=(await list()).clients.map(c=>c.id);
      assert.ok(choices.includes(ids.client));assert.ok(!choices.includes(ids.foreignClient));assert.ok(!choices.includes(removedId));
      for(const {clientId,status} of candidates) assert.equal(choices.includes(clientId),registered.includes(status),status);
      for(const {clientId,status} of candidates.filter(c=>!registered.includes(c.status))) {
        await denied(create(payload({clientId})),'22023');
        await denied(create(payload({area:'administration',clientId})),'22023');
      }
    }
    await owner('DELETE FROM public.clients WHERE id=ANY($1::uuid[])',[[removedId,...candidates.map(c=>c.clientId)]]);
    await actor();assert.equal((await list()).total,1);
  });
  await pass('a client reverted to intake is rejected at save time while existing documentation stays readable',async()=>{
    await owner("UPDATE public.clients SET status='lead' WHERE id=$1",[ids.client]);
    await actor();const before=await list();assert.equal(before.total,1);assert.equal(before.items[0].id,id);
    assert.ok(!before.clients.some(c=>c.id===ids.client));await denied(create(),'22023');
    await owner("UPDATE public.clients SET status='active' WHERE id=$1",[ids.client]);
    await actor();assert.ok((await list()).clients.some(c=>c.id===ids.client));assert.deepEqual(await create(payload(),id),receipt);
  });
  await pass('both person selectors use the actual surname and keep compound given names',async()=>{
    const earlierClient=randomUUID(),earlierEmployee=randomUUID();
    await owner("INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES($1,$2,'Mara Louise','Adler')",[earlierClient,ids.tenant]);
    await owner("INSERT INTO public.employees(id,tenant_id,first_name,last_name) VALUES($1,$2,'Kevin','Reinhardt')",[earlierEmployee,ids.tenant]);
    await actor(ids.staff,'employee');const choices=await list();
    assert.deepEqual(choices.clients.map(c=>c.name),['Adler, Mara Louise','Test, Client']);
    assert.deepEqual(choices.employees.map(e=>e.name),['Reinhardt, Kevin','Test, Team']);
    await actor();
  });
  await pass('month boundaries use Berlin summer time and search treats wildcards literally',async()=>{
    assert.equal((await list({month:'2026-04'})).total,1);assert.equal((await list({month:'2026-03'})).total,0);
    assert.equal((await list({query:'BEOBACHTUNG'})).total,1);assert.equal((await list({query:'%'})).total,0);
    assert.equal((await list({clientId:ids.client,employeeId:ids.employee,category:'care',source:'manual'})).total,1);
    await denied(list({month:'2026-13'}),'22023');await denied(list({offset:-1}),'22023');
  });
  await pass('active staff can read the common feed and document without an Office profile',async()=>{
    await actor(ids.staff,'employee');assert.equal((await list()).items[0].id,id);
    const entry=await create(payload({area:'administration',clientId:'',employeeId:'',title:'Team report'}));
    employeeEntryId=entry.id;
    assert.equal((await list()).items.find(i=>i.id===entry.id).author_name,'Team Test');
    await denied(db.query('SELECT * FROM care_security.office_documentation_entries'));
    await denied(db.query('DELETE FROM care_security.office_documentation_entries'));
  });
  await pass('client/family, blocked account, deactivated employee, anonymous and foreign actors are denied',async()=>{
    await actor(ids.clientUser,'client');await denied(list());await denied(create());
    await actor(ids.staff,'family');await denied(list());
    await owner('UPDATE public.employee_portal_accounts SET blocked_at=now() WHERE id=$1',[ids.account]);
    await actor(ids.staff,'employee');await denied(list());
    await owner('UPDATE public.employee_portal_accounts SET blocked_at=NULL WHERE id=$1',[ids.account]);
    await owner("UPDATE public.employees SET status='inactive' WHERE id=$1",[ids.employee]);await actor(ids.staff,'employee');await denied(list());
    await owner("UPDATE public.employees SET status='active' WHERE id=$1",[ids.employee]);
    await db.exec('RESET ROLE; SET ROLE anon');await denied(list());await actor();
  });
  await pass('only submitted finished visit reports appear automatically, once, with late corrections',async()=>{
    await owner("INSERT INTO public.assist_visits(id,tenant_id,client_id,employee_id,title,execution_status,canonical_status,actual_end_at) VALUES($1,$2,$3,$4,'Visit report','in_progress','started','2026-04-01T10:00:00Z')",[ids.visit,ids.tenant,ids.client,ids.employee]);
    await owner("INSERT INTO public.assist_visit_documentation(id,tenant_id,visit_id,short_description,special_notes,submitted_at) VALUES($1,$2,$3,'Original report','Internal observation','2026-04-01T10:30:00Z')",[ids.documentation,ids.tenant,ids.visit]);
    await actor();assert.equal((await list({source:'visit'})).total,0);
    await owner("UPDATE public.assist_visits SET execution_status='completed',canonical_status='completed' WHERE id=$1",[ids.visit]);
    await actor();const feed=await list({source:'visit'});assert.equal(feed.total,1);assert.match(feed.items[0].body,/Internal observation/);assert.equal(feed.items[0].visit_id,ids.visit);
    await owner("UPDATE public.assist_visit_documentation SET short_description='Updated original' WHERE id=$1",[ids.documentation]);
    await actor();assert.equal((await list({source:'visit'})).total,1);assert.match((await list({source:'visit'})).items[0].body,/Updated original/);
    await owner("UPDATE public.assist_visits SET canonical_status='cancelled' WHERE id=$1",[ids.visit]);await actor();assert.equal((await list({source:'visit'})).total,0);
  });
  await pass('pagination has deterministic order and no duplicate items',async()=>{
    for(let i=0;i<51;i++)await create(payload({title:`Entry ${i}`}));
    const first=await list(),second=await list({offset:50});assert.equal(first.total,53);assert.equal(first.items.length,50);assert.equal(second.items.length,3);
    assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,53);
  });
  await pass('private attachments verify uploaded originals and resist broad Storage policies and portal access',async()=>{
    const attachmentId=randomUUID(),metadata={id:attachmentId,name:'foto.png',mime:'image/png',size:3};
    const attachments=(op='list',data={},tenant=ids.tenant)=>result('SELECT public.office_documentation_attachments($1,$2,$3,$4,$5::jsonb) AS result',[tenant,id,'manual',op,JSON.stringify(data)]);
    await actor();const prepared=await attachments('prepare',metadata);assert.equal(prepared.state,'pending');
    assert.deepEqual(await attachments('prepare',metadata),prepared);assert.equal((await attachments()).items.length,0);
    await denied(attachments('complete',{id:attachmentId}),'22023');
    await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('office-documentation',$1,$2,$3::jsonb)",[prepared.storage_path,ids.admin,JSON.stringify({size:2,mimetype:'image/png'})]);
    await denied(attachments('complete',{id:attachmentId}),'22023');
    await owner("UPDATE storage.objects SET metadata=jsonb_build_object('size',3,'mimetype','image/png') WHERE name=$1",[prepared.storage_path]);
    await actor();assert.equal((await attachments('complete',{id:attachmentId})).state,'ready');assert.equal((await attachments('complete',{id:attachmentId})).state,'ready');
    assert.equal((await attachments()).items.length,1);await denied(attachments('discard',{id:attachmentId}));
    await denied(db.query('SELECT * FROM care_security.documentation_files'));
    await actor(ids.staff,'employee');const visible=await attachments();assert.equal(visible.canUpload,false);assert.equal(visible.items.length,1);
    assert.equal((await db.query("SELECT count(*)::int as n FROM storage.objects WHERE bucket_id='office-documentation'")).rows[0].n,1);
    await denied(attachments('prepare',{...metadata,id:randomUUID()}));
    assert.equal((await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING id",[prepared.storage_path])).rows.length,0);
    assert.equal((await db.query("UPDATE storage.objects SET metadata='{}' WHERE name=$1 RETURNING id",[prepared.storage_path])).rows.length,0);
    for(const portal of ['client','family']) {await actor(ids.clientUser,portal);await denied(attachments());assert.equal((await db.query("SELECT count(*)::int as n FROM storage.objects WHERE bucket_id='office-documentation'")).rows[0].n,0);}
    await actor();await denied(attachments('list',{},ids.foreignTenant));
    await denied(db.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('office-documentation',$1,$2,'{}')",[ids.foreignTenant+'/manual/'+id+'/'+randomUUID(),ids.admin]));
    await denied(attachments('prepare',{...metadata,id:randomUUID(),size:52428801}),'22023');
    await denied(attachments('prepare',{...metadata,id:randomUUID(),name:'../photo.png'}),'22023');
    await denied(attachments('prepare',{...metadata,name:'different.png'}),'40001');
    const pending=await attachments('prepare',{...metadata,id:randomUUID()});
    await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('office-documentation',$1,$2,$3::jsonb)",[pending.storage_path,ids.admin,JSON.stringify({size:3,mimetype:'image/png'})]);
    await attachments('discard',{id:pending.id});
    assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id',[pending.storage_path])).rows.length,1);
    await denied(attachments('complete',{id:pending.id}),'22023');
    assert.equal((await list()).total,53);
  });
  await pass('employees can finish photo, video and PDF uploads for their own free entry only',async()=>{
    const attachments=(op='list',data={},tenant=ids.tenant)=>result('SELECT public.office_documentation_attachments($1,$2,$3,$4,$5::jsonb) AS result',[tenant,employeeEntryId,'manual',op,JSON.stringify(data)]);
    await actor(ids.staff,'employee');assert.equal((await attachments()).canUpload,true);
    for(const mime of ['audio/mpeg','text/html','image/svg+xml','application/msword']) {
      await denied(attachments('prepare',{id:randomUUID(),name:'file',mime,size:3}),'22023');
    }
    const formats=[['photo.heic','image/heic'],['video.mov','video/quicktime'],['report.pdf','application/pdf']];
    for(const [name,mime] of formats) {
      const file={id:randomUUID(),name,mime,size:3};
      const prepared=await attachments('prepare',file);
      assert.equal(prepared.storage_path,ids.tenant+'/manual/'+employeeEntryId+'/'+file.id);
      assert.deepEqual(await attachments('prepare',file),prepared);
      await denied(attachments('complete',{id:file.id}),'22023');
      await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('office-documentation',$1,$2,$3::jsonb)",[prepared.storage_path,ids.staff,JSON.stringify({size:3,mimetype:mime})]);
      assert.equal((await attachments('complete',{id:file.id})).state,'ready');
      assert.equal((await attachments('complete',{id:file.id})).state,'ready');
      await denied(attachments('discard',{id:file.id}));
    }
    await denied(attachments('list',{},ids.foreignTenant));
    await actor();assert.deepEqual(new Set((await attachments()).items.map(item=>item.mime_type)),new Set(formats.map(([,mime])=>mime)));
    for(const portal of ['client','family']) {await actor(ids.clientUser,portal);await denied(attachments());}
    await owner('UPDATE public.employee_portal_accounts SET blocked_at=now() WHERE id=$1',[ids.account]);
    await actor(ids.staff,'employee');await denied(attachments());
    await owner('UPDATE public.employee_portal_accounts SET blocked_at=NULL WHERE id=$1',[ids.account]);
    await actor();
  });
  await pass('employee photo/video originals flow into completed documentation without metadata copies or portal leaks',async()=>{
    const mediaId=randomUUID(),imageId=randomUUID(),folder=`tenant/${ids.tenant}/assist/visits/${ids.visit}/attachments/`,path=folder+mediaId+'.mp4';
    const view=()=>result('SELECT public.office_documentation_attachments($1,$2,$3) AS result',[ids.tenant,ids.documentation,'visit']);
    await owner("UPDATE public.assist_visits SET canonical_status='completed',execution_status='in_progress' WHERE id=$1",[ids.visit]);
    await actor(ids.staff,'employee');
    await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('office-documents',$1,$2,$3::jsonb)",[path,ids.staff,JSON.stringify({size:3,mimetype:'video/mp4'})]);
    await db.query("INSERT INTO public.assist_visit_attachments(id,tenant_id,visit_id,employee_id,storage_path,file_name,mime_type,size_bytes,media_kind,upload_source) VALUES($1,$2,$3,$4,$5,'video.mp4','video/mp4',3,'video','employee_portal')",[mediaId,ids.tenant,ids.visit,ids.employee,path]);
    await denied(view());
    for(const ext of ['pdf','wav','docx']) await denied(db.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('office-documents',$1,$2,'{}')",[folder+randomUUID()+'.'+ext,ids.staff]));
    await denied(db.query("INSERT INTO public.assist_visit_attachments(id,tenant_id,visit_id,employee_id,storage_path,file_name,mime_type,size_bytes,media_kind,upload_source) VALUES($1,$2,$3,$4,$5,'video.mp4','video/mp4',3,'video','employee_portal')",[randomUUID(),ids.tenant,ids.visit,ids.foreignEmployee,path]));
    const orphanPath=folder+imageId+'.jpg';
    await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('office-documents',$1,$2,$3::jsonb)",[orphanPath,ids.staff,JSON.stringify({size:3,mimetype:'image/jpeg'})]);
    await owner("UPDATE public.assist_visits SET execution_status='completed' WHERE id=$1",[ids.visit]);
    await actor();let listed=await view();assert.equal(listed.items.length,2);assert.ok(listed.items.every(f=>f.storage_bucket==='office-documents'));
    assert.deepEqual(new Set(listed.items.map(f=>f.storage_path)),new Set([path,orphanPath]));
    await actor(ids.staff,'employee');listed=await view();assert.equal(listed.canUpload,false);assert.equal(listed.items.length,2);
    await denied(result('SELECT public.office_documentation_attachments($1,$2,$3,$4,$5::jsonb) AS result',[ids.tenant,ids.documentation,'visit','prepare',JSON.stringify({id:randomUUID(),name:'x.pdf',mime:'application/pdf',size:3})]));
    await actor(ids.clientUser,'client');await denied(view());assert.equal((await db.query("SELECT count(*)::int as n FROM storage.objects WHERE bucket_id='office-documents'")).rows[0].n,0);
    await owner("UPDATE public.assist_visits SET canonical_status='cancelled' WHERE id=$1",[ids.visit]);await actor();
  });
  await pass('production company authorization still enforces explicit denials and restricted scopes',async()=>{
    await db.exec('RESET ROLE');
    await db.exec(readFileSync('supabase/migrations/20261015085833_company_access.sql','utf8'));
    await owner('UPDATE public.employees SET profile_id=$1 WHERE id=$2',[ids.profile,ids.employee]);
    await actor();assert.equal((await list()).total,53);
    await owner("INSERT INTO public.employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'office.access',false)",[ids.tenant,ids.employee]);
    await actor();await denied(list());await denied(create());
    await owner('DELETE FROM public.employee_permission_overrides');
    await owner("INSERT INTO public.employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'office','employee',$3)",[ids.tenant,ids.employee,ids.employee]);
    await actor();await denied(list());
  });
  await pass('Git Bash release transaction can be repeated without changing originals or reapplying schema',async()=>{
    await db.exec('RESET ROLE');const before=(await db.query('SELECT * FROM storage.objects ORDER BY id')).rows;
    await db.exec(releaseSql);await db.exec(employeeAttachmentRelease);
    assert.deepEqual((await db.query('SELECT * FROM storage.objects ORDER BY id')).rows,before);
    assert.equal((await db.query('SELECT count(*)::int as n FROM supabase_migrations.schema_migrations')).rows[0].n,3);
  });
  console.log(`[office-documentation-db] ${checks} scenario groups passed.`);
} finally {await db.close();}

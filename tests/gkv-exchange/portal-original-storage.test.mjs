import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Original file policies intersect broad tenant policies on actual SELECT, INSERT, UPDATE and DELETE',async t=>{
 const db=new PGlite();
 try{
  const ten=randomUUID(),owner=randomUUID(),account=randomUUID(),other=randomUUID(),code=randomUUID();
  const client=randomUUID(),visit=randomUUID(),proof=randomUUID(),sig=randomUUID(),v2=randomUUID(),p2=randomUUID(),s2=randomUUID();
  const base='tenant/'+ten+'/assist/visits/',img=base+visit+'/signatures/'+sig+'.png',img2=base+v2+'/signatures/'+s2+'.png';
  const pdf=base+visit+'/proofs/'+proof+'-'+sig+'-signed.pdf',pdf2=base+v2+'/proofs/'+p2+'-'+s2+'-signed.pdf',server=base+visit+'/server-proofs/private.pdf',hash='sha256:'+'b'.repeat(64);
  await db.exec(`
    CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE SCHEMA care_security;
    GRANT USAGE ON SCHEMA auth,storage,care_security TO authenticated,anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.tenant',true),'')::uuid $$;
    CREATE FUNCTION current_client_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.client',true),'')::uuid $$;
    CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.account',true),'')::uuid $$;
    CREATE FUNCTION current_role_key() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.role',true) $$;
    CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.type',true) $$;
    CREATE FUNCTION is_client_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.current_role_key() IN ('client_portal','family_portal') $$;
    CREATE TABLE client_portal_access(id uuid,tenant_id uuid,client_id uuid,auth_user_id uuid,status text,portal_enabled boolean);
    CREATE TABLE client_portal_codes(id uuid,tenant_id uuid,client_id uuid,auth_user_id uuid,status text,blocked_at timestamptz,expires_at timestamptz);
    CREATE TABLE assist_visits(id uuid,tenant_id uuid,client_id uuid);
    CREATE TABLE assist_visit_proofs(id uuid,tenant_id uuid,visit_id uuid,portal_visible boolean,portal_release_status text,signature_id uuid,payload_hash text,pdf_storage_path text,pdf_hash text,payload_snapshot jsonb);
    CREATE TABLE assist_visit_signatures(id uuid,tenant_id uuid,visit_id uuid,is_valid boolean,invalidated_at timestamptz,storage_path text,signer_role text,metadata jsonb);
    CREATE TABLE storage.objects(bucket_id text,name text,marker text DEFAULT 'original',PRIMARY KEY(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
    CREATE POLICY broad_office_docs ON storage.objects FOR ALL TO authenticated USING(bucket_id='office-documents' AND split_part(name,'/',2)=current_tenant_id()::text) WITH CHECK(bucket_id='office-documents' AND split_part(name,'/',2)=current_tenant_id()::text);
    CREATE POLICY broad_anon_fixture ON storage.objects FOR ALL TO anon USING(true) WITH CHECK(true);
  `);
  await db.query('INSERT INTO client_portal_access VALUES($1,$2,$3,$4,$5,true)',[account,ten,client,owner,'aktiv']);
  await db.query("INSERT INTO client_portal_codes VALUES($1,$2,$3,$4,'active',NULL,now()+interval '1 hour')",[code,ten,client,owner]);
  for(const [v,p,s,c,path] of [[visit,proof,sig,client,img],[v2,p2,s2,other,img2]]){
   await db.query('INSERT INTO assist_visits VALUES($1,$2,$3)',[v,ten,c]);
   await db.query("INSERT INTO assist_visit_proofs VALUES($1,$2,$3,true,'pending_client_signature',NULL,$4,NULL,NULL,'{}')",[p,ten,v,hash]);
   await db.query("INSERT INTO assist_visit_signatures VALUES($1,$2,$3,true,NULL,$4,'client',$5)",[s,ten,v,path,{proofId:p,signedVia:'client_portal',proofPayloadHash:hash}]);
  }
  const put=path=>db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('office-documents',$1)",[path]);
  for(const path of [img,img2,pdf2,server])await put(path);
  const visible=async path=>(await db.query('SELECT name FROM storage.objects WHERE name=$1',[path])).rows.length===1;
  const as=async(typ='client',role='client_portal',ac=account)=>{await db.exec('RESET ROLE');for(const [k,v] of Object.entries({uid:owner,client,account:ac,tenant:ten,role,type:typ}))await db.query('SELECT set_config($1,$2,false)',['test.'+k,v]);await db.exec('SET ROLE authenticated');};
  await as();assert.equal(await visible(img2),true);await db.exec('RESET ROLE');
  await db.exec(await readFile(new URL('../../supabase/migrations/20261104141643_guard_portal_assist_original_storage.sql',import.meta.url),'utf8'));await as();
  await t.test('only own captured signature and own bound proof are readable',async()=>{
   assert.ok(await visible(img));assert.equal(await visible(img2),false);assert.equal(await visible(pdf2),false);assert.equal(await visible(server),false);
   await put(pdf);assert.ok(await visible(pdf));await assert.rejects(put(base+v2+'/signatures/'+randomUUID()+'.png'),e=>e.code==='42501');
   await assert.rejects(put(base+visit+'/server-proofs/'+randomUUID()+'.pdf'),e=>e.code==='42501');
   await assert.rejects(put(base+visit+'/proofs/'+p2+'-'+sig+'-x.pdf'),e=>e.code==='42501');
   await put(base+visit+'/signatures/'+randomUUID()+'.png');
  });
  await t.test('stored originals cannot be overwritten, removed, or moved into the namespace',async()=>{
   for(const path of [img,img2,pdf]){assert.equal((await db.query("UPDATE storage.objects SET marker='changed' WHERE name=$1 RETURNING name",[path])).rows.length,0);
    assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name',[path])).rows.length,0);}
   const outside='tenant/'+ten+'/other/test';await put(outside);
   await assert.rejects(db.query('UPDATE storage.objects SET name=$1 WHERE name=$2',[base+visit+'/signatures/'+randomUUID()+'.png',outside]),e=>e.code==='42501');
  });
  await t.test('account, revocation and family scope remain effective',async()=>{
   await as('client','client_portal',randomUUID());assert.equal(await visible(img),false);
   await as('client','client_portal',code);assert.ok(await visible(img));await as('family','family_portal',code);assert.equal(await visible(img),false);
   await db.exec('RESET ROLE');await db.query("UPDATE client_portal_codes SET status='blocked' WHERE id=$1",[code]);await as('client','client_portal',code);assert.equal(await visible(img),false);
   await as();await db.exec('RESET ROLE');await db.query("UPDATE assist_visit_proofs SET portal_release_status='revoked' WHERE id=$1",[proof]);await as();assert.equal(await visible(img),false);assert.equal(await visible(pdf),false);
  });
  await t.test('released PDF requires its exact stored path and a valid signature; office policies remain effective',async()=>{
   await db.exec('RESET ROLE');await db.query("UPDATE assist_visit_proofs SET portal_release_status='released',signature_id=$2,pdf_storage_path=$3,pdf_hash=$4,payload_snapshot=$5 WHERE id=$1",[proof,sig,pdf,hash,{signedViaClientPortal:true,clientPortalPdfSignatureId:sig}]);await as();
   assert.ok(await visible(pdf));await assert.rejects(put(base+visit+'/proofs/'+proof+'-'+sig+'-extra.pdf'),e=>e.code==='42501');
   await db.exec('RESET ROLE');await db.query('UPDATE assist_visit_signatures SET is_valid=false WHERE id=$1',[sig]);await as();assert.equal(await visible(pdf),false);
   await as('business','admin');assert.ok(await visible(img2));await db.exec('RESET ROLE; SET ROLE anon');assert.equal(await visible(img2),false);
  });
 }finally{await db.close();}
});

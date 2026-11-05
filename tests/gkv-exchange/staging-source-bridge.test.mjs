import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {stagingSourceFixture} from './staging-source-fixture.mjs';

test('hosted legacy status constraint accepts canonical invoice drafts without upgrading old rows',async()=>{
 const {db}=await stagingSourceFixture();try{
 const tenant=randomUUID(),client=randomUUID(),actor=randomUUID();
 await db.query("INSERT INTO tenants(id,name) VALUES($1,'Synthetic')",[tenant]);
 await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name) VALUES($1,$2,'Test','Person')",[client,tenant]);
 await db.query("INSERT INTO profiles(id,auth_user_id,tenant_id,is_active,status) VALUES($1,$1,$2,true,'active')",[actor,tenant]);
 await db.query("SELECT set_config('test.claims',$1,false)",[JSON.stringify({sub:actor,tenant,portal:'business'})]);
 const payload={client_id:client,invoice_date:'2026-11-05',due_date:'2026-11-05',service_period_from:'2026-11-05',service_period_to:'2026-11-05',recipient_name:'Test',recipient_street:'Testweg',recipient_postal_code:'10115',recipient_city:'Berlin',recipient_country:'Deutschland',include_service_proofs:false,selected_proof_ids:[],lines:[{description:'Synthetic',unit:'Test',quantity:1,unit_price_cents:100,vat_rate:0,product_key:'assist'}]};
 const create=()=>db.query("SELECT public.office_invoice_mutation($1,$2,NULL,NULL,'save_draft',$3) value",[tenant,randomUUID(),payload]);
 await assert.rejects(create(),e=>e.code==='23514');
 await db.exec(await readFile(new URL('../../docs/gkv/sql/staging-invoice-status.sql',import.meta.url),'utf8'));
 const id=(await create()).rows[0].value.invoice_id;
 assert.deepEqual((await db.query('SELECT status,office_managed,total_cents FROM invoices WHERE id=$1',[id])).rows[0],{status:'draft',office_managed:true,total_cents:100});
 // This synthetic owner-created row tests only legacy projection/trigger order.
 // Signed-source verification is covered by the separate real verifier test.
 const record=randomUUID(),assignment=randomUUID();
 const receipt={version:'workflow-assignment-record-v1',tenant_id:tenant,client_id:client,assignment_id:assignment,employee_id:null,actual_minutes:1,service_started_at:'2026-11-05T12:00:00Z'};
 await db.query("INSERT INTO service_records(id,tenant_id,client_id,assignment_id,actual_minutes,service_date,source_receipt,total_amount) VALUES($1,$2,$3,$4,1,'2026-11-05',$5,1)",[record,tenant,client,assignment,receipt]);
 await db.exec('BEGIN');try{
  await db.query('INSERT INTO care_security.office_invoice_write_context VALUES(txid_current(),$1,$2,$3)',[tenant,id,actor]);
  await db.exec('SAVEPOINT prior');
  await assert.rejects(db.query('UPDATE service_records SET billed_invoice_id=$1 WHERE id=$2',[id,record]),/Rechnungsquelle ist unveränderlich/);
  await db.exec('ROLLBACK TO SAVEPOINT prior');
  await db.exec(await readFile(new URL('../../docs/gkv/sql/staging-source-trigger-order.sql',import.meta.url),'utf8'));
  await db.query('UPDATE service_records SET billed_invoice_id=$1 WHERE id=$2',[id,record]);
  assert.deepEqual((await db.query('SELECT billed_invoice_id,invoice_id FROM service_records WHERE id=$1',[record])).rows[0],{billed_invoice_id:id,invoice_id:id});
  await db.exec('SAVEPOINT immutable');
  await assert.rejects(db.query('UPDATE service_records SET total_amount=2 WHERE id=$1',[record]),/Rechnungsquelle ist unveränderlich/);
  await db.exec('ROLLBACK TO SAVEPOINT immutable');
 }finally{await db.exec('ROLLBACK')}
 await db.query("INSERT INTO invoices(tenant_id,title,status) VALUES($1,'Legacy','entwurf')",[tenant]);
 assert.equal((await db.query("SELECT count(*)::int n FROM invoices WHERE status='entwurf' AND NOT office_managed AND issued_at IS NULL")).rows[0].n,1);
 await assert.rejects(db.query("INSERT INTO invoices(tenant_id,title,status) VALUES($1,'Unverified','paid')",[tenant]),e=>e.code==='23514');
 }finally{await db.close()}
});

test('Storage policy dependency grants no payroll rows or amounts',async()=>{
 const {db}=await stagingSourceFixture();try{
 await db.exec(await readFile(new URL('../../docs/gkv/sql/staging-storage-read-dependencies.sql',import.meta.url),'utf8'));
 await db.exec("ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT SELECT ON storage.objects TO authenticated; CREATE POLICY fixture_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='office-documents' OR EXISTS(SELECT FROM payroll_month_statements s WHERE s.tenant_id=current_tenant_id() AND s.pdf_path=objects.name)); INSERT INTO storage.objects(bucket_id,name) VALUES('office-documents','synthetic-original'); SET ROLE authenticated;");
 assert.equal((await db.query('SELECT name FROM storage.objects')).rows.length,1);
 assert.equal((await db.query('SELECT tenant_id,pdf_path FROM payroll_month_statements')).rows.length,0);
 await assert.rejects(db.query('SELECT snapshot_json FROM payroll_month_statements'),e=>e.code==='42501');
 }finally{await db.close()}
});

test('real Office source verifier accepts the signed byte receipt and refuses changed billing facts',async t=>{
 const {assistOriginalFixture}=await import('./monthly-assist-fixture.mjs');
 const {readFile}=await import('node:fs/promises');
 const x=await assistOriginalFixture(),{f}=x,db=f.db;
 try{
  await db.exec('ALTER TABLE service_records ADD COLUMN billable_minutes integer,ADD COLUMN hourly_rate numeric,ADD COLUMN total_amount numeric;');
  const office=await readFile(new URL('../../supabase/migrations/20261018075737_office_invoice_workspace.sql',import.meta.url),'utf8');
  const start=office.indexOf('CREATE OR REPLACE FUNCTION care_security.office_invoice_assert_source');
  const end=office.indexOf('CREATE OR REPLACE FUNCTION care_security.office_invoice_proofs',start);
  // Replace the original fixture's Office double with the actual implementation.
  // Keep its parameter names identical to the real function contract.
  await db.exec('DROP FUNCTION care_security.office_invoice_assert_source(public.service_records,boolean);');
  await db.exec(office.slice(start,end));
  await x.approve(await x.submit());
  const v=await x.start();await x.finish(v);await x.seal(v,(await x.context(v)).draft);
  const response=await x.complete(v);assert.equal(response.status,200,await response.text());
  const r=(await f.as(x.claims(),'SELECT public.workflow_prepare_assignment_service_record($1,$2) value',[f.tenant,v.assignment])).rows[0].value;
  await db.query('UPDATE service_records SET billable_minutes=actual_minutes,hourly_rate=60,total_amount=actual_minutes WHERE id=$1',[r.id]);
  const month=await x.monthly(v);assert.equal(month.p.status,'open');assert.equal(month.p.payload.records[0].recordId,r.id);
  await t.test('an unchanged real canonical source remains readable',async()=>{
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(x.claims())]);
   await db.query('SELECT care_security.office_invoice_assert_source(s,true) FROM service_records s WHERE id=$1',[r.id]);
  });
  for(const [label,update,message] of [
   ['overbilling','billable_minutes=actual_minutes+1',/abrechenbare Dauer/],
   ['wrong price','total_amount=total_amount+1',/Nettobetrag/],
   ['revoked approval',null,/signierter Nachweis/]
  ])await t.test(label,async()=>{
   await db.exec('BEGIN');try{
    if(update)await db.query('UPDATE service_records SET '+update+' WHERE id=$1',[r.id]);
    else await db.query("UPDATE assist_visit_proofs SET status='pending_review',approved_at=NULL WHERE id=$1",[r.proof_id]);
    await assert.rejects(db.query('SELECT care_security.office_invoice_assert_source(s,true) FROM service_records s WHERE id=$1',[r.id]),message);
   }finally{await db.exec('ROLLBACK')}
  });
  await t.test('foreign tenant is refused before source reads',async()=>{
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(x.claims({tenant_id:randomUUID()}))]);
   await assert.rejects(db.query('SELECT care_security.office_invoice_assert_source(s,true) FROM service_records s WHERE id=$1',[r.id]),e=>e.code==='42501');
  });
 }finally{await x.close()}
});
test('staging bridge compiles all source and monthly contracts on the observed legacy schema',async()=>{
 const f=await stagingSourceFixture();try{
 await f.monthly();
 await f.db.exec(await readFile(new URL('../../docs/gkv/sql/staging-rpc-conflicts.sql',import.meta.url),'utf8'));
 const r=await f.db.query("select to_regprocedure('public.workflow_signed_proof_source(uuid,uuid,uuid,boolean,boolean)') is not null source,to_regprocedure('care_security.office_invoice_assert_source(public.service_records,boolean)') is not null invoice, to_regprocedure('public.gkv_assist_amend_description(uuid,uuid,uuid,jsonb)') is not null monthly");
 assert.deepEqual(r.rows[0],{source:true,invoice:true,monthly:true});
 const boundary=(await f.db.query("SELECT l.lanname,p.prosecdef FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid='public.office_invoice_mutation(uuid,uuid,uuid,timestamptz,text,jsonb)'::regprocedure")).rows[0];
 assert.deepEqual(boundary,{lanname:'plpgsql',prosecdef:false});
 // Exercise the real public wrapper with a deliberate internal stale-source
 // conflict. Its exception subtransaction must roll back all partial writes.
 await f.db.exec("CREATE TABLE conflict_probe(id integer); CREATE OR REPLACE FUNCTION care_security.office_invoice_mutation(p_tenant_id uuid,p_request_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz,p_operation text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN INSERT INTO public.conflict_probe VALUES(1); RAISE SQLSTATE '40001' USING MESSAGE='stale approved source'; END $$;");
 await assert.rejects(f.db.query('SELECT public.office_invoice_mutation(NULL,NULL,NULL,NULL,NULL,NULL)'),e=>e.code==='PT409'&&e.message==='stale approved source');
 assert.equal((await f.db.query('SELECT count(*)::int n FROM conflict_probe')).rows[0].n,0);
 for(const role of ['anon','authenticated','service_role']){
 const acl=await f.db.query("select has_table_privilege($1,'public.workflow_proof_attestations','INSERT') writable",[role]);assert.equal(acl.rows[0].writable,false);
 }
 }finally{await f.db.close()}
});
test('old staging records keep their facts without becoming signed or approved',async()=>{
 const {db}=await stagingSourceFixture();try{
 const t=randomUUID(),c=randomUUID(),v=randomUUID();
 await db.query('INSERT INTO tenants(id,name) VALUES($1,$2)',[t,'Synthetic']);
 await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name) VALUES($1,$2,'Test','Person')",[c,t]);
 await db.query("INSERT INTO service_records(id,tenant_id,client_id,performed_at,duration_minutes,service_type) VALUES($1,$2,$3,'2026-01-01T23:30:00Z',45,'Legacy support')",[v,t,c]);
 let r=(await db.query('select service_date::text,status::text,source_receipt,actual_minutes,invoice_id,duration_minutes,service_type from service_records where id=$1',[v])).rows[0];
 assert.deepEqual(r,{service_date:'2026-01-02',status:'draft',source_receipt:{},actual_minutes:null,invoice_id:null,duration_minutes:45,service_type:'Legacy support'});
 await db.query("select set_config('test.claims',$1,false)",[JSON.stringify({sub:randomUUID(),tenant:t,portal:'business'})]);
 await assert.rejects(db.query('SELECT care_security.office_invoice_assert_source(s,true) FROM service_records s WHERE id=$1',[v]),/Tatsächliche Leistung/);
 }finally{await db.close()}
});

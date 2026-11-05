// Additive bridge for the reviewed legacy staging schema. Prints SQL only.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const q=s=>"'"+s.replaceAll("'","''")+"'";
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const pin=async(path,digest)=>{const s=await read(path);if(createHash('sha256').update(s).digest('hex')!==digest)throw Error('Review source '+path);return s;};
const untransaction=s=>s.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'');
export async function sourceStatements(){
 const ref=JSON.parse(await read('docs/gkv/checks/canonical-billing-reference.json'));
 const upstream=JSON.parse(await read('docs/gkv/checks/upstream-schema-reference.json'));
 const sql=[];
 const enums={...upstream.enums,billing_party:['care_insurance','health_insurance','self_payer','social_welfare','other'],
 invoice_recipient_type:['client','relative','care_insurance','health_insurance','social_welfare','company','other']};
 for(const e of ref.enums)(enums[e.name]??=[]).push(e.value);
 for(const [name,labels] of Object.entries(enums)){
  if(['product_key','audit_action_type'].includes(name))continue;
  sql.push('CREATE TYPE public.'+ident(name)+' AS ENUM ('+labels.map(q).join(',')+');');
 }
 const old={service_records:new Set(['id','tenant_id','client_id','performed_at','duration_minutes','service_type','employee_id','invoice_id','created_at','assist_visit_id']),
 invoices:new Set(['id','tenant_id','title','invoice_number','client_name','total_cents','status','due_date','notes','created_at','updated_at'])};
 for(const c of ref.columns){
  if(old[c.table].has(c.name))continue;
  // No invented issue dates, numbers, signed sources or approval for old rows.
  const def=c.name==='invoice_date'?null:c.default;
  const required=c.required&&def!==null;
  sql.push('ALTER TABLE public.'+ident(c.table)+' ADD COLUMN '+ident(c.name)+' '+c.type+
   (def!==null?' DEFAULT '+def:'')+(required?' NOT NULL':'')+';');
 }
 for(const name of ['documentation_entries','signatures','time_entries','invoice_items','payments','payroll_month_statements']){
  const t=upstream.tables[name];
  sql.push('CREATE TABLE public.'+ident(name)+' (\n'+t.columns.map(([n,typ,nn,def])=>ident(n)+' '+typ+(def!==null?' DEFAULT '+def:'')+(nn==='NOT NULL'?' NOT NULL':'')).concat(t.constraints.map(([n,def])=>'CONSTRAINT '+ident(n)+' '+def)).join(',\n')+'\n);');
  sql.push('ALTER TABLE public.'+ident(name)+' ENABLE ROW LEVEL SECURITY;',
   'REVOKE ALL ON public.'+ident(name)+' FROM PUBLIC, anon, authenticated, service_role;');
 }
 sql.push(await read('docs/gkv/sql/staging-billing-master-columns.sql'));
 sql.push(await read('docs/gkv/sql/staging-source-compatibility.sql'));
 const workflow=await pin('supabase/migrations/20261013072827_verified_assignment_service_records.sql','1913db2a0416b6f47cc685aa4965456110ad90bc5a79423b3fa4d711a53ffab1');
 const begin=workflow.indexOf('DO $$ BEGIN'),canon=workflow.indexOf('-- Same sorted-key JSON'),source=workflow.indexOf('CREATE OR REPLACE FUNCTION public.workflow_signed_proof_source');
 if(begin<0||canon<begin||source<canon)throw Error('Workflow boundary changed');
 // Keep staging's newer authorization, task matching and canonical JSON helpers.
 sql.push(workflow.slice(begin,canon),workflow.slice(source));
 // Service keys call the locked compare-and-set, never forge attestation rows.
 sql.push('REVOKE ALL ON public.workflow_proof_attestations FROM PUBLIC,anon,authenticated,service_role;');
 sql.push(untransaction(await pin('supabase/migrations/20261018075737_office_invoice_workspace.sql','5c8499524f3248f4fef994e12e0fdad5a788ec0a14a2268523ce33dad6d8bc3e')));
 sql.push("GRANT SELECT ON public.invoice_items,public.payments TO authenticated;\n"+
 "CREATE POLICY gkv_invoice_items_scoped_read ON public.invoice_items FOR SELECT TO authenticated USING(care_security.office_actor(tenant_id,'office.invoices.view'));\n"+
 "CREATE POLICY gkv_payments_scoped_read ON public.payments FOR SELECT TO authenticated USING(care_security.office_actor(tenant_id,'office.invoices.view'));");
 const inv=await read('supabase/migrations/20261019214757_gkv_invoice_source_snapshot.sql');
 sql.push(untransaction(inv).replace("coalesce(inv.status::text,'') IN ('','draft','cancelled')",
  "(inv.status::text NOT IN ('ready','sent','partly_paid','paid','overdue','written_off') OR NOT inv.office_managed OR inv.issued_at IS NULL OR inv.issued_snapshot IS NULL)"));
 sql.push('REVOKE ALL ON FUNCTION public.workflow_signed_proof_source(uuid,uuid,uuid,boolean,boolean),care_security.office_invoice_assert_source(public.service_records,boolean) FROM PUBLIC,anon,authenticated,service_role;');
 sql.push("NOTIFY pgrst,'reload schema';");
 return sql.join('\n');
}
export async function sourcePackage(){
 return "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='45s'; SET LOCAL search_path=pg_catalog,public;\n"+
 await read('docs/gkv/checks/staging-source-target.sql')+'\n'+await sourceStatements();
}
export const monthlyFiles=['proofs','workspace','original-verifier','worker-bridge','authorities','facts','employees','assist-originals','assist-deferred','assist-amendments'];
export async function monthlyStatements(){
 const bodies=[];for(const name of monthlyFiles)bodies.push(untransaction(await read('docs/gkv/sql/monthly-'+name+'-draft.sql')));
 return bodies.join('\n');
}
export async function monthlyPackage(){
 return "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='45s'; SET LOCAL search_path=pg_catalog,public;\n"+
 await read('docs/gkv/checks/staging-monthly-target.sql')+await monthlyStatements();
}
export async function storageDependencyPackage(){
 return "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='15s';\nDO $$ BEGIN IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261105061732' AND name='gkv_staging_canonical_sources_and_invoice_bridge') OR NOT EXISTS(SELECT FROM pg_class WHERE oid='public.payroll_month_statements'::regclass AND relrowsecurity) OR EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename='payroll_month_statements') THEN RAISE EXCEPTION 'Unreviewed staging Storage dependency'; END IF; END $$;\nGRANT SELECT (tenant_id,pdf_path) ON public.payroll_month_statements TO authenticated;";
}
export async function portalRowsPackage(){
 return "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='20s';\nDO $$ BEGIN IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE name='gkv_staging_canonical_sources_and_invoice_bridge') OR to_regprocedure('care_security.gkv_portal_row_scope(uuid,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Unreviewed staging row target'; END IF; END $$;\n"+
 await read('supabase/migrations/20261105064400_guard_portal_original_rows.sql');
}
export async function rpcConflictsPackage(){
 return "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='20s';\nDO $$ BEGIN IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE name='gkv_staging_monthly_workflow') THEN RAISE EXCEPTION 'Unreviewed staging RPC target'; END IF; END $$;\n"+await read('docs/gkv/sql/staging-rpc-conflicts.sql');
}
export async function invoiceStatusPackage(){
 return "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='20s';\nDO $$ BEGIN IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE name='gkv_staging_canonical_sources_and_invoice_bridge') THEN RAISE EXCEPTION 'Unreviewed staging invoice target'; END IF; END $$;\n"+await read('docs/gkv/sql/staging-invoice-status.sql');
}
export async function sourceTriggerPackage(){
 return "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='15s';\nDO $$ BEGIN IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE name='gkv_staging_canonical_sources_and_invoice_bridge') THEN RAISE EXCEPTION 'Unreviewed staging source target'; END IF; END $$;\n"+await read('docs/gkv/sql/staging-source-trigger-order.sql');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2];
 if(mode==='--migration-body')process.stdout.write(await sourcePackage());
 else if(mode==='--monthly-body')process.stdout.write(await monthlyStatements());
 else if(mode==='--monthly-migration-body')process.stdout.write(await monthlyPackage());
 else if(mode==='--storage-migration-body')process.stdout.write(await storageDependencyPackage());
 else if(mode==='--portal-rows-migration-body')process.stdout.write(await portalRowsPackage());
 else if(mode==='--rpc-conflicts-migration-body')process.stdout.write(await rpcConflictsPackage());
 else if(mode==='--invoice-status-migration-body')process.stdout.write(await invoiceStatusPackage());
 else if(mode==='--source-trigger-migration-body')process.stdout.write(await sourceTriggerPackage());
 else throw Error('Expected an explicit migration-body mode');
}

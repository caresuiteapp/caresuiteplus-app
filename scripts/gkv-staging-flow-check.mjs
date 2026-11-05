// Exercises hosted HTTP/Auth/PostgREST/Storage/Edge boundaries using synthetic data.
import {s,save,api,must,rpc} from './gkv-staging-auth-check.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {jsPDF} from 'jspdf';
import {signingPng} from '../tests/gkv-exchange/monthly-host-fixture.mjs';
import {canonicalJson} from '../supabase/functions/complete-assist-service-record/proofBytes.ts';
const mode=process.argv[2],iso=()=>new Date().toISOString();
const hash=v=>createHash('sha256').update(v).digest('hex');
const jsonHash=v=>'sha256:'+hash(canonicalJson(v));
async function ok(check){s.checks.push({check,passed:true,at:iso()});await save(s);console.log(JSON.stringify({check,passed:true}));}
async function insert(who,table,row){const data=await must(who,'/rest/v1/'+table,row);if(!Array.isArray(data)||data.length!==1)throw Error('Insert not confirmed: '+table);return data[0];}
async function update(who,table,id,data){const rows=await must(who,'/rest/v1/'+table+'?id=eq.'+id+'&tenant_id=eq.'+s.tenant,data,'PATCH');if(rows.length!==1)throw Error('Update not confirmed: '+table);return rows[0];}
async function upload(who,path,bytes,mime,readback=true){
 const r=await fetch(s.url+'/storage/v1/object/office-documents/'+path,{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:s.key,Authorization:'Bearer '+s.users[who].token,'Content-Type':mime,'x-upsert':'false'},body:bytes});
 if(!r.ok){const failure=await r.json();if(failure.error!=='Duplicate')throw Error('Upload failed '+r.status+': '+JSON.stringify(failure));}
 if(!readback)return;
 const read=await download(who,path);if(hash(read)!==hash(bytes))throw Error('Storage bytes differ');return read;
}
async function download(who,path){
 const r=await fetch(s.url+'/storage/v1/object/authenticated/office-documents/'+path,{signal:AbortSignal.timeout(20000),headers:{apikey:s.key,Authorization:'Bearer '+s.users[who].token}});
 if(!r.ok)throw Error('Read failed '+r.status+': '+await r.text());return Buffer.from(await r.arrayBuffer());
}
if(mode==='--start'){
 if(s.visit)throw Error('Test visit already started; continue its saved state');
 const r=await rpc('employee','gkv_employee_command',{t:s.tenant,p_request:randomUUID(),p_action:'submit',p_input:{id:randomUUID(),employeeNumber:'234567890',evidenceReference:'SYNTHETISCHER TEST. Keine reale Beschäftigtennummer.'}});
 s.registration=await rpc('office','gkv_employee_command',{t:s.tenant,p_request:randomUUID(),p_action:'approve',p_input:{id:r.id,revision:r.revision,reviewed:true,reviewReference:'SYNTHETISCHER TEST der unabhängigen Freigabe',reviewNote:'Getrennte angemeldete Testpersonen; keine amtliche Registrierung.',validUntil:new Date(Date.now()+3*3600000).toISOString()}});
 await ok('employee_registration_separate_authenticated_reviewer');
 const begin=iso(),plannedEnd=new Date(Date.now()+180000).toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const visitId=randomUUID();s.visit={assignment:visitId,id:visitId,proof:randomUUID(),signature:randomUUID(),task:randomUUID(),start:begin,plannedEnd,date};await save(s);const v=s.visit;
 // The existing published-visit trigger creates its canonical assignment mirror.
 await insert('office','assist_visits',{id:v.id,tenant_id:s.tenant,legacy_assignment_id:v.assignment,client_id:s.client,employee_id:s.employee,title:'SYNTHETISCHER GKV Testeinsatz',assignment_date:date,planned_start_at:begin,planned_end_at:plannedEnd,planning_status:'published'});
 await update('employee','assignments',v.assignment,{status:'started',actual_start_at:begin});
 await update('employee','assist_visits',v.id,{canonical_status:'in_progress',actual_start_at:begin});
 await insert('employee','assist_time_events',{id:randomUUID(),tenant_id:s.tenant,visit_id:v.id,event_type:'service_start',occurred_at:begin});
 await insert('employee','assist_visit_tasks',{id:v.task,tenant_id:s.tenant,visit_id:v.id,title:'Synthetische Testleistung',status:'done'});
 await ok('employee_started_assigned_visit_over_http');
}
if(mode==='--finish'){
 if(s.checks.some(c=>c.check==='employee_released_bound_content_to_client'))throw Error('Release already completed');
 const v=s.visit;if(!v)throw Error('Start visit first');
 if(Date.now()-Date.parse(v.start)<60000)throw Error('At least one actual test minute must elapse; do not backdate');
 v.end??=iso();await save(s);
 await update('employee','assignments',v.assignment,{status:'signature_open',actual_end_at:v.end});
 await update('employee','assist_visits',v.id,{canonical_status:'signature_pending',actual_end_at:v.end});
 await insert('employee','assist_time_events',{id:randomUUID(),tenant_id:s.tenant,visit_id:v.id,event_type:'service_end',occurred_at:v.end});
 await insert('employee','assist_visit_documentation',{id:randomUUID(),tenant_id:s.tenant,visit_id:v.id,short_description:'Synthetische dokumentierte Unterstützung. Ausschließlich Softwareprüfung.',submitted_at:v.end});
 s.snapshot={visitId:v.id,clientId:s.client,employeeId:s.employee,plannedStartAt:v.start,plannedEndAt:v.plannedEnd,tasks:[{id:v.task,title:'Synthetische Testleistung',status:'done'}],
 documentationNote:'Synthetische dokumentierte Unterstützung. Ausschließlich Softwareprüfung.',
 visitTimes:{serviceStartedAt:v.start,serviceEndedAt:v.end,serviceSeconds:Math.round((Date.parse(v.end)-Date.parse(v.start))/1000)},
 signature:null,signerName:null,signedAt:null,signatureDeferredToClientPortal:true,signatureDeferredAt:iso(),signatureDeferredBy:s.users.employee.id,signatureDeferredReason:'Synthetische Portalnachsignatur'};
 await save(s);await insert('employee','assist_visit_proofs',{id:v.proof,tenant_id:s.tenant,visit_id:v.id,payload_snapshot:s.snapshot,payload_hash:jsonHash(s.snapshot)});
 await rpc('employee','employee_portal_release_deferred_signature',{p_tenant_id:s.tenant,p_proof_id:v.proof,p_client_id:s.client,p_title:'Synthetischer Tagesnachweis',p_payload_snapshot:s.snapshot,p_payload_hash:jsonHash(s.snapshot)});
 await ok('employee_released_bound_content_to_client');
}
if(mode==='--sign'){
 if(s.clientReceipt)throw Error('Client completion already saved; use --isolation');
 const v=s.visit;
 const rows=await must('client','/rest/v1/assist_visit_proofs?id=eq.'+v.proof+'&select=*');
 if(rows.length!==1)throw Error('Client cannot read own released original');
 const p=rows[0],png=Buffer.from(signingPng(),'base64'),path='tenant/'+s.tenant+'/assist/visits/'+v.id+'/signatures/'+v.signature+'.png';
 await upload('client',path,png,'image/png',false);
 const payload={visitId:v.id,clientId:s.client,employeeId:s.employee,plannedStartAt:s.snapshot.plannedStartAt,plannedEndAt:s.snapshot.plannedEndAt,
  taskStatuses:s.snapshot.tasks.map(t=>({taskId:t.id,status:t.status})),documentationNote:s.snapshot.documentationNote};
 const existing=await must('client','/rest/v1/assist_visit_signatures?id=eq.'+v.signature+'&select=*');
 const sig=existing[0]??await insert('client','assist_visit_signatures',{id:v.signature,tenant_id:s.tenant,visit_id:v.id,signer_name:'Synthetischer Testklient',signer_role:'client',storage_path:path,
 payload_hash:jsonHash(payload),signature_hash:'sha256:'+hash('data:image/png;base64,'+png.toString('base64')),signed_at:iso(),is_valid:true,
 metadata:{proofId:v.proof,signedVia:'client_portal',proofPayloadHash:p.payload_hash}});
 if(sig.storage_path!==path||hash(await download('client',path))!==hash(png))throw Error('Stored signature mismatch');
 await ok('client_signature_upload_readback');
 const signed=new Date(sig.signed_at).toISOString();
 const snapshot={...p.payload_snapshot,signatureDeferredToClientPortal:false,clientPortalSignedAt:signed,signedViaClientPortal:true,clientPortalPdfSignatureId:v.signature,
 signerName:sig.signer_name,signedAt:signed,signature:{signerName:sig.signer_name,signerRole:'client',signedAt:signed}};
 const pdf=new jsPDF();pdf.text('SYNTHETISCHER TEST-LEISTUNGSNACHWEIS',15,20);pdf.text(s.snapshot.documentationNote,15,35,{maxWidth:175});pdf.text(v.id,15,55);pdf.addImage(png,'PNG',15,70,75,30);
 const bytes=Buffer.from(pdf.output('arraybuffer')),pdfPath='tenant/'+s.tenant+'/assist/visits/'+v.id+'/proofs/'+v.proof+'-'+v.signature+'-'+randomUUID()+'.pdf';
 await upload('client',pdfPath,bytes,'application/pdf');
 const result=await rpc('client','client_portal_finalize_assist_proof',{p_tenant_id:s.tenant,p_proof_id:v.proof,p_signature_id:v.signature,p_expected_payload_hash:p.payload_hash,p_signed_payload_hash:jsonHash(snapshot),p_pdf_storage_path:pdfPath,p_pdf_hash:hash(bytes)});
 s.clientReceipt=result;s.signaturePath=path;s.clientPdfPath=pdfPath;await ok('client_signed_and_completed_actual_stored_pdf');
}
if(mode==='--isolation'){
 const v=s.visit,path=s.signaturePath;
 if(!s.clientReceipt||!path)throw Error('Signed source first');
 const own=await must('client','/rest/v1/assist_visit_proofs?id=eq.'+v.proof+'&select=id,pdf_hash');
 if(own.length!==1||hash(await download('client',s.clientPdfPath))!==own[0].pdf_hash.replace(/^sha256:/,''))throw Error('Own client original no longer readable');
 const sig=await must('otherClient','/rest/v1/assist_visit_signatures?id=eq.'+v.signature+'&select=id');if(sig.length)throw Error('Foreign signature row readable');
 const foreign=await api('otherClient','/rest/v1/assist_visit_proofs?id=eq.'+v.proof+'&select=id');
 if(!foreign.ok||foreign.data.length)throw Error('Cross-client source isolation failed');
 const denied=await fetch(s.url+'/storage/v1/object/authenticated/office-documents/'+path,{signal:AbortSignal.timeout(20000),headers:{apikey:s.key,Authorization:'Bearer '+s.users.otherClient.token}});
 if(denied.ok||![400,403,404].includes(denied.status))throw Error('Cross-client Storage denial not established');await ok('other_client_cannot_read_original_or_signature');
 const changed=await api('client','/rest/v1/assist_visit_proofs?id=eq.'+v.proof,{pdf_hash:'0'.repeat(64)},'PATCH');
 if(changed.ok&&changed.data.length!==0)throw Error('Client could overwrite signed original');
 await ok('own_original_readable_but_direct_client_overwrite_denied');
}
if(mode==='--complete'){
 const v=s.visit;
 await update('employee','assignments',v.assignment,{status:'completed'});
 await update('employee','assist_visits',v.id,{canonical_status:'completed'});
 const c=await rpc('employee','gkv_assist_original_context',{t:s.tenant,a_id:v.assignment});
 if(!s.sealed)s.sealed=await rpc('employee','gkv_assist_original_seal',{t:s.tenant,a_id:v.assignment,p_request:randomUUID(),p_expected:c.draft});
 await ok('employee_sealed_exact_original');
 const result=await must('employee','/functions/v1/complete-assist-service-record',{tenantId:s.tenant,assignmentId:v.assignment});
 if(result.ok!==true)throw Error('Worker did not confirm bytes: '+JSON.stringify(result));
 s.worker=result.data;await ok('hosted_edge_rendered_and_verified_original_pdf');
 s.record=await rpc('employee','workflow_prepare_assignment_service_record',{p_tenant_id:s.tenant,p_assignment_id:v.assignment});
 await ok('canonical_service_record_references_byte_receipt');
}
if(mode==='--approve'){
 if(!s.record?.id)throw Error('Canonical completion first');
 const [r]=await must('office','/rest/v1/service_records?id=eq.'+s.record.id+'&select=*');
 if(!r?.source_receipt?.pdf_sha256)throw Error('Original byte receipt missing');
 const bytes=await download('office',r.source_receipt.pdf_storage_path);
 if('sha256:'+hash(bytes)!==r.source_receipt.pdf_sha256)throw Error('Signed original differs from server receipt');
 s.originalSha256=hash(bytes);await ok('office_retrieved_exact_server_verified_original');
 const failed=await api('office','/rest/v1/assist_visit_proofs?id=eq.'+r.source_receipt.proof_id,{pdf_hash:'0'.repeat(64)},'PATCH');
 if(failed.ok||!['42501','P0001'].includes(failed.data?.code))throw Error('Original immutability not established');
 await ok('confirmed_original_hash_cannot_be_replaced');
 await update('office','assist_visit_proofs',r.source_receipt.proof_id,{status:'approved',approved_at:iso(),approved_by:s.users.office.id,billing_released:true});
 s.approved=await update('office','service_records',r.id,{status:'approved',approved_at:iso(),approved_by:s.users.office.id,billable_minutes:r.actual_minutes,hourly_rate:60,total_amount:r.actual_minutes,updated_at:iso()});
 await ok('independent_office_approved_signed_source_and_billing');
}
if(mode==='--monthly'){
 if(s.monthly)throw Error('Monthly record already saved');
 s.monthly=await rpc('office','gkv_monthly_proof_command',{p_tenant_id:s.tenant,p_request_id:randomUUID(),p_action:'create',p_input:{new_id:randomUUID(),client_id:s.client,month:s.visit.date.slice(0,7),service_type:'01',source_ids:[s.record.id]}});
 if(s.monthly.status!=='open'||s.monthly.payload.records[0].recordId!==s.record.id)throw Error('Monthly source binding failed');
 await ok('monthly_record_contains_exact_approved_source');
}
if(mode==='--invoice'){
 if(!s.monthly||!s.approved)throw Error('Monthly and approved source first');if(s.invoice)throw Error('Invoice already saved');
 const [r]=await must('office','/rest/v1/service_records?id=eq.'+s.record.id+'&select=*');
 const payload={client_id:s.client,invoice_date:s.visit.date,due_date:s.visit.date,service_period_from:s.visit.date,service_period_to:s.visit.date,
 recipient_type:'client',billing_party:'self_payer',recipient_name:'Synthetischer Testklient',recipient_street:'Testweg',recipient_house_number:'2',recipient_postal_code:'10115',recipient_city:'Berlin',recipient_country:'Deutschland',
 notes:'SYNTHETISCHER SOFTWARETEST. Keine Forderung, keine Ausstellung, kein Versand.',include_service_proofs:true,selected_proof_ids:['record:'+r.id],
 lines:[{description:'Synthetische geprüfte Testleistung',quantity:1,unit:'Testleistung',unit_price_cents:Math.round(r.total_amount*100),vat_rate:0,product_key:r.product_key,service_date:r.service_date,service_record_id:r.id,source_updated_at:r.updated_at}]};
 const command=p=>({p_tenant_id:s.tenant,p_request_id:randomUUID(),p_invoice_id:null,p_expected_updated_at:null,p_operation:'save_draft',p_payload:p});
 const bad=structuredClone(payload);bad.lines[0].unit_price_cents++;
 const denied=await api('office','/rest/v1/rpc/office_invoice_mutation',command(bad));
 if(denied.status!==409||denied.data?.code!=='PT409')throw Error('Changed invoice amount was not rejected by source check: '+JSON.stringify(denied));
 await ok('invoice_rejects_amount_different_from_approved_source');
 s.invoice=await rpc('office','office_invoice_mutation',command(payload));await save(s);
 const duplicate=await api('office','/rest/v1/rpc/office_invoice_mutation',command(payload));
 if(duplicate.ok||!['PT409','P0001'].includes(duplicate.data?.code))throw Error('Duplicate billing not rejected');
 await ok('invoice_bound_once_to_approved_signed_source');
 const [final]=await must('office','/rest/v1/service_records?id=eq.'+r.id+'&select=id,billed_invoice_id,invoice_id');
 if(!final.billed_invoice_id||final.invoice_id!==final.billed_invoice_id)throw Error('Legacy invoice reference differs');
 s.invoiceId=final.billed_invoice_id;await ok('legacy_and_canonical_invoice_references_agree');
}
if(mode==='--verify-chain'){
 const [invoice]=await must('office','/rest/v1/invoices?id=eq.'+s.invoiceId+'&select=id,status,issued_at,sent_at,selected_proof_ids,total_amount,total_cents');
 const lines=await must('office','/rest/v1/invoice_items?invoice_id=eq.'+s.invoiceId+'&select=service_record_id');
 const [month]=await must('office','/rest/v1/gkv_monthly_proofs?id=eq.'+s.monthly.id+'&select=id,status,payload,confirmation');
 const [record]=await must('office','/rest/v1/service_records?id=eq.'+s.record.id+'&select=id,source_receipt,billed_invoice_id,invoice_id,total_amount');
 if(invoice.status!=='draft'||invoice.issued_at!==null||invoice.sent_at!==null||invoice.total_amount!==record.total_amount
  ||invoice.total_cents!==Math.round(record.total_amount*100)||JSON.stringify(invoice.selected_proof_ids)!==JSON.stringify(['record:'+record.id])
  ||lines.length!==1||lines[0].service_record_id!==record.id||record.billed_invoice_id!==invoice.id||record.invoice_id!==invoice.id
  ||month.status!=='final'||month.payload.records[0].recordId!==record.id||month.payload.records[0].sourceReceipt.pdf_sha256!==record.source_receipt.pdf_sha256
  ||month.confirmation.receiptId!==s.monthlyReceipt.receiptId)throw Error('Final hosted chain does not agree');
 await ok('final_hosted_invoice_monthly_source_and_original_chain_agree');
}

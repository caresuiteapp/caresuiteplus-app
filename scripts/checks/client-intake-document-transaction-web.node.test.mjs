import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isUuid } from '../../src/lib/validation/uuid.ts';

const source = stripTypeScriptTypes(readFileSync(new URL('../../src/features/intakeDocuments/intakeDocumentTransaction.web.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = '2026-10-15T11:00:00.123456+00:00';
const clone = value => structuredClone(value);
function form() {
  const doc = (key, type, roles) => ({ templateKey:key, documentType:type, title:`Original ${key}`, isRequired:true,
    status:'finalized', source:'system', tenantTemplateId:null, version:2, missingPlaceholders:[], unresolvedKeys:[],
    previewHtml:`<p>${key}</p>`, finalizedHtml:`<p>${key} ORIGINAL</p>`, renderedPdfPath:null,
    previewOpenedAt:at, finalizedAt:at,
    signatures:Object.fromEntries(roles.map(role => [role, {role, dataUrl:'data:image/png;base64,QUJD',signedAt:at,signerName:role}])) });
  return { firstName:'Fiktive Person', intakeContractType:'ambulatory_care', intakeAssignmentEnabled:false,
    intakeDocuments:[doc('privacy_consent_default','privacy_consent',['client']),doc('client_contract_ambulatory_care','client_contract',['client','employee'])] };
}
const empty = () => ({tenant_id:id(1),client_id:id(3),documents:[],signatures:[],records:[],events:[],selection:null,consent:null});
function envelope(packet, requestId=id(80)) {
  const native=empty();
  packet.documents.forEach((doc,i) => {
    const document={id:id(100+i),tenant_id:id(1),client_id:id(3),template_key:doc.templateKey,document_type:doc.documentType,
      title:doc.title,status:doc.status,is_required:doc.isRequired,version:doc.version,source:doc.source,tenant_template_id:doc.tenantTemplateId??null,
      preview_html:doc.previewHtml,finalized_html:doc.finalizedHtml,rendered_pdf_path:doc.renderedPdfPath,
      missing_placeholders:doc.missingPlaceholders,preview_opened_at:doc.previewOpenedAt,finalized_at:doc.finalizedAt,updated_by:id(2),created_at:at,updated_at:at};
    native.documents.push(document);
    Object.entries(doc.signatures).forEach(([role,sig],j) => native.signatures.push({id:id(200+i*5+j),tenant_id:id(1),client_id:id(3),document_id:document.id,
      signer_role:role,signature_data:sig.dataUrl,signed_at:sig.signedAt,signer_name:sig.signerName??null,created_at:at}));
    native.records.push({id:id(300+i),tenant_id:id(1),client_id:id(3),intake_document_id:document.id,source:'intake',mime_type:'text/html',
      title:doc.title,file_name:`${doc.templateKey}.html`,status:'abgeschlossen',portal_visible:true,created_at:at,updated_at:at});
    native.events.push({id:id(400+i),tenant_id:id(1),client_id:id(3),document_id:document.id,event_type:'web_intake_packet_committed',actor_profile_id:id(2),metadata_json:{request_id:requestId},created_at:at});
  });
  native.selection={id:id(500),tenant_id:id(1),client_id:id(3),contract_type:packet.contractType,selected_template_key:packet.documents[1].templateKey,updated_by:id(2)};
  native.consent={id:id(501),tenant_id:id(1),client_id:id(3),privacy_status:'finalized',contract_status:'finalized',assignment_status:'skipped_optional',privacy_finalized_at:at,contract_finalized_at:at,updated_by:id(2)};
  return {tenant_id:id(1),client_id:id(3),actor_profile_id:id(2),request_id:requestId,status:'committed',committed_at:at,packet_original:clone(packet),native_original:native};
}
function environment(controls={}) {
  const calls=[];let allowed=true,sdk;
  const db={async rpc(name,args){
    const call={name,args:clone(args)};calls.push(call);await controls.before?.(call,env);
    if(controls.throwAt===name)throw Error('Lost transport after dispatch');
    if(controls.errorAt===name)return{data:controls.mixed?{}:null,error:{code:controls.code??'FETCH_ERROR',message:'unconfirmed'}};
    const data=name==='web_read_client_intake_document_packet'?{lead_updated_at:at,original:empty()}:envelope(args.p_packet,args.p_request_id);
    return{data:controls.mutate?.(data,call)??data,error:null};
  }};
  sdk=db;
  const functions=new Function('getSupabaseClient','isUuid',`${source};return {captureIntakeDocumentPacket,persistWebClientIntakeDocuments,confirmWebClientIntakeDocuments};`)(()=>sdk,isUuid);
  const context={requestId:id(80),isCurrent:()=>allowed};
  const env={calls,functions,context,setAllowed:value=>{allowed=value;},replaceSdk:()=>{sdk={};},
    persist:input=>functions.persistWebClientIntakeDocuments(id(1),id(3),input??form(),id(2),context),
    confirm:input=>functions.confirmWebClientIntakeDocuments(id(1),id(3),input??form(),id(2),context)};
  return env;
}

test('the real Web adapter sends one complete packet after a complete original read and accepts its bound receipt',async()=>{
  const e=environment();assert.deepEqual(await e.persist(),{ok:true,data:{id:id(3),requestId:id(80),confirmedAt:at}});
  assert.deepEqual(e.calls.map(call=>call.name),['web_read_client_intake_document_packet','web_commit_client_intake_document_packet']);
  const args=e.calls[1].args;assert.equal(args.p_expected_lead_updated_at,at);assert.deepEqual(args.p_expected_original,empty());
  assert.equal(args.p_actor_profile_id,id(2));assert.equal(args.p_packet.documents[1].signatures.employee.signedAt,at);
});
test('reload uses only the native receipt lookup, never a write or a new request',async()=>{
  const e=environment();assert.equal((await e.confirm()).ok,true);assert.deepEqual(e.calls.map(call=>call.name),['web_confirm_client_intake_document_packet']);
  assert.equal(e.calls[0].args.p_request_id,id(80));
});
test('the complete packet is copied before the first awaited read',async()=>{
  const input=form();const e=environment({before:call=>{if(call.name.startsWith('web_read')){input.intakeDocuments[0].finalizedHtml='mutated';input.intakeDocuments[1].signatures.employee.signedAt='changed';}}});
  assert.equal((await e.persist(input)).ok,true);assert.match(e.calls[1].args.p_packet.documents[0].finalizedHtml,/ORIGINAL/);
  assert.equal(e.calls[1].args.p_packet.documents[1].signatures.employee.signedAt,at);
});
for(const phase of ['web_read_client_intake_document_packet','web_commit_client_intake_document_packet']){
  test(`authority lost during ${phase} cannot confirm or start a subsequent write`,async()=>{
    const e=environment({before:call=>{if(call.name===phase)e.setAllowed(false);}});const result=await e.persist();
    assert.equal(result.ok,false);assert.equal(e.calls.length,phase.includes('read')?1:2);
    assert.equal(result.documentWriteRejected,phase.includes('read')?true:undefined);
  });
  test(`replaced SDK during ${phase} invalidates the captured operation`,async()=>{
    const e=environment({before:call=>{if(call.name===phase)e.replaceSdk();}});assert.equal((await e.persist()).ok,false);
    assert.equal(e.calls.length,phase.includes('read')?1:2);
  });
}
for(const code of ['P0D01','P0D02','P0D03','42501','22023'])test(`a confirmed empty-data SQL rejection ${code} permits a new explicit review`,async()=>{
  const e=environment({errorAt:'web_commit_client_intake_document_packet',code});const result=await e.persist();
  assert.equal(result.ok,false);assert.equal(result.documentWriteRejected,true);
});
for(const controls of [
  {errorAt:'web_commit_client_intake_document_packet'},
  {throwAt:'web_commit_client_intake_document_packet'},
  {errorAt:'web_commit_client_intake_document_packet',code:'P0D02',mixed:true},
])test('a lost, thrown or contradictory acknowledgement never authorizes replay',async()=>{
  const e=environment(controls);const result=await e.persist();assert.equal(result.ok,false);assert.equal(result.documentWriteRejected,undefined);assert.equal(e.calls.length,2);
});
for(const [label,mutate] of [
  ['tenant',data=>{data.tenant_id=id(9);}],['client',data=>{data.client_id=id(9);}],['actor',data=>{data.actor_profile_id=id(9);}],
  ['request',data=>{data.request_id=id(9);}],['status',data=>{data.status='prepared';}],['receipt time',data=>{data.committed_at='not-a-time';}],
  ['packet text',data=>{data.packet_original.documents[0].finalizedHtml='different';}],
  ['packet microsecond',data=>{data.packet_original.documents[0].signatures.client.signedAt=at.replace('123456','123457');}],
  ['native HTML',data=>{data.native_original.documents[0].finalized_html='different';}],
  ['native scope',data=>{data.native_original.documents[0].tenant_id=id(9);}],
  ['native document time',data=>{data.native_original.documents[0].finalized_at=at.replace('123456','123457');}],
  ['native signature time',data=>{data.native_original.signatures[0].signed_at=at.replace('123456','123457');}],
  ['signature data',data=>{data.native_original.signatures[0].signature_data='different';}],
  ['signature name',data=>{data.native_original.signatures[0].signer_name='someone else';}],
  ['missing signature',data=>{data.native_original.signatures.pop();}],
  ['additional signature',data=>{data.native_original.signatures.push({...data.native_original.signatures[0],id:id(900)});}],
  ['duplicate document',data=>{data.native_original.documents.push({...data.native_original.documents[0],id:id(900)});}],
  ['missing record link',data=>{data.native_original.records.pop();}],
  ['duplicate record link',data=>{data.native_original.records.push({...data.native_original.records[0],id:id(900)});}],
  ['foreign record source',data=>{data.native_original.records[0].source='upload';}],
  ['file name collision',data=>{data.native_original.records[0].file_name='other.html';}],
  ['missing event',data=>{data.native_original.events.pop();}],
  ['foreign event actor',data=>{data.native_original.events[0].actor_profile_id=id(9);}],
  ['event request',data=>{data.native_original.events[0].metadata_json.request_id=id(9);}],
  ['consent',data=>{data.native_original.consent.privacy_status='not_started';}],
  ['consent original time',data=>{data.native_original.consent.contract_finalized_at=at.replace('123456','123457');}],
  ['contract basis',data=>{data.native_original.selection.contract_type='different';}],
])test(`receipt with a changed ${label} cannot release the packet`,async()=>{
  const e=environment({mutate:(data,call)=>{if(!call.name.includes('_read_'))mutate(data);return data;}});
  const result=await e.persist();assert.equal(result.ok,false);assert.equal(result.documentWriteRejected,undefined);
  assert.equal((await e.confirm()).ok,false);
});
test('equivalent native timestamp serialization preserves the original packet lexemes and all microseconds',async()=>{
  const e=environment({mutate:(data,call)=>{
    if(!call.name.includes('_read_')){const native=data.native_original;for(const doc of native.documents){doc.finalized_at=at.replace('+00:00','Z');doc.preview_opened_at=at.replace('+00:00','Z');}
      native.signatures.forEach(sig=>{sig.signed_at=at.replace('+00:00','Z');});}
    return data;
  }});assert.equal((await e.persist()).ok,true);assert.equal(e.calls[1].args.p_packet.documents[0].finalizedAt,at);
});
for(const [label,mutate] of [
  ['duplicate templates',input=>{input.intakeDocuments.push(clone(input.intakeDocuments[0]));}],
  ['arbitrary signature URL',input=>{input.intakeDocuments[0].signatures.client.dataUrl='https://external.invalid/signature';}],
  ['role mismatch',input=>{input.intakeDocuments[0].signatures.client.role='employee';}],
  ['missing final original',input=>{input.intakeDocuments[0].finalizedHtml=null;}],
  ['missing original timestamp',input=>{input.intakeDocuments[0].signatures.client.signedAt='';}],
  ['invalid native source id',input=>{input.intakeDocuments[0].tenantTemplateId='label';}],
])test(`${label} fails before all RPCs`,async()=>{
  const input=form();mutate(input);const e=environment();const result=await e.persist(input);
  assert.equal(result.ok,false);assert.equal(result.documentWriteRejected,true);assert.equal(e.calls.length,0);
});

// These inspect a private SQL proposal, not a running PostgreSQL instance.
const sql=readFileSync(new URL('../../supabase/migrations/20261015090000_atomic_client_intake_identity.sql',import.meta.url),'utf8');
const body=name=>sql.match(new RegExp(`CREATE OR REPLACE FUNCTION client_intake_private\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`))?.[1]??'';
test('the SQL proposal binds one transaction to full baseline, receipt, originals, signatures, consent, links and audit events',()=>{
  const commit=body('commit_document_packet');assert.ok(commit.includes('authorize_completion'));
  for(const part of ['pg_advisory_xact_lock','p_expected_lead_updated_at','p_expected_original','packet_original','native_original',
    'client_intake_documents','client_document_signatures','client_contract_selection','client_consent_status','client_documents','client_document_events'])assert.ok(commit.includes(part),part);
  assert.ok(commit.indexOf('p_expected_original IS DISTINCT FROM')<commit.indexOf('INSERT INTO client_intake_private.document_packet_write_scopes'));
  assert.doesNotMatch(commit,/EXCEPTION\s+WHEN[\s\S]*RETURN/i);
});
test('the confirmation contract compares the full original and contains no data mutations',()=>{
  const confirm=body('confirm_document_packet');assert.match(confirm,/native_original IS DISTINCT FROM client_intake_private.document_packet_snapshot/);
  assert.doesNotMatch(confirm,/\b(INSERT INTO|UPDATE public\.|DELETE FROM)\b/);
});
test('native originals and signature timestamps are protected from silent replacement and file-name adoption',()=>{
  const commit=body('commit_document_packet');assert.match(commit,/v_old_signature\.signed_at IS DISTINCT FROM/);
  assert.match(commit,/v_native\.status IN \('finalized','revoked','replaced'\)/);
  assert.match(commit,/gleichnamiger Aktenbeleg/);assert.doesNotMatch(commit,/ON CONFLICT\(document_id,signer_role\) DO UPDATE/);
  assert.match(commit,/v_old_signature\.tenant_id IS DISTINCT FROM p_tenant_id/);
  assert.match(commit,/Originalbeleg ist mehrfach mit der Akte verknüpft/);
  assert.match(body('guard_document_packet_originals'),/jsonb_build_array\(v_old,v_new\)/);
});
test('packet-bound completion and named PostgREST arguments have no old unbound preparation fallback',()=>{
  assert.match(body('prepare_packet_completion'),/document_request_id IS DISTINCT FROM p_document_request_id/);
  assert.match(body('guard_completion_packet'),/native_original IS DISTINCT FROM/);
  assert.match(sql,/web_finalize_client_intake_completion\(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_expected_lead_updated_at TIMESTAMPTZ\)/);
  assert.match(sql,/web_confirm_client_intake_completion\(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION client_intake_private\.prepare_completion[\s\S]*?public\.web_prepare_client_intake_completion[\s\S]*?FROM PUBLIC,anon,authenticated/);
});

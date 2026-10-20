import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL(
  '../../supabase/migrations/20261015090000_atomic_client_intake_identity.sql', import.meta.url,
), 'utf8');
const position = fragment => {
  const index = sql.indexOf(fragment);
  assert.notEqual(index, -1, `missing SQL contract: ${fragment}`);
  return index;
};

test('the intake receipt table is private and binds request, tenant, actor and client identity', () => {
  assert.match(sql, /request_id UUID PRIMARY KEY/);
  assert.match(sql, /tenant_id UUID NOT NULL REFERENCES public\.tenants/);
  assert.match(sql, /actor_profile_id UUID NOT NULL REFERENCES public\.profiles/);
  assert.match(sql, /proposed_client_id UUID NOT NULL UNIQUE/);
  assert.match(sql, /CHECK \(proposed_client_id = client_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.client_intake_request_receipts FROM PUBLIC, anon, authenticated/);
});

test('the definer RPC establishes explicit session, tenant and current permissions before data access', () => {
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = public, pg_temp/);
  assert.match(sql, /auth\.uid\(\) IS NULL/);
  assert.match(sql, /p_tenant_id IS DISTINCT FROM public\.current_tenant_id\(\)/);
  assert.match(sql, /p_actor_profile_id IS DISTINCT FROM auth\.uid\(\)/);
  for (const permission of ['office.clients.create', 'office.clients.view', 'office.clients.view_sensitive']) {
    assert.match(sql, new RegExp(`has_permission\\('${permission.replaceAll('.', '\\.')}\\'\\)`));
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.web_reserve_client_intake_draft[\s\S]*FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.web_reserve_client_intake_draft[\s\S]*TO authenticated/);
});

test('the tenant transaction lock precedes receipt reuse, exact conflict detection and insert', () => {
  const lock = position("pg_advisory_xact_lock(hashtextextended('client-intake:'");
  const receipt = position('FROM public.client_intake_request_receipts');
  const conflict = position('Eine Person mit übereinstimmenden Identitätsmerkmalen ist bereits vorhanden.');
  const insert = position('INSERT INTO public.clients');
  assert.ok(lock < receipt && receipt < conflict && conflict < insert);
  assert.match(sql, /lower\(btrim\(c\.first_name\)\) = lower\(v_first_name\)/);
  assert.match(sql, /c\.date_of_birth IS NOT DISTINCT FROM v_birth_date/);
  assert.match(sql, /lower\(btrim\(coalesce\(c\.insurance_number, ''\)\)\) = lower\(v_insurance_number\)/);
});

test('client identity and security-owned fields cannot be supplied through the payload', () => {
  const allowedFields = sql.match(/key <> ALL \(ARRAY\[([\s\S]*?)\]\)/)?.[1] ?? '';
  for (const forbidden of ['id', 'tenant_id', 'status', 'created_by', 'updated_by']) {
    assert.doesNotMatch(allowedFields, new RegExp(`'${forbidden}'`));
  }
  assert.match(sql, /p_proposed_client_id, p_tenant_id, v_first_name, v_last_name/);
  assert.match(sql, /jsonb_populate_record\([\s\S]*NULL::public\.clients[\s\S]*'care_level'[\s\S]*\)\.care_level/);
  assert.doesNotMatch(sql, /::public\.care_level/);
  assert.match(sql, /'lead'/);
  assert.match(sql, /p_actor_profile_id, p_actor_profile_id/);
});

test('a repeated request returns only the same still-open original lead', () => {
  assert.match(sql, /WHERE request_id = p_request_id[\s\S]*FOR UPDATE/);
  assert.match(sql, /v_receipt\.tenant_id IS DISTINCT FROM p_tenant_id/);
  assert.match(sql, /v_receipt\.actor_profile_id IS DISTINCT FROM p_actor_profile_id/);
  assert.match(sql, /v_client\.status::TEXT <> 'lead'/);
  assert.match(sql, /v_client\.created_by IS DISTINCT FROM p_actor_profile_id/);
  assert.match(sql, /jsonb_build_object\('id', v_client\.id, 'created', FALSE/);
});

test('review preparation retains exact native candidates and limits a decision to its original request and five-minute session lease',()=>{
 const prepare=sql.slice(position('FUNCTION client_intake_private.prepare_review('),position('FUNCTION client_intake_private.confirm_reservation('));
 assert.match(prepare,/p_candidates[\s\S]*count\(DISTINCT item->>'id'\)/);
 assert.match(prepare,/supplied - 'updated_at'[\s\S]*IS DISTINCT FROM/);
 assert.match(prepare,/\(supplied->>'updated_at'\)::TIMESTAMPTZ IS DISTINCT FROM/);
 assert.match(prepare,/candidate_originals, decision_reason, prepared_at, expires_at/);
 assert.match(prepare,/v_pool, v_reason, v_at, v_at \+ interval '5 minutes'/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.client_intake_identity_reviews FROM PUBLIC, anon, authenticated/);
});
test('privileged implementations live behind invoker API wrappers and the old direct first-write grant is revoked last',()=>{
 for(const name of ['web_prepare_client_intake_identity_review','web_reserve_reviewed_client_intake_draft','web_confirm_reviewed_client_intake_draft']){
  const start=position(`FUNCTION public.${name}(`),end=sql.indexOf('$$;',start);
  assert.match(sql.slice(start,end),/SECURITY INVOKER SET search_path = ''/);
 }
 const old='ON FUNCTION public.web_reserve_client_intake_draft(UUID,UUID,UUID,UUID,JSONB)';
 assert.ok(sql.lastIndexOf('REVOKE ALL '+old)>sql.lastIndexOf('GRANT EXECUTE '+old));
 assert.match(sql,/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA client_intake_private FROM PUBLIC, anon, authenticated/);
 const grants=sql.slice(sql.lastIndexOf('GRANT EXECUTE ON FUNCTION client_intake_private.'));
 assert.doesNotMatch(grants,/GRANT EXECUTE ON FUNCTION client_intake_private\.(authorize|current_pool)/);
});
test('native session existence, token expiry and current rights are rechecked inside each privileged transaction',()=>{
 const auth=sql.slice(position('FUNCTION client_intake_private.authorize('),position('FUNCTION client_intake_private.current_pool('));
 assert.match(auth,/auth\.jwt\(\)->>'session_id'/);assert.match(auth,/FROM auth\.sessions s WHERE s\.id = v_session AND s\.user_id = auth\.uid\(\)/);
 assert.match(auth,/auth\.jwt\(\)->>'exp'/);assert.doesNotMatch(auth,/user_metadata/);
 const reserve=sql.slice(position('FUNCTION client_intake_private.reserve_reviewed('),position('FUNCTION public.web_prepare_client_intake_identity_review('));
 assert.ok(reserve.indexOf('pg_advisory_xact_lock')<reserve.lastIndexOf('client_intake_private.authorize'));
 assert.ok(reserve.lastIndexOf('client_intake_private.authorize')<reserve.indexOf('v_result := public.web_reserve'));
});
test('a consumed review, exact candidate pool and initial payload/row form one atomic receipt boundary',()=>{
 const reserve=sql.slice(position('FUNCTION client_intake_private.reserve_reviewed('),position('FUNCTION public.web_prepare_client_intake_identity_review('));
 for(const field of ['v_review.request_id','v_review.tenant_id','v_review.actor_profile_id','v_review.prepared_session_id','v_review.expires_at','v_review.consumed_request_id'])assert.ok(reserve.includes(field));
 assert.ok(reserve.indexOf('v_pool IS DISTINCT FROM v_review.candidate_originals')<reserve.indexOf('v_result := public.web_reserve'));
 assert.match(reserve,/initial_payload = p_payload, initial_row = v_result->'row'/);
 assert.match(reserve,/consumed_request_id = p_request_id, decided_at = clock_timestamp\(\)/);
});
test('unknown first-write reconciliation requires the exact consumed decision or revokes only its own unused review',()=>{
 const confirm=sql.slice(position('FUNCTION client_intake_private.confirm_reservation('),position('FUNCTION client_intake_private.reserve_reviewed('));
 assert.match(confirm,/v_receipt\.identity_review_id IS DISTINCT FROM p_review_id/);
 assert.match(confirm,/v_receipt\.initial_payload IS DISTINCT FROM p_payload/);
 assert.match(confirm,/v_receipt\.initial_row IS DISTINCT FROM to_jsonb\(v_client\)/);
 assert.match(confirm,/r\.consumed_request_id = p_request_id AND r\.decided_at IS NOT NULL/);
 assert.doesNotMatch(confirm,/\bINSERT INTO\b|\bUPDATE public\.clients\b|\bDELETE FROM\b/);
 assert.match(confirm,/UPDATE public\.client_intake_identity_reviews SET revoked_at = coalesce\(revoked_at, clock_timestamp\(\)\)/);
 assert.ok(confirm.indexOf('pg_advisory_xact_lock')<confirm.indexOf('FROM public.client_intake_request_receipts'));
 assert.ok(confirm.indexOf('EXISTS (SELECT 1 FROM public.clients WHERE id = p_request_id)')<confirm.indexOf('UPDATE public.client_intake_identity_reviews'));
 assert.match(sql,/v_review\.consumed_request_id IS NOT NULL OR v_review\.revoked_at IS NOT NULL THEN/);
});

test('completion receipts are private, tenant-bound and cannot be written through table grants',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.client_intake_completion_receipts/);
 assert.match(sql,/request_id UUID PRIMARY KEY[\s\S]*tenant_id UUID NOT NULL[\s\S]*client_id UUID NOT NULL[\s\S]*actor_profile_id UUID NOT NULL/);
 assert.match(sql,/identity_review_id UUID NOT NULL[\s\S]*decision_original JSONB NOT NULL[\s\S]*document_originals JSONB NOT NULL/);
 assert.match(sql,/ALTER TABLE public\.client_intake_completion_receipts ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.client_intake_completion_receipts FROM PUBLIC, anon, authenticated/);
});

test('completion authorization additionally requires current edit and status-change rights',()=>{
 const authorize=sql.slice(position('FUNCTION client_intake_private.authorize_completion('),position('FUNCTION client_intake_private.verify_completion_documents('));
 assert.match(authorize,/has_permission\('office\.clients\.edit'\)/);
 assert.match(authorize,/has_permission\('office\.clients\.status_change'\)/);
});

test('completion preparation binds the accepted professional decision, exact lead revision, identity receipt and document originals',()=>{
 const prepare=sql.slice(position('FUNCTION client_intake_private.prepare_completion('),position('FUNCTION client_intake_private.finalize_completion('));
 for(const field of ['care_need_summary','capacity_status','capacity_reference','admission_decision','admission_reason','service_start','contract_type'])assert.ok(prepare.includes(field));
 assert.match(prepare,/q\.identity_review_id=p_identity_review_id AND r\.consumed_request_id=q\.request_id AND r\.decided_at IS NOT NULL/);
 assert.match(prepare,/v_client\.updated_at IS DISTINCT FROM p_expected_lead_updated_at/);
 assert.match(prepare,/verify_completion_documents\(p_tenant_id,p_client_id,p_document_evidence,p_decision\)/);
 assert.match(prepare,/decision_original,document_originals,lead_updated_at,status/);
 assert.ok(prepare.indexOf('pg_advisory_xact_lock')<prepare.indexOf('INSERT INTO public.client_intake_completion_receipts'));
});

test('server document verification requires full originals plus finalized privacy, contract and signatures',()=>{
 const verify=sql.slice(position('FUNCTION client_intake_private.verify_completion_documents('),position('FUNCTION client_intake_private.prepare_completion('));
 assert.match(verify,/jsonb_array_length\(p_originals\) IS DISTINCT FROM \(SELECT count\(DISTINCT value->>'templateKey'\)/);
 for(const field of ['templateKey','documentType','title','status','isRequired','version','source','tenantTemplateId','previewHtml','finalizedHtml','renderedPdfPath','missingPlaceholders','previewOpenedAt','finalizedAt'])assert.ok(verify.includes(field));
 assert.match(verify,/signature_data IS DISTINCT FROM v_expected_signature->>'dataUrl'/);
 assert.match(verify,/signed_at IS DISTINCT FROM \(v_expected_signature->>'signedAt'\)::TIMESTAMPTZ/);
 assert.match(verify,/signer_role='client'[\s\S]*signer_role='employee'/);
 assert.match(verify,/client_contract_selection[\s\S]*contract_type IS DISTINCT FROM p_decision->>'contract_type'/);
 assert.match(verify,/privacy_status IS DISTINCT FROM 'finalized'[\s\S]*contract_status IS DISTINCT FROM 'finalized'/);
});

test('finalization reauthorizes under the same lock, checks exact current evidence and atomically stores the active original row',()=>{
 const finalize=sql.slice(position('FUNCTION client_intake_private.finalize_completion('),position('FUNCTION client_intake_private.confirm_completion('));
 assert.ok(finalize.indexOf('pg_advisory_xact_lock')<finalize.lastIndexOf('authorize_completion'));
 assert.match(finalize,/p_expected_lead_updated_at IS DISTINCT FROM \(SELECT updated_at FROM public\.clients/);
 assert.match(finalize,/verify_completion_documents\(p_tenant_id,p_client_id,v_receipt\.document_originals,v_receipt\.decision_original\)/);
 assert.match(finalize,/UPDATE public\.clients SET status='active',updated_by=p_actor_profile_id[\s\S]*updated_at=p_expected_lead_updated_at/);
 assert.match(finalize,/UPDATE public\.client_intake_completion_receipts SET status='active'[\s\S]*final_row=to_jsonb\(v_client\)/);
});

test('reload confirmation is read-only and only accepts the exact active row stored by finalization',()=>{
 const confirm=sql.slice(position('FUNCTION client_intake_private.confirm_completion('),position('FUNCTION public.web_prepare_client_intake_completion('));
 assert.doesNotMatch(confirm,/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
 assert.match(confirm,/v_receipt\.status <> 'active' OR v_receipt\.final_row IS NULL/);
 assert.match(confirm,/to_jsonb\(v_client\) IS DISTINCT FROM v_receipt\.final_row/);
 for(const name of ['web_prepare_client_intake_completion','web_finalize_client_intake_completion','web_confirm_client_intake_completion']){
  const start=position(`FUNCTION public.${name}(`),end=sql.indexOf('$$;',start);
  assert.match(sql.slice(start,end),/SECURITY INVOKER SET search_path=''/);
 }
});

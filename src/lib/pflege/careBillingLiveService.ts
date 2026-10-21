import type { RoleKey, ServiceResult } from '@/types';
import type { PflegeBillingCaseItem, PflegeInvoiceFoundationItem, PflegePeriodAcceptanceItem, PflegeServiceProofItem } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { buildCareInvoiceFoundationGroups, requireCompleteCareInvoiceFoundationSelection, type CareInvoiceFoundationCandidate, type CareInvoiceFoundationGroup } from './careInvoiceFoundationDomain';
import { buildCareInvoiceDraft, type CareInvoiceDraft, type CareInvoiceDraftSource } from './careInvoiceDraftDomain';
import { validateCareInvoiceApprovalRequest, type CareInvoiceApprovalRequest } from './careInvoiceApprovalDomain';
import { buildCareCostCarrierExportRecord, type CareCostCarrierExportCandidate, type CareCostCarrierExportRequest } from './careCostCarrierExportDomain';
import {
  buildCareCarrierResubmissionRecord,
  buildCareCarrierReturnRecord,
  type CareCarrierCorrection,
  type CareCarrierResubmissionRequest,
  type CareCarrierReturnError,
  type CareCarrierReturnRecord,
  type CareCarrierReturnRequest,
  type CareCarrierTransmissionAttempt,
} from './careCarrierReturnDomain';
import {
  buildCareInvoiceAdjustmentRecord,
  type CareInvoiceAdjustmentRequest,
  type CareReleasedInvoice,
} from './careInvoiceAdjustmentDomain';
import {
  buildCareReceivablesLedger,
  type CarePaymentEvent,
  type CareReceivableInvoice,
  type CareReceivableOpenItem,
} from './careReceivablesDomain';
import {buildCareAccountingControlReport,type CareAccountingPosting,type CareAccountingSourceDocument,type CareAccountingControlReport} from './careAccountingControlDomain';
import {buildCareDunningStatus,type CareDunningDispatch,type CareDunningNotice,type CareDunningStatus} from './careDunningDomain';
import {buildCareDirectDebitStatus,type CareDirectDebitOrder,type CareDirectDebitRelease,type CareDirectDebitReturn,type CareDirectDebitStatus,type CareSepaMandate} from './careDirectDebitDomain';
import {buildCareInvoiceCostShareAssessment,type CareInvoiceCostShareAssessment,type CareInvoiceCostShareCandidate,type CareInvoiceCostShareInput,type CareInvoiceCostShareLine} from './careInvoiceCostShareDomain';
import {buildCareInvoicePeriodClosure,type CareInvoicePeriodClosure,type CareInvoicePeriodClosureCandidate,type CareInvoicePeriodClosureInput,type CareInvoicePeriodCorrection,type CareInvoicePeriodSource} from './careInvoicePeriodClosureDomain';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
const number = (value: unknown) => Number(value ?? 0);

function live<T>(tenantId: string): ServiceResult<T> | null {
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant as ServiceResult<T>;
  if (getServiceMode() !== 'supabase' || !getSupabaseClient()) return { ok: false, error: 'Pflege-Leistungsnachweis und Abrechnung sind ausschließlich live verfügbar.' };
  return null;
}

const rpcClient = () => getSupabaseClient()! as unknown as { rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: Row | Row[] | null; error: Parameters<typeof toGermanSupabaseError>[0] }> };

async function names(tenantId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]; if (!unique.length) return { ok: true as const, value: new Map<string, string>() };
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'clients').select('id,first_name,last_name').eq('tenant_id', tenantId).in('id', unique);
  if (error) return { ok: false as const, error: toGermanSupabaseError(error) };
  return { ok: true as const, value: new Map(((data ?? []) as Row[]).map((r) => [text(r.id), `${text(r.first_name)} ${text(r.last_name)}`.trim() || '—'])) };
}

export async function fetchPflegeServiceProofs(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<PflegeServiceProofItem[]>> {
  const denied = enforcePermission<PflegeServiceProofItem[]>(role, 'pflege.proofs.view'); if (denied) return denied;
  const blocked = live<PflegeServiceProofItem[]>(tenantId); if (blocked) return blocked;
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'pfleger_service_proofs').select('*').eq('tenant_id', tenantId).order('service_date', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[]; const clients = await names(tenantId, rows.map((r) => text(r.client_id))); if (!clients.ok) return clients;
  return { ok: true, data: rows.map((r) => ({ id:text(r.id),clientId:text(r.client_id),clientName:clients.value.get(text(r.client_id))??'—',serviceDate:text(r.service_date),startedAt:text(r.started_at),endedAt:text(r.ended_at),durationMinutes:number(r.duration_minutes),serviceCode:text(r.service_code),serviceLabel:text(r.service_label),legalBasis:text(r.legal_basis) as PflegeServiceProofItem['legalBasis'],prescriptionReference:text(r.prescription_reference),costCarrierName:text(r.cost_carrier_name),grossAmountCents:number(r.gross_amount_cents),performanceNote:text(r.performance_note),employeeName:text(r.employee_name_snapshot),clientSignatureName:text(r.client_signature_name),status:text(r.status) as PflegeServiceProofItem['status'],rejectionReason:text(r.rejection_reason),createdAt:text(r.created_at) })) };
}

export async function createPflegeServiceProof(tenantId: string, role: RoleKey | null | undefined, clientId: string, payload: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.proofs.create'); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('create_pfleger_service_proof', { p_client_id: clientId, p_payload: payload });
  if (error || !data || Array.isArray(data)) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function advancePflegeServiceProof(tenantId: string, role: RoleKey | null | undefined, proofId: string, action: 'submit'|'sign'|'approve'|'reject', payload: Record<string, unknown> = {}): Promise<ServiceResult<{ id: string }>> {
  const permission = action === 'sign' ? 'pflege.proofs.sign' : action === 'approve' || action === 'reject' ? 'pflege.proofs.review' : 'pflege.proofs.create';
  const denied = enforcePermission<{ id: string }>(role, permission); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('advance_pfleger_service_proof', { p_proof_id: proofId, p_action: action, p_payload: payload });
  if (error || !data || Array.isArray(data)) return { ok: false, error: (error as { message?: string } | null)?.message === 'Der eigene Leistungsnachweis benötigt eine zweite prüfende Person.' ? 'Der eigene Leistungsnachweis benötigt eine zweite prüfende Person.' : toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function fetchPflegeBillingCases(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<PflegeBillingCaseItem[]>> {
  const denied = enforcePermission<PflegeBillingCaseItem[]>(role, 'pflege.billing.view'); if (denied) return denied;
  const blocked = live<PflegeBillingCaseItem[]>(tenantId); if (blocked) return blocked;
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'pfleger_billing_cases').select('*').eq('tenant_id', tenantId).order('service_date', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[]; const clients = await names(tenantId, rows.map((r) => text(r.client_id))); if (!clients.ok) return clients;
  return { ok: true, data: rows.map((r) => ({ id:text(r.id),clientId:text(r.client_id),clientName:clients.value.get(text(r.client_id))??'—',serviceProofId:text(r.service_proof_id),legalBasis:text(r.legal_basis),payerType:text(r.payer_type) as PflegeBillingCaseItem['payerType'],costCarrierName:text(r.cost_carrier_name),serviceCode:text(r.service_code),serviceDate:text(r.service_date),amountCents:number(r.amount_cents),status:text(r.status) as PflegeBillingCaseItem['status'],blockerReason:text(r.blocker_reason),releasedByName:text(r.released_by_name),releasedAt:r.released_at?text(r.released_at):null })) };
}

export async function releasePflegeBillingCase(tenantId: string, role: RoleKey | null | undefined, caseId: string): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.billing.release'); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('release_pfleger_billing_case', { p_case_id: caseId });
  if (error || !data || Array.isArray(data)) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function fetchPflegeInvoiceFoundations(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<PflegeInvoiceFoundationItem[]>> {
  const denied = enforcePermission<PflegeInvoiceFoundationItem[]>(role, 'pflege.billing.view'); if (denied) return denied;
  const blocked = live<PflegeInvoiceFoundationItem[]>(tenantId); if (blocked) return blocked;
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'pfleger_invoice_foundations').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows=(data??[]) as Row[]; const clients=await names(tenantId,rows.map((r)=>text(r.client_id))); if(!clients.ok)return clients;
  return { ok:true,data:rows.map((r)=>({id:text(r.id),clientId:text(r.client_id),clientName:clients.value.get(text(r.client_id))??'—',foundationNumber:text(r.foundation_number),periodFrom:text(r.period_from),periodTo:text(r.period_to),payerType:text(r.payer_type),recipientName:text(r.recipient_name),recipientIk:text(r.recipient_ik),proofCount:number(r.proof_count),totalAmountCents:number(r.total_amount_cents),status:text(r.status) as PflegeInvoiceFoundationItem['status'],createdAt:text(r.created_at)})) };
}

export async function createPflegeInvoiceFoundation(tenantId:string,role:RoleKey|null|undefined,clientId:string,periodFrom:string,periodTo:string):Promise<ServiceResult<{id:string}>>{
  const denied=enforcePermission<{id:string}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string}>(tenantId);if(blocked)return blocked;
  const {data,error}=await rpcClient().rpc('create_pfleger_invoice_foundation',{p_client_id:clientId,p_period_from:periodFrom,p_period_to:periodTo});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id)}};
}

export async function listCareInvoiceFoundationGroups(tenantId:string,role:RoleKey|null|undefined,clientId:string,periodFrom:string,periodTo:string):Promise<ServiceResult<CareInvoiceFoundationGroup[]>>{
  const denied=enforcePermission<CareInvoiceFoundationGroup[]>(role,'pflege.billing.view');if(denied)return denied;
  const blocked=live<CareInvoiceFoundationGroup[]>(tenantId);if(blocked)return blocked;
  const client=getSupabaseClient()!;
  const casesResult=await fromUnknownTable(client,'pfleger_billing_cases').select('id,tenant_id,client_id,service_proof_id,service_date,amount_cents,status,invoice_foundation_id,payer_type,cost_carrier_name,cost_carrier_ik').eq('tenant_id',tenantId).eq('client_id',clientId).eq('status','released').is('invoice_foundation_id',null).gte('service_date',periodFrom).lte('service_date',periodTo);
  if(casesResult.error)return{ok:false,error:toGermanSupabaseError(casesResult.error)};
  const cases=(casesResult.data??[])as Row[];if(!cases.length)return{ok:true,data:[]};
  const proofIds=cases.map((row)=>text(row.service_proof_id));
  const proofsResult=await fromUnknownTable(client,'pfleger_service_proofs').select('id,tenant_id,client_id,status,reviewed_at,approved_evidence_fingerprint').eq('tenant_id',tenantId).in('id',proofIds);
  if(proofsResult.error)return{ok:false,error:toGermanSupabaseError(proofsResult.error)};
  const bindingsResult=await fromUnknownTable(client,'client_contract_service_bindings').select('tenant_id,client_id,service_evidence_id,logical_contract_id,lifecycle_event_id,lifecycle_version,lifecycle_fingerprint').eq('tenant_id',tenantId).eq('client_id',clientId).in('service_evidence_id',proofIds);
  if(bindingsResult.error)return{ok:false,error:toGermanSupabaseError(bindingsResult.error)};
  const proofs=new Map(((proofsResult.data??[])as Row[]).map((row)=>[text(row.id),row]));
  const bindings=new Map<string,Row>();
  for(const row of (bindingsResult.data??[])as Row[]){const id=text(row.service_evidence_id);if(bindings.has(id))return{ok:false,error:'Ein Leistungsnachweis ist mehrfach an Verträge gebunden.'};bindings.set(id,row);}
  try{
    const candidates:CareInvoiceFoundationCandidate[]=cases.map((billing)=>{const proof=proofs.get(text(billing.service_proof_id))??{};const binding=bindings.get(text(billing.service_proof_id))??{};return{
      billingCaseId:text(billing.id),serviceProofId:text(billing.service_proof_id),tenantId:text(billing.tenant_id),clientId:text(billing.client_id),serviceDate:text(billing.service_date),amountCents:number(billing.amount_cents),billingStatus:text(billing.status),invoiceFoundationId:billing.invoice_foundation_id?text(billing.invoice_foundation_id):null,payerType:text(billing.payer_type) as CareInvoiceFoundationCandidate['payerType'],recipientName:text(billing.cost_carrier_name)||'Selbstzahler',recipientIk:text(billing.cost_carrier_ik),proofStatus:text(proof.status),proofFingerprint:text(proof.approved_evidence_fingerprint),proofApprovedAt:text(proof.reviewed_at),logicalContractId:text(binding.logical_contract_id),contractEventId:text(binding.lifecycle_event_id),contractVersion:number(binding.lifecycle_version),contractFingerprint:text(binding.lifecycle_fingerprint),
    }});
    return{ok:true,data:buildCareInvoiceFoundationGroups(candidates,{tenantId,clientId,periodFrom,periodTo})};
  }catch(error){return{ok:false,error:error instanceof Error?error.message:'Bereitschaftsgruppen sind widersprüchlich.'};}
}

export async function createBoundPflegeInvoiceFoundation(tenantId:string,role:RoleKey|null|undefined,group:CareInvoiceFoundationGroup,selectedBillingCaseIds:readonly string[]):Promise<ServiceResult<{id:string}>>{
  const denied=enforcePermission<{id:string}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string}>(tenantId);if(blocked)return blocked;
  if(group.tenantId!==tenantId)return{ok:false,error:'Bereitschaftsgruppe gehört nicht zum aktiven Mandanten.'};
  let ids:string[];try{ids=requireCompleteCareInvoiceFoundationSelection(group,selectedBillingCaseIds);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Auswahl ist ungültig.'};}
  const {data,error}=await rpcClient().rpc('create_bound_pfleger_invoice_foundation',{p_client_id:group.clientId,p_period_from:group.periodFrom,p_period_to:group.periodTo,p_billing_case_ids:ids});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id)}};
}

export async function listCareInvoiceDraftSources(tenantId:string,role:RoleKey|null|undefined,clientId:string):Promise<ServiceResult<CareInvoiceDraft[]>>{
  const denied=enforcePermission<CareInvoiceDraft[]>(role,'pflege.billing.view');if(denied)return denied;
  const blocked=live<CareInvoiceDraft[]>(tenantId);if(blocked)return blocked;
  const {data,error}=await fromUnknownTable(getSupabaseClient()!,'pfleger_invoice_foundations')
    .select('id,foundation_number,tenant_id,client_id,status,recipient_name,recipient_key,recipient_ik,total_amount_cents,selection_snapshot')
    .eq('tenant_id',tenantId).eq('client_id',clientId).eq('status','validated').order('created_at',{ascending:false});
  if(error)return{ok:false,error:toGermanSupabaseError(error)};
  const foundationIds=((data??[])as Row[]).map((row)=>text(row.id));
  if(!foundationIds.length)return{ok:true,data:[]};
  const usedResult=await fromUnknownTable(getSupabaseClient()!,'pfleger_invoice_drafts').select('invoice_foundation_id')
    .eq('tenant_id',tenantId).eq('client_id',clientId).in('invoice_foundation_id',foundationIds);
  if(usedResult.error)return{ok:false,error:toGermanSupabaseError(usedResult.error)};
  const used=new Set(((usedResult.data??[])as Row[]).map((row)=>text(row.invoice_foundation_id)));
  try{
    const drafts=((data??[])as Row[]).filter((row)=>!used.has(text(row.id))).map((row)=>{
      const rawLines=Array.isArray(row.selection_snapshot)?row.selection_snapshot as Row[]:[];
      const source:CareInvoiceDraftSource={
        foundationId:text(row.id),foundationNumber:text(row.foundation_number),tenantId:text(row.tenant_id),clientId:text(row.client_id),
        status:text(row.status),recipientName:text(row.recipient_name),recipientKey:text(row.recipient_key),recipientIk:text(row.recipient_ik),
        totalAmountCents:number(row.total_amount_cents),lines:rawLines.map((line)=>({
          billingCaseId:text(line.billingCaseId),serviceProofId:text(line.serviceProofId),serviceDate:text(line.serviceDate),
          serviceCode:text(line.serviceCode),quantityMilli:1000,unitAmountCents:number(line.amountCents),amountCents:number(line.amountCents),
          proofFingerprint:text(line.proofFingerprint),
        })),
      };
      return buildCareInvoiceDraft(source,14);
    });
    return{ok:true,data:drafts};
  }catch(error){return{ok:false,error:error instanceof Error?error.message:'Rechnungsgrundlage ist widersprüchlich.'};}
}

export async function createPflegeInvoiceDraft(tenantId:string,role:RoleKey|null|undefined,foundationId:string,paymentTermDays:number,clientRequestId:string):Promise<ServiceResult<{id:string;invoiceNumber:string;status:string}>>{
  const denied=enforcePermission<{id:string;invoiceNumber:string;status:string}>(role,'pflege.invoices.manage');if(denied)return denied;
  const blocked=live<{id:string;invoiceNumber:string;status:string}>(tenantId);if(blocked)return blocked;
  if(!foundationId||!clientRequestId||!Number.isInteger(paymentTermDays)||paymentTermDays<1||paymentTermDays>365)return{ok:false,error:'Grundlage, Zahlungsziel von 1 bis 365 Tagen und Anforderungs-ID sind erforderlich.'};
  const {data,error}=await rpcClient().rpc('create_pfleger_invoice_draft',{p_invoice_foundation_id:foundationId,p_payment_term_days:paymentTermDays,p_client_request_id:clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:{id:text(data.id),invoiceNumber:text(data.invoice_number),status:text(data.status)}};
}

export type CareInvoiceApprovalCandidateSummary={
  invoiceDraftId:string; invoiceNumber:string; clientId:string; recipientName:string; recipientKey:string; recipientIk:string;
  issuedAt:string; dueDate:string; createdAt:string; draftVersion:1; totalAmountCents:number; positionCount:number;
  positions:readonly {positionNo:number;serviceDate:string;serviceCode:string;amountCents:number}[];
};

export async function listCareInvoiceApprovalCandidates(tenantId:string,role:RoleKey|null|undefined,clientId:string):Promise<ServiceResult<CareInvoiceApprovalCandidateSummary[]>>{
  const denied=enforcePermission<CareInvoiceApprovalCandidateSummary[]>(role,'pflege.billing.view');if(denied)return denied;
  const blocked=live<CareInvoiceApprovalCandidateSummary[]>(tenantId);if(blocked)return blocked;
  const client=getSupabaseClient()!;
  const draftsResult=await fromUnknownTable(client,'pfleger_invoice_drafts').select('id,tenant_id,client_id,invoice_number,recipient_name,recipient_key,recipient_ik,issued_at,due_date,total_amount_cents,position_count,status,created_at')
    .eq('tenant_id',tenantId).eq('client_id',clientId).eq('status','draft').order('created_at',{ascending:false});
  if(draftsResult.error)return{ok:false,error:toGermanSupabaseError(draftsResult.error)};
  const drafts=(draftsResult.data??[])as Row[];const draftIds=drafts.map((row)=>text(row.id));if(!draftIds.length)return{ok:true,data:[]};
  const approvalsResult=await fromUnknownTable(client,'pfleger_invoice_approvals').select('invoice_draft_id').eq('tenant_id',tenantId).in('invoice_draft_id',draftIds);
  if(approvalsResult.error)return{ok:false,error:toGermanSupabaseError(approvalsResult.error)};
  const approved=new Set(((approvalsResult.data??[])as Row[]).map((row)=>text(row.invoice_draft_id)));
  const available=drafts.filter((row)=>!approved.has(text(row.id)));if(!available.length)return{ok:true,data:[]};
  const positionsResult=await fromUnknownTable(client,'pfleger_invoice_draft_positions').select('invoice_draft_id,position_no,service_date,service_code,amount_cents')
    .eq('tenant_id',tenantId).in('invoice_draft_id',available.map((row)=>text(row.id))).order('position_no',{ascending:true});
  if(positionsResult.error)return{ok:false,error:toGermanSupabaseError(positionsResult.error)};
  const positionsByDraft=new Map<string,Row[]>();for(const row of (positionsResult.data??[])as Row[]){const id=text(row.invoice_draft_id);positionsByDraft.set(id,[...(positionsByDraft.get(id)??[]),row]);}
  try{return{ok:true,data:available.map((row)=>{
    const rows=positionsByDraft.get(text(row.id))??[];const count=number(row.position_count);const total=number(row.total_amount_cents);
    if(!Number.isSafeInteger(total)||total<0||rows.length!==count||rows.some((position,index)=>number(position.position_no)!==index+1||!Number.isSafeInteger(number(position.amount_cents))||number(position.amount_cents)<0)||rows.reduce((sum,position)=>sum+number(position.amount_cents),0)!==total)throw new Error('Entwurfspositionen sind unvollständig oder rechnerisch widersprüchlich.');
    return{invoiceDraftId:text(row.id),invoiceNumber:text(row.invoice_number),clientId:text(row.client_id),recipientName:text(row.recipient_name),recipientKey:text(row.recipient_key),recipientIk:text(row.recipient_ik),issuedAt:text(row.issued_at),dueDate:text(row.due_date),createdAt:text(row.created_at),draftVersion:1,totalAmountCents:total,positionCount:count,positions:rows.map((position)=>({positionNo:number(position.position_no),serviceDate:text(position.service_date),serviceCode:text(position.service_code),amountCents:number(position.amount_cents)}))};
  })};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Freigabekandidaten sind widersprüchlich.'};}
}

export async function approvePflegeInvoiceDraft(tenantId:string,role:RoleKey|null|undefined,request:CareInvoiceApprovalRequest):Promise<ServiceResult<{id:string;approvalVersion:number;approvedAt:string}>>{
  const denied=enforcePermission<{id:string;approvalVersion:number;approvedAt:string}>(role,'pflege.billing.release');if(denied)return denied;
  const blocked=live<{id:string;approvalVersion:number;approvedAt:string}>(tenantId);if(blocked)return blocked;
  let value:CareInvoiceApprovalRequest;try{value=validateCareInvoiceApprovalRequest(request);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Freigabeauftrag ist ungültig.'};}
  const {data,error}=await rpcClient().rpc('approve_pfleger_invoice_draft',{
    p_invoice_draft_id:value.invoiceDraftId,p_expected_draft_version:value.expectedDraftVersion,p_expected_draft_created_at:value.expectedDraftCreatedAt,
    p_tax_treatment:value.taxTreatment,p_tax_rate_basis_points:value.taxRateBasisPoints,p_net_amount_cents:value.netAmountCents,
    p_tax_amount_cents:value.taxAmountCents,p_tax_legal_reference:value.taxLegalReference,p_reviewer_note:value.reviewerNote,p_client_request_id:value.clientRequestId,
  });
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:{id:text(data.id),approvalVersion:number(data.approval_version),approvedAt:text(data.approved_at)}};
}

export type CareCostCarrierExportCandidateSummary=CareCostCarrierExportCandidate&{
  recipientName:string;
};

export async function listCareCostCarrierExportCandidates(tenantId:string,role:RoleKey|null|undefined,clientId:string):Promise<ServiceResult<CareCostCarrierExportCandidateSummary[]>>{
  const denied=enforcePermission<CareCostCarrierExportCandidateSummary[]>(role,'pflege.billing.view');if(denied)return denied;
  const blocked=live<CareCostCarrierExportCandidateSummary[]>(tenantId);if(blocked)return blocked;
  const client=getSupabaseClient()!;
  const approvalsResult=await fromUnknownTable(client,'pfleger_invoice_approvals').select('id,tenant_id,client_id,invoice_draft_id,approval_version,approved_at,document_fingerprint,document_snapshot,transmission_status,total_amount_cents')
    .eq('tenant_id',tenantId).eq('client_id',clientId).eq('transmission_status','not_transmitted').order('approved_at',{ascending:false});
  if(approvalsResult.error)return{ok:false,error:toGermanSupabaseError(approvalsResult.error)};
  const approvals=(approvalsResult.data??[])as Row[];if(!approvals.length)return{ok:true,data:[]};
  const approvalIds=approvals.map((row)=>text(row.id));
  const exportsResult=await fromUnknownTable(client,'pfleger_cost_carrier_exports').select('invoice_approval_id').eq('tenant_id',tenantId).in('invoice_approval_id',approvalIds);
  if(exportsResult.error)return{ok:false,error:toGermanSupabaseError(exportsResult.error)};
  const recorded=new Set(((exportsResult.data??[])as Row[]).map((row)=>text(row.invoice_approval_id)));
  const available=approvals.filter((row)=>!recorded.has(text(row.id)));if(!available.length)return{ok:true,data:[]};
  const draftIds=available.map((row)=>text(row.invoice_draft_id));
  const positionsResult=await fromUnknownTable(client,'pfleger_invoice_draft_positions').select('invoice_draft_id,billing_case_id').eq('tenant_id',tenantId).in('invoice_draft_id',draftIds);
  if(positionsResult.error)return{ok:false,error:toGermanSupabaseError(positionsResult.error)};
  const positions=(positionsResult.data??[])as Row[];const caseIds=positions.map((row)=>text(row.billing_case_id));
  const casesResult=caseIds.length?await fromUnknownTable(client,'pfleger_billing_cases').select('id,legal_basis').eq('tenant_id',tenantId).in('id',caseIds):{data:[],error:null};
  if(casesResult.error)return{ok:false,error:toGermanSupabaseError(casesResult.error)};
  const legalByCase=new Map(((casesResult.data??[])as Row[]).map((row)=>[text(row.id),text(row.legal_basis)]));
  const casesByDraft=new Map<string,string[]>();for(const row of positions){const id=text(row.invoice_draft_id);casesByDraft.set(id,[...(casesByDraft.get(id)??[]),text(row.billing_case_id)]);}
  try{return{ok:true,data:available.flatMap((row)=>{
    const snapshot=(row.document_snapshot??{})as Row;const recipient=(snapshot.recipient??{})as Row;const ids=casesByDraft.get(text(row.invoice_draft_id))??[];
    if(!ids.length||ids.some((id)=>legalByCase.get(id)!=='sgb_xi'))return[];
    const candidate:CareCostCarrierExportCandidateSummary={approvalId:text(row.id),invoiceDraftId:text(row.invoice_draft_id),invoiceNumber:text(snapshot.invoiceNumber),tenantId:text(row.tenant_id),clientId:text(row.client_id),approvalVersion:number(row.approval_version),approvedAt:text(row.approved_at),documentFingerprint:text(row.document_fingerprint),recipientIk:text(recipient.ik),recipientName:text(recipient.name),legalBasis:'sgb_xi',transmissionStatus:text(row.transmission_status),totalAmountCents:number(row.total_amount_cents)};
    return[candidate];
  })};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Exportkandidaten sind widersprüchlich.'};}
}

export async function recordCareCostCarrierExportValidation(tenantId:string,role:RoleKey|null|undefined,candidate:CareCostCarrierExportCandidate,request:CareCostCarrierExportRequest):Promise<ServiceResult<{id:string;validationState:string;recordedAt:string}>>{
  const denied=enforcePermission<{id:string;validationState:string;recordedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;
  const blocked=live<{id:string;validationState:string;recordedAt:string}>(tenantId);if(blocked)return blocked;
  if(candidate.tenantId!==tenantId)return{ok:false,error:'Exportkandidat gehört zu einem anderen Mandanten.'};
  let record;try{record=buildCareCostCarrierExportRecord(candidate,request);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Exportprüfung ist ungültig.'};}
  const payload={...request};
  const {data,error}=await rpcClient().rpc('record_pfleger_cost_carrier_export_validation',{p_invoice_approval_id:record.candidate.approvalId,p_payload:payload,p_client_request_id:record.clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:{id:text(data.id),validationState:text(data.validation_state),recordedAt:text(data.recorded_at)}};
}

export type CareCarrierReturnCaseSummary={
  returnId:string; transmissionAttemptId:string; claimLineageId:string; attemptNumber:number; invoiceNumber:string;
  returnFileName:string; returnFileSha256:string; receivedAt:string; codeSystem:string; codeSystemVersion:string;
  errors:readonly CareCarrierReturnError[]; returnState:'rejected_requires_correction'; acceptanceStatus:'not_accepted'; paymentStatus:'not_inferred';
  handledByCorrection:boolean; correctionId:string|null; resubmissionAttemptId:string|null;
};

export async function listCareCarrierReturnCases(tenantId:string,role:RoleKey|null|undefined,clientId:string):Promise<ServiceResult<CareCarrierReturnCaseSummary[]>>{
  const denied=enforcePermission<CareCarrierReturnCaseSummary[]>(role,'pflege.billing.view');if(denied)return denied;
  const blocked=live<CareCarrierReturnCaseSummary[]>(tenantId);if(blocked)return blocked;
  const client=getSupabaseClient()!;
  const returnsResult=await fromUnknownTable(client,'pfleger_cost_carrier_returns')
    .select('id,tenant_id,client_id,claim_lineage_id,transmission_attempt_id,invoice_number,return_file_name,return_file_sha256,received_at,code_system,code_system_version,errors,return_state,acceptance_status,payment_status')
    .eq('tenant_id',tenantId).eq('client_id',clientId).order('received_at',{ascending:false});
  if(returnsResult.error)return{ok:false,error:toGermanSupabaseError(returnsResult.error)};
  const returns=(returnsResult.data??[])as Row[];if(!returns.length)return{ok:true,data:[]};
  const returnIds=returns.map((row)=>text(row.id));const attemptIds=returns.map((row)=>text(row.transmission_attempt_id));
  const [attemptsResult,correctionsResult]=await Promise.all([
    fromUnknownTable(client,'pfleger_cost_carrier_transmission_attempts').select('id,tenant_id,client_id,claim_lineage_id,attempt_number').eq('tenant_id',tenantId).in('id',attemptIds),
    fromUnknownTable(client,'pfleger_cost_carrier_corrections').select('id,return_id,resubmission_attempt_id').eq('tenant_id',tenantId).in('return_id',returnIds),
  ]);
  if(attemptsResult.error)return{ok:false,error:toGermanSupabaseError(attemptsResult.error)};
  if(correctionsResult.error)return{ok:false,error:toGermanSupabaseError(correctionsResult.error)};
  const attempts=new Map(((attemptsResult.data??[])as Row[]).map((row)=>[text(row.id),row]));
  const corrections=new Map(((correctionsResult.data??[])as Row[]).map((row)=>[text(row.return_id),row]));
  try{return{ok:true,data:returns.map((row)=>{
    const attempt=attempts.get(text(row.transmission_attempt_id));if(!attempt||text(attempt.client_id)!==clientId||text(attempt.claim_lineage_id)!==text(row.claim_lineage_id))throw new Error('Rückläufer und Übermittlungsversuch sind nicht vollständig gebunden.');
    const rawErrors=Array.isArray(row.errors)?row.errors as Row[]:[];if(!rawErrors.length)throw new Error('Rückläufer enthält kein belastbares Fehlerprotokoll.');
    const correction=corrections.get(text(row.id));
    return{returnId:text(row.id),transmissionAttemptId:text(row.transmission_attempt_id),claimLineageId:text(row.claim_lineage_id),attemptNumber:number(attempt.attempt_number),invoiceNumber:text(row.invoice_number),returnFileName:text(row.return_file_name),returnFileSha256:text(row.return_file_sha256),receivedAt:text(row.received_at),codeSystem:text(row.code_system),codeSystemVersion:text(row.code_system_version),errors:rawErrors.map((error)=>({errorId:text(error.errorId),code:text(error.code),message:text(error.message),scope:text(error.scope) as CareCarrierReturnError['scope'],positionNo:error.positionNo==null?null:number(error.positionNo),billingCaseId:error.billingCaseId==null?null:text(error.billingCaseId),serviceProofId:error.serviceProofId==null?null:text(error.serviceProofId)})),returnState:text(row.return_state) as 'rejected_requires_correction',acceptanceStatus:text(row.acceptance_status) as 'not_accepted',paymentStatus:text(row.payment_status) as 'not_inferred',handledByCorrection:Boolean(correction),correctionId:correction?text(correction.id):null,resubmissionAttemptId:correction?text(correction.resubmission_attempt_id):null};
  })};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Rückläuferhistorie ist widersprüchlich.'};}
}

export async function recordCareCarrierReturn(tenantId:string,role:RoleKey|null|undefined,attempt:CareCarrierTransmissionAttempt,request:CareCarrierReturnRequest):Promise<ServiceResult<{id:string;returnState:string;recordedAt:string}>>{
  const denied=enforcePermission<{id:string;returnState:string;recordedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;
  const blocked=live<{id:string;returnState:string;recordedAt:string}>(tenantId);if(blocked)return blocked;
  if(attempt.tenantId!==tenantId)return{ok:false,error:'Übermittlungsversuch gehört zu einem anderen Mandanten.'};
  let record:CareCarrierReturnRecord;try{record=buildCareCarrierReturnRecord(attempt,request);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Rückläufer ist ungültig.'};}
  const {data,error}=await rpcClient().rpc('record_pfleger_cost_carrier_rejection',{p_transmission_attempt_id:record.attempt.transmissionAttemptId,p_payload:{...request},p_client_request_id:record.clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:{id:text(data.id),returnState:text(data.return_state),recordedAt:text(data.recorded_at)}};
}

export async function recordCareCarrierResubmission(tenantId:string,role:RoleKey|null|undefined,returnId:string,rejection:CareCarrierReturnRecord,correction:CareCarrierCorrection,request:CareCarrierResubmissionRequest):Promise<ServiceResult<{id:string;attemptNumber:number;transmissionState:string;recordedAt:string}>>{
  const denied=enforcePermission<{id:string;attemptNumber:number;transmissionState:string;recordedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;
  const blocked=live<{id:string;attemptNumber:number;transmissionState:string;recordedAt:string}>(tenantId);if(blocked)return blocked;
  if(!returnId)return{ok:false,error:'Rückläufer-ID fehlt.'};
  if(rejection.attempt.tenantId!==tenantId)return{ok:false,error:'Rückläufer gehört zu einem anderen Mandanten.'};
  let record;try{record=buildCareCarrierResubmissionRecord(rejection,correction,request);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Erneute Übermittlung ist ungültig.'};}
  const payload={...request,correctionVersion:record.correction.correctionVersion,correctionReason:record.correction.correctionReason,correctedDocumentFingerprint:record.correction.correctedDocumentFingerprint};
  const {data,error}=await rpcClient().rpc('record_pfleger_cost_carrier_resubmission',{p_return_id:returnId,p_corrected_export_id:record.correction.correctedExportId,p_transport_message_id:record.transportMessageId,p_payload:payload,p_client_request_id:record.clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:{id:text(data.id),attemptNumber:number(data.attempt_number),transmissionState:text(data.transmission_state),recordedAt:text(data.recorded_at)}};
}

export type CareInvoiceAdjustmentSummary={
  adjustmentId:string; originalInvoiceNumber:string; replacementInvoiceNumber:string|null;
  adjustmentNumber:string; adjustmentKind:'full_cancellation'|'partial_credit'|'cancel_and_rebill'; reason:string;
  originalTotalAmountCents:number; counterEntryCents:number; replacementTotalAmountCents:number; resultingBalanceCents:number;
  approvedAt:string; carrierReturnEffect:'none'; transmissionStatus:'not_inferred'; paymentStatus:'not_inferred';
};

export async function listCareInvoiceAdjustments(tenantId:string,role:RoleKey|null|undefined,clientId:string):Promise<ServiceResult<CareInvoiceAdjustmentSummary[]>>{
  const denied=enforcePermission<CareInvoiceAdjustmentSummary[]>(role,'pflege.billing.view');if(denied)return denied;
  const blocked=live<CareInvoiceAdjustmentSummary[]>(tenantId);if(blocked)return blocked;
  const {data,error}=await fromUnknownTable(getSupabaseClient()!,'pfleger_invoice_adjustments')
    .select('id,tenant_id,client_id,original_invoice_number,replacement_invoice_number,adjustment_number,adjustment_kind,reason,original_total_amount_cents,counter_entry_cents,replacement_total_amount_cents,resulting_balance_cents,approved_at,carrier_return_effect,transmission_status,payment_status')
    .eq('tenant_id',tenantId).eq('client_id',clientId).order('approved_at',{ascending:false});
  if(error)return{ok:false,error:toGermanSupabaseError(error)};
  try{return{ok:true,data:((data??[])as Row[]).map((row)=>{
    const original=number(row.original_total_amount_cents),counter=number(row.counter_entry_cents),replacement=number(row.replacement_total_amount_cents),balance=number(row.resulting_balance_cents);
    if(text(row.tenant_id)!==tenantId||text(row.client_id)!==clientId||!Number.isSafeInteger(original)||!Number.isSafeInteger(counter)||!Number.isSafeInteger(replacement)||!Number.isSafeInteger(balance)||counter>=0||balance!==original+counter+replacement||text(row.carrier_return_effect)!=='none'||text(row.transmission_status)!=='not_inferred'||text(row.payment_status)!=='not_inferred')throw new Error('Rechnungskette ist widersprüchlich.');
    return{adjustmentId:text(row.id),originalInvoiceNumber:text(row.original_invoice_number),replacementInvoiceNumber:row.replacement_invoice_number==null?null:text(row.replacement_invoice_number),adjustmentNumber:text(row.adjustment_number),adjustmentKind:text(row.adjustment_kind) as CareInvoiceAdjustmentSummary['adjustmentKind'],reason:text(row.reason),originalTotalAmountCents:original,counterEntryCents:counter,replacementTotalAmountCents:replacement,resultingBalanceCents:balance,approvedAt:text(row.approved_at),carrierReturnEffect:'none',transmissionStatus:'not_inferred',paymentStatus:'not_inferred'};
  })};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Rechnungskette ist widersprüchlich.'};}
}

export async function recordCareInvoiceAdjustment(tenantId:string,role:RoleKey|null|undefined,originalInvoice:CareReleasedInvoice,request:CareInvoiceAdjustmentRequest):Promise<ServiceResult<{id:string;adjustmentNumber:string;resultingBalanceCents:number;approvedAt:string}>>{
  const denied=enforcePermission<{id:string;adjustmentNumber:string;resultingBalanceCents:number;approvedAt:string}>(role,'pflege.billing.release');if(denied)return denied;
  const blocked=live<{id:string;adjustmentNumber:string;resultingBalanceCents:number;approvedAt:string}>(tenantId);if(blocked)return blocked;
  if(originalInvoice.tenantId!==tenantId)return{ok:false,error:'Originalrechnung gehört zu einem anderen Mandanten.'};
  let record;try{record=buildCareInvoiceAdjustmentRecord(originalInvoice,request);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Gegenbuchung ist ungültig.'};}
  const {data,error}=await rpcClient().rpc('record_pfleger_invoice_adjustment',{p_original_invoice_approval_id:record.originalInvoice.invoiceApprovalId,p_payload:{...request},p_client_request_id:record.clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};
  const balance=number(data.resulting_balance_cents);if(balance!==record.ledger.resultingBalanceCents)return{ok:false,error:'Gespeicherter Saldo weicht von der geprüften Rechnungskette ab.'};
  return{ok:true,data:{id:text(data.id),adjustmentNumber:text(data.adjustment_number),resultingBalanceCents:balance,approvedAt:text(data.approved_at)}};
}

export type CareReceivablesSummary={
  asOfDate:string; totalReceivableCents:number; totalPaidCents:number; totalRemainingCents:number;
  openItems:readonly CareReceivableOpenItem[];paymentEvents:readonly CarePaymentEvent[];
};

export async function listCareReceivables(tenantId:string,role:RoleKey|null|undefined,clientId:string,asOfDate:string):Promise<ServiceResult<CareReceivablesSummary>>{
  const denied=enforcePermission<CareReceivablesSummary>(role,'pflege.billing.view');if(denied)return denied;
  const blocked=live<CareReceivablesSummary>(tenantId);if(blocked)return blocked;
  const client=getSupabaseClient()!;
  const itemsResult=await fromUnknownTable(client,'pfleger_receivable_open_items')
    .select('id,tenant_id,client_id,invoice_approval_id,invoice_number,receivable_lineage_id,document_fingerprint,approved_at,due_date,receivable_amount_cents')
    .eq('tenant_id',tenantId).eq('client_id',clientId).order('due_date',{ascending:true});
  if(itemsResult.error)return{ok:false,error:toGermanSupabaseError(itemsResult.error)};
  const rows=(itemsResult.data??[])as Row[];if(!rows.length)return{ok:true,data:{asOfDate,totalReceivableCents:0,totalPaidCents:0,totalRemainingCents:0,openItems:[],paymentEvents:[]}};
  const itemIds=rows.map((row)=>text(row.id));
  const eventsResult=await fromUnknownTable(client,'pfleger_receivable_payment_events')
    .select('id,client_request_id,tenant_id,client_id,event_kind,payment_method,bank_transaction_id,booking_reference,value_date,recorded_at,amount_cents,reverses_payment_event_id,reversal_reason')
    .eq('tenant_id',tenantId).eq('client_id',clientId).order('recorded_at',{ascending:true});
  if(eventsResult.error)return{ok:false,error:toGermanSupabaseError(eventsResult.error)};
  const eventRows=(eventsResult.data??[])as Row[];const eventIds=eventRows.map((row)=>text(row.id));
  const allocationsResult=eventIds.length?await fromUnknownTable(client,'pfleger_receivable_payment_allocations')
    .select('payment_event_id,open_item_id,invoice_approval_id,receivable_lineage_id,amount_cents')
    .eq('tenant_id',tenantId).in('payment_event_id',eventIds).in('open_item_id',itemIds):{data:[] as Row[],error:null};
  if(allocationsResult.error)return{ok:false,error:toGermanSupabaseError(allocationsResult.error)};
  const allocationsByEvent=new Map<string,Row[]>();for(const row of (allocationsResult.data??[])as Row[]){const id=text(row.payment_event_id);allocationsByEvent.set(id,[...(allocationsByEvent.get(id)??[]),row]);}
  try{
    const invoices:CareReceivableInvoice[]=rows.map((row)=>({openItemId:text(row.id),invoiceApprovalId:text(row.invoice_approval_id),invoiceNumber:text(row.invoice_number),tenantId:text(row.tenant_id),clientId:text(row.client_id),claimLineageId:text(row.receivable_lineage_id),documentFingerprint:text(row.document_fingerprint),approvedAt:text(row.approved_at),dueDate:text(row.due_date),receivableAmountCents:number(row.receivable_amount_cents)}));
    const events:CarePaymentEvent[]=eventRows.map((row)=>({paymentEventId:text(row.id),clientRequestId:text(row.client_request_id),tenantId:text(row.tenant_id),clientId:text(row.client_id),eventKind:text(row.event_kind),paymentMethod:text(row.payment_method),bankTransactionId:row.bank_transaction_id==null?null:text(row.bank_transaction_id),bookingReference:text(row.booking_reference),valueDate:text(row.value_date),recordedAt:text(row.recorded_at),amountCents:number(row.amount_cents),allocations:(allocationsByEvent.get(text(row.id))??[]).map((allocation)=>({openItemId:text(allocation.open_item_id),invoiceApprovalId:text(allocation.invoice_approval_id),claimLineageId:text(allocation.receivable_lineage_id),amountCents:number(allocation.amount_cents)})),reversesPaymentEventId:row.reverses_payment_event_id==null?null:text(row.reverses_payment_event_id),reversalReason:row.reversal_reason==null?null:text(row.reversal_reason)}));
    const ledger=buildCareReceivablesLedger(invoices,events,asOfDate);
    return{ok:true,data:{asOfDate:ledger.asOfDate,totalReceivableCents:ledger.totalReceivableCents,totalPaidCents:ledger.totalPaidCents,totalRemainingCents:ledger.totalRemainingCents,openItems:ledger.openItems,paymentEvents:ledger.paymentEvents}};
  }catch(error){return{ok:false,error:error instanceof Error?error.message:'Zahlungs- und Forderungshistorie ist widersprüchlich.'};}
}

export async function recordCareReceivablePayment(tenantId:string,role:RoleKey|null|undefined,invoices:readonly CareReceivableInvoice[],priorEvents:readonly CarePaymentEvent[],event:CarePaymentEvent):Promise<ServiceResult<{id:string;eventKind:string;recordedAt:string}>>{
  const denied=enforcePermission<{id:string;eventKind:string;recordedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;
  const blocked=live<{id:string;eventKind:string;recordedAt:string}>(tenantId);if(blocked)return blocked;
  if(event.tenantId!==tenantId)return{ok:false,error:'Zahlungsereignis gehört zu einem anderen Mandanten.'};
  try{buildCareReceivablesLedger(invoices,[...priorEvents,event],event.recordedAt.slice(0,10));}catch(error){return{ok:false,error:error instanceof Error?error.message:'Zahlungsereignis ist ungültig.'};}
  const {data,error}=await rpcClient().rpc('record_pfleger_receivable_payment',{p_payload:{...event},p_client_request_id:event.clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:{id:text(data.id),eventKind:text(data.event_kind),recordedAt:text(data.recorded_at)}};
}

export async function listCareAccountingControl(tenantId:string,role:RoleKey|null|undefined,clientId:string,periodFrom:string,periodTo:string):Promise<ServiceResult<CareAccountingControlReport>>{
  const denied=enforcePermission<CareAccountingControlReport>(role,'pflege.billing.view');if(denied)return denied;const blocked=live<CareAccountingControlReport>(tenantId);if(blocked)return blocked;const client=getSupabaseClient()!;
  const sourcesResult=await fromUnknownTable(client,'pfleger_accounting_source_documents').select('id,tenant_id,client_id,claim_lineage_id,source_kind,source_id,invoice_approval_id,document_number,source_fingerprint,effective_date,recorded_at,amount_cents,receivable_effect,source_state').eq('tenant_id',tenantId).eq('client_id',clientId).gte('effective_date',periodFrom).lte('effective_date',periodTo).order('effective_date',{ascending:true});
  if(sourcesResult.error)return{ok:false,error:toGermanSupabaseError(sourcesResult.error)};const rows=(sourcesResult.data??[])as Row[];if(!rows.length)return{ok:true,data:{periodFrom,periodTo,sourceDocumentCount:0,postedDocumentCount:0,validInvoiceCents:0,approvedCreditCents:0,paymentCents:0,paymentReversalCents:0,netReceivableMovementCents:0,unpostedDocumentIds:[],matchedCount:0,mismatchCount:0,notReconciledCount:0,exportedCount:0,reportState:'complete',periodCloseState:'not_inferred',historyMode:'append_only'}};
  const ids=rows.map(row=>text(row.id));const postingsResult=await fromUnknownTable(client,'pfleger_accounting_postings').select('id,client_request_id,tenant_id,client_id,claim_lineage_id,accounting_document_id,source_id,source_fingerprint,journal_number,posting_date,accounting_period,debit_account,credit_account,amount_cents,recorded_at,export_batch_id,external_journal_reference,reconciliation_state,reconciliation_reference,reconciled_at').eq('tenant_id',tenantId).in('accounting_document_id',ids).order('recorded_at',{ascending:true});if(postingsResult.error)return{ok:false,error:toGermanSupabaseError(postingsResult.error)};
  try{const sources:CareAccountingSourceDocument[]=rows.map(row=>({accountingDocumentId:text(row.id),tenantId:text(row.tenant_id),clientId:text(row.client_id),claimLineageId:text(row.claim_lineage_id),sourceKind:text(row.source_kind) as CareAccountingSourceDocument['sourceKind'],sourceId:text(row.source_id),invoiceApprovalId:text(row.invoice_approval_id),documentNumber:text(row.document_number),sourceFingerprint:text(row.source_fingerprint),effectiveDate:text(row.effective_date),recordedAt:text(row.recorded_at),amountCents:number(row.amount_cents),receivableEffect:text(row.receivable_effect) as CareAccountingSourceDocument['receivableEffect'],sourceState:text(row.source_state) as 'valid'}));const postings:CareAccountingPosting[]=((postingsResult.data??[])as Row[]).map(row=>({journalEntryId:text(row.id),clientRequestId:text(row.client_request_id),tenantId:text(row.tenant_id),clientId:text(row.client_id),claimLineageId:text(row.claim_lineage_id),accountingDocumentId:text(row.accounting_document_id),sourceId:text(row.source_id),sourceFingerprint:text(row.source_fingerprint),journalNumber:text(row.journal_number),postingDate:text(row.posting_date),accountingPeriod:text(row.accounting_period),debitAccount:text(row.debit_account),creditAccount:text(row.credit_account),amountCents:number(row.amount_cents),recordedAt:text(row.recorded_at),exportBatchId:row.export_batch_id==null?null:text(row.export_batch_id),externalJournalReference:row.external_journal_reference==null?null:text(row.external_journal_reference),reconciliationState:text(row.reconciliation_state) as CareAccountingPosting['reconciliationState'],reconciliationReference:row.reconciliation_reference==null?null:text(row.reconciliation_reference),reconciledAt:row.reconciled_at==null?null:text(row.reconciled_at)}));return{ok:true,data:buildCareAccountingControlReport(sources,postings,periodFrom,periodTo)};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Buchhaltungsdaten sind widersprüchlich.'};}
}

export async function recordCareAccountingPosting(tenantId:string,role:RoleKey|null|undefined,sources:readonly CareAccountingSourceDocument[],priorPostings:readonly CareAccountingPosting[],posting:CareAccountingPosting):Promise<ServiceResult<{id:string;journalNumber:string;recordedAt:string}>>{
  const denied=enforcePermission<{id:string;journalNumber:string;recordedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string;journalNumber:string;recordedAt:string}>(tenantId);if(blocked)return blocked;if(posting.tenantId!==tenantId)return{ok:false,error:'Buchung gehört zu einem anderen Mandanten.'};
  try{buildCareAccountingControlReport(sources,[...priorPostings,posting],posting.postingDate,posting.postingDate);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Kontierung ist ungültig.'};}const{data,error}=await rpcClient().rpc('record_pfleger_accounting_posting',{p_payload:{...posting},p_client_request_id:posting.clientRequestId});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),journalNumber:text(data.journal_number),recordedAt:text(data.recorded_at)}};
}

export type CareDunningSummary={asOfDate:string;evaluatedAt:string;items:readonly CareDunningStatus[]};

export async function listCareDunningStatus(tenantId:string,role:RoleKey|null|undefined,clientId:string,asOfDate:string,evaluatedAt:string):Promise<ServiceResult<CareDunningSummary>>{
  const denied=enforcePermission<CareDunningSummary>(role,'pflege.billing.view');if(denied)return denied;const blocked=live<CareDunningSummary>(tenantId);if(blocked)return blocked;
  const receivables=await listCareReceivables(tenantId,role,clientId,asOfDate);if(!receivables.ok)return receivables;
  const client=getSupabaseClient()!;const itemIds=receivables.data.openItems.map(item=>item.openItemId);
  if(!itemIds.length)return{ok:true,data:{asOfDate,evaluatedAt,items:[]}};
  const noticesResult=await fromUnknownTable(client,'pfleger_dunning_notices').select('id,client_request_id,tenant_id,client_id,open_item_id,invoice_approval_id,receivable_lineage_id,document_fingerprint,invoice_number,stage,predecessor_notice_id,due_date,notice_amount_cents,paid_amount_cents,remaining_amount_cents,payment_revision,latest_payment_at,payment_read_at,recorded_at,next_review_date,fee_state,interest_state,dispatch_state').eq('tenant_id',tenantId).in('open_item_id',itemIds).order('recorded_at',{ascending:true});
  if(noticesResult.error)return{ok:false,error:toGermanSupabaseError(noticesResult.error)};const noticeRows=(noticesResult.data??[])as Row[];const noticeIds=noticeRows.map(row=>text(row.id));
  const dispatchesResult=noticeIds.length?await fromUnknownTable(client,'pfleger_dunning_dispatches').select('id,client_request_id,tenant_id,client_id,dunning_notice_id,recipient_id,recipient_role,authorization_evidence_id,authorization_fingerprint,dispatch_channel,delivery_destination_fingerprint,dispatch_proof_id,dispatch_proof_fingerprint,payment_revision,latest_payment_at,remaining_amount_cents,payment_read_at,dispatched_at').eq('tenant_id',tenantId).in('dunning_notice_id',noticeIds).order('dispatched_at',{ascending:true}):{data:[] as Row[],error:null};
  if(dispatchesResult.error)return{ok:false,error:toGermanSupabaseError(dispatchesResult.error)};
  try{
    const notices:CareDunningNotice[]=noticeRows.map(row=>({dunningNoticeId:text(row.id),clientRequestId:text(row.client_request_id),tenantId:text(row.tenant_id),clientId:text(row.client_id),openItemId:text(row.open_item_id),invoiceApprovalId:text(row.invoice_approval_id),claimLineageId:text(row.receivable_lineage_id),documentFingerprint:text(row.document_fingerprint),invoiceNumber:text(row.invoice_number),stage:text(row.stage) as CareDunningNotice['stage'],predecessorNoticeId:row.predecessor_notice_id==null?null:text(row.predecessor_notice_id),dueDate:text(row.due_date),noticeAmountCents:number(row.notice_amount_cents),paidAmountCents:number(row.paid_amount_cents),remainingAmountCents:number(row.remaining_amount_cents),paymentRevision:number(row.payment_revision),latestPaymentAt:row.latest_payment_at==null?null:text(row.latest_payment_at),paymentReadAt:text(row.payment_read_at),recordedAt:text(row.recorded_at),nextReviewDate:text(row.next_review_date),feeState:text(row.fee_state) as 'not_inferred',interestState:text(row.interest_state) as 'not_inferred',dispatchState:text(row.dispatch_state) as 'not_inferred'}));
    const dispatches:CareDunningDispatch[]=((dispatchesResult.data??[])as Row[]).map(row=>({dunningDispatchId:text(row.id),clientRequestId:text(row.client_request_id),tenantId:text(row.tenant_id),clientId:text(row.client_id),dunningNoticeId:text(row.dunning_notice_id),recipientId:text(row.recipient_id),recipientRole:text(row.recipient_role) as CareDunningDispatch['recipientRole'],authorizationEvidenceId:text(row.authorization_evidence_id),authorizationFingerprint:text(row.authorization_fingerprint),dispatchChannel:text(row.dispatch_channel) as CareDunningDispatch['dispatchChannel'],deliveryDestinationFingerprint:text(row.delivery_destination_fingerprint),dispatchProofId:text(row.dispatch_proof_id),dispatchProofFingerprint:text(row.dispatch_proof_fingerprint),paymentRevision:number(row.payment_revision),latestPaymentAt:row.latest_payment_at==null?null:text(row.latest_payment_at),remainingAmountCents:number(row.remaining_amount_cents),paymentReadAt:text(row.payment_read_at),dispatchedAt:text(row.dispatched_at)}));
    const items=receivables.data.openItems.map(openItem=>{const receivedIds=new Set(receivables.data.paymentEvents.filter(event=>event.eventKind==='payment_received'&&event.allocations.some(allocation=>allocation.openItemId===openItem.openItemId)).map(event=>event.paymentEventId));const relatedEvents=receivables.data.paymentEvents.filter(event=>receivedIds.has(event.paymentEventId)||(event.eventKind==='payment_reversal'&&receivedIds.has(event.reversesPaymentEventId??'')));const latestPaymentEventAt=relatedEvents.length?relatedEvents.map(event=>event.recordedAt).sort().at(-1)!:null;return buildCareDunningStatus(openItem,notices.filter(notice=>notice.openItemId===openItem.openItemId),dispatches.filter(dispatch=>notices.some(notice=>notice.openItemId===openItem.openItemId&&notice.dunningNoticeId===dispatch.dunningNoticeId)),asOfDate,evaluatedAt,relatedEvents.length,latestPaymentEventAt);});
    return{ok:true,data:{asOfDate,evaluatedAt,items:Object.freeze(items)}};
  }catch(error){return{ok:false,error:error instanceof Error?error.message:'Mahnhistorie ist widersprüchlich.'};}
}

export async function recordCareDunningNotice(tenantId:string,role:RoleKey|null|undefined,openItem:CareReceivableOpenItem,currentPaymentRevision:number,latestPaymentEventAt:string|null,priorNotices:readonly CareDunningNotice[],priorDispatches:readonly CareDunningDispatch[],notice:CareDunningNotice):Promise<ServiceResult<{id:string;stage:string;noticeAmountCents:number;recordedAt:string}>>{
  const denied=enforcePermission<{id:string;stage:string;noticeAmountCents:number;recordedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string;stage:string;noticeAmountCents:number;recordedAt:string}>(tenantId);if(blocked)return blocked;
  if(openItem.tenantId!==tenantId||notice.tenantId!==tenantId)return{ok:false,error:'Mahnauftrag gehört zu einem anderen Mandanten.'};
  try{const before=buildCareDunningStatus(openItem,priorNotices,priorDispatches,notice.recordedAt.slice(0,10),notice.paymentReadAt,currentPaymentRevision,latestPaymentEventAt);if(before.currentState!=='eligible'||before.nextStage!==notice.stage||notice.noticeAmountCents!==openItem.remainingAmountCents||notice.paidAmountCents!==openItem.paidAmountCents||notice.paymentRevision!==currentPaymentRevision||notice.latestPaymentAt!==latestPaymentEventAt)throw new Error('Mahnstufe oder neu gelesener Zahlungsstand ist nicht aktuell.');buildCareDunningStatus(openItem,[...priorNotices,notice],priorDispatches,notice.recordedAt.slice(0,10),notice.recordedAt,currentPaymentRevision,latestPaymentEventAt);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Mahnauftrag ist ungültig.'};}
  const{data,error}=await rpcClient().rpc('record_pfleger_dunning_notice',{p_open_item_id:openItem.openItemId,p_expected_invoice_approval_id:openItem.invoiceApprovalId,p_expected_receivable_lineage_id:openItem.claimLineageId,p_expected_document_fingerprint:openItem.documentFingerprint,p_requested_stage:notice.stage,p_predecessor_notice_id:notice.predecessorNoticeId,p_next_review_date:notice.nextReviewDate,p_client_request_id:notice.clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),stage:text(data.stage),noticeAmountCents:number(data.notice_amount_cents),recordedAt:text(data.recorded_at)}};
}

export async function recordCareDunningDispatch(tenantId:string,role:RoleKey|null|undefined,openItem:CareReceivableOpenItem,currentPaymentRevision:number,latestPaymentEventAt:string|null,notices:readonly CareDunningNotice[],priorDispatches:readonly CareDunningDispatch[],dispatch:CareDunningDispatch):Promise<ServiceResult<{id:string;dispatchedAt:string}>>{
  const denied=enforcePermission<{id:string;dispatchedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string;dispatchedAt:string}>(tenantId);if(blocked)return blocked;if(openItem.tenantId!==tenantId||dispatch.tenantId!==tenantId)return{ok:false,error:'Versand gehört zu einem anderen Mandanten.'};
  try{const status=buildCareDunningStatus(openItem,notices,priorDispatches,dispatch.dispatchedAt.slice(0,10),dispatch.dispatchedAt,currentPaymentRevision,latestPaymentEventAt);const last=notices.at(-1);if(!last||dispatch.dunningNoticeId!==last.dunningNoticeId||status.paymentChangedSinceLastNotice||status.lastNoticeDispatchState!=='not_dispatched')throw new Error('Zwischenzeitliche Zahlung oder vorhandener Versand verlangt eine neue Prüfung.');buildCareDunningStatus(openItem,notices,[...priorDispatches,dispatch],dispatch.dispatchedAt.slice(0,10),dispatch.dispatchedAt,currentPaymentRevision,latestPaymentEventAt);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Mahnversand ist ungültig.'};}
  const{data,error}=await rpcClient().rpc('record_pfleger_dunning_dispatch',{p_payload:{...dispatch},p_client_request_id:dispatch.clientRequestId});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),dispatchedAt:text(data.dispatched_at)}};
}

export type CareDirectDebitSummary={asOfDate:string;evaluatedAt:string;items:readonly CareDirectDebitStatus[]};

export async function listCareDirectDebitStatus(tenantId:string,role:RoleKey|null|undefined,clientId:string,asOfDate:string,evaluatedAt:string):Promise<ServiceResult<CareDirectDebitSummary>>{
  const denied=enforcePermission<CareDirectDebitSummary>(role,'pflege.billing.view');if(denied)return denied;const blocked=live<CareDirectDebitSummary>(tenantId);if(blocked)return blocked;
  const receivables=await listCareReceivables(tenantId,role,clientId,asOfDate);if(!receivables.ok)return receivables;const client=getSupabaseClient()!;const itemIds=receivables.data.openItems.map(item=>item.openItemId);
  const mandatesResult=await fromUnknownTable(client,'pfleger_sepa_mandate_versions').select('id,mandate_id,revision,tenant_id,client_id,mandate_reference,creditor_identifier,debtor_account_fingerprint,authorization_evidence_id,authorization_fingerprint,signed_at,valid_from,valid_until,revoked_at,recorded_at').eq('tenant_id',tenantId).eq('client_id',clientId).order('recorded_at',{ascending:true});if(mandatesResult.error)return{ok:false,error:toGermanSupabaseError(mandatesResult.error)};
  const ordersResult=itemIds.length?await fromUnknownTable(client,'pfleger_direct_debit_orders').select('id,client_request_id,tenant_id,client_id,open_item_id,invoice_approval_id,receivable_lineage_id,document_fingerprint,invoice_number,mandate_version_id,mandate_id,mandate_reference,amount_cents,collection_date,prepared_at,order_state,file_release_state,payment_state').eq('tenant_id',tenantId).in('open_item_id',itemIds).order('prepared_at',{ascending:true}):{data:[] as Row[],error:null};if(ordersResult.error)return{ok:false,error:toGermanSupabaseError(ordersResult.error)};const orderRows=(ordersResult.data??[])as Row[];const orderIds=orderRows.map(row=>text(row.id));
  const releasesResult=orderIds.length?await fromUnknownTable(client,'pfleger_direct_debit_releases').select('id,client_request_id,tenant_id,client_id,direct_debit_order_id,mandate_version_id,mandate_revision,mandate_read_at,amount_cents,collection_date,export_batch_id,export_file_name,export_file_fingerprint,released_at').eq('tenant_id',tenantId).in('direct_debit_order_id',orderIds).order('released_at',{ascending:true}):{data:[] as Row[],error:null};if(releasesResult.error)return{ok:false,error:toGermanSupabaseError(releasesResult.error)};const releaseRows=(releasesResult.data??[])as Row[];const releaseIds=releaseRows.map(row=>text(row.id));
  const returnsResult=releaseIds.length?await fromUnknownTable(client,'pfleger_direct_debit_returns').select('id,client_request_id,tenant_id,client_id,direct_debit_release_id,bank_transaction_reference,return_code_system,return_code,returned_amount_cents,value_date,received_at,payment_state').eq('tenant_id',tenantId).in('direct_debit_release_id',releaseIds).order('received_at',{ascending:true}):{data:[] as Row[],error:null};if(returnsResult.error)return{ok:false,error:toGermanSupabaseError(returnsResult.error)};
  try{
    const mandates:CareSepaMandate[]=((mandatesResult.data??[])as Row[]).map(row=>({mandateVersionId:text(row.id),mandateId:text(row.mandate_id),revision:number(row.revision),tenantId:text(row.tenant_id),clientId:text(row.client_id),mandateReference:text(row.mandate_reference),creditorIdentifier:text(row.creditor_identifier),debtorAccountFingerprint:text(row.debtor_account_fingerprint),authorizationEvidenceId:text(row.authorization_evidence_id),authorizationFingerprint:text(row.authorization_fingerprint),signedAt:text(row.signed_at),validFrom:text(row.valid_from),validUntil:row.valid_until==null?null:text(row.valid_until),revokedAt:row.revoked_at==null?null:text(row.revoked_at),recordedAt:text(row.recorded_at)}));
    const orders:CareDirectDebitOrder[]=orderRows.map(row=>({directDebitOrderId:text(row.id),clientRequestId:text(row.client_request_id),tenantId:text(row.tenant_id),clientId:text(row.client_id),openItemId:text(row.open_item_id),invoiceApprovalId:text(row.invoice_approval_id),claimLineageId:text(row.receivable_lineage_id),documentFingerprint:text(row.document_fingerprint),invoiceNumber:text(row.invoice_number),mandateVersionId:text(row.mandate_version_id),mandateId:text(row.mandate_id),mandateReference:text(row.mandate_reference),amountCents:number(row.amount_cents),collectionDate:text(row.collection_date),preparedAt:text(row.prepared_at),orderState:text(row.order_state) as 'prepared',fileReleaseState:text(row.file_release_state) as 'not_inferred',paymentState:text(row.payment_state) as 'not_inferred'}));
    const releases:CareDirectDebitRelease[]=releaseRows.map(row=>({directDebitReleaseId:text(row.id),clientRequestId:text(row.client_request_id),tenantId:text(row.tenant_id),clientId:text(row.client_id),directDebitOrderId:text(row.direct_debit_order_id),mandateVersionId:text(row.mandate_version_id),mandateRevision:number(row.mandate_revision),mandateReadAt:text(row.mandate_read_at),amountCents:number(row.amount_cents),collectionDate:text(row.collection_date),exportBatchId:text(row.export_batch_id),exportFileName:text(row.export_file_name),exportFileFingerprint:text(row.export_file_fingerprint),releasedAt:text(row.released_at)}));
    const returns:CareDirectDebitReturn[]=((returnsResult.data??[])as Row[]).map(row=>({directDebitReturnId:text(row.id),clientRequestId:text(row.client_request_id),tenantId:text(row.tenant_id),clientId:text(row.client_id),directDebitReleaseId:text(row.direct_debit_release_id),bankTransactionReference:text(row.bank_transaction_reference),returnCodeSystem:text(row.return_code_system),returnCode:text(row.return_code),returnedAmountCents:number(row.returned_amount_cents),valueDate:text(row.value_date),receivedAt:text(row.received_at),paymentState:text(row.payment_state) as 'not_inferred'}));
    const items=receivables.data.openItems.map(openItem=>{const itemOrders=orders.filter(order=>order.openItemId===openItem.openItemId);const itemOrderIds=new Set(itemOrders.map(order=>order.directDebitOrderId));const itemReleases=releases.filter(release=>itemOrderIds.has(release.directDebitOrderId));const itemReleaseIds=new Set(itemReleases.map(release=>release.directDebitReleaseId));return buildCareDirectDebitStatus(openItem,mandates,itemOrders,itemReleases,returns.filter(item=>itemReleaseIds.has(item.directDebitReleaseId)),asOfDate,evaluatedAt);});
    return{ok:true,data:{asOfDate,evaluatedAt,items:Object.freeze(items)}};
  }catch(error){return{ok:false,error:error instanceof Error?error.message:'Mandats- und Einzugshistorie ist widersprüchlich.'};}
}

export async function recordCareDirectDebitRelease(tenantId:string,role:RoleKey|null|undefined,openItem:CareReceivableOpenItem,mandates:readonly CareSepaMandate[],orders:readonly CareDirectDebitOrder[],priorReleases:readonly CareDirectDebitRelease[],returns:readonly CareDirectDebitReturn[],release:CareDirectDebitRelease):Promise<ServiceResult<{id:string;releasedAt:string}>>{
  const denied=enforcePermission<{id:string;releasedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string;releasedAt:string}>(tenantId);if(blocked)return blocked;if(openItem.tenantId!==tenantId||release.tenantId!==tenantId)return{ok:false,error:'Dateifreigabe gehört zu einem anderen Mandanten.'};
  try{const before=buildCareDirectDebitStatus(openItem,mandates,orders,priorReleases,returns,release.mandateReadAt.slice(0,10),release.mandateReadAt);if(before.releaseEligibility!=='eligible'||before.orders.at(-1)?.directDebitOrderId!==release.directDebitOrderId)throw new Error('Mandat, Einzugsbetrag oder Zahlungsstand verlangt eine neue Prüfung.');buildCareDirectDebitStatus(openItem,mandates,orders,[...priorReleases,release],returns,release.releasedAt.slice(0,10),release.releasedAt);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Dateifreigabe ist ungültig.'};}
  const{data,error}=await rpcClient().rpc('record_pfleger_direct_debit_release',{p_payload:{...release},p_client_request_id:release.clientRequestId});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),releasedAt:text(data.released_at)}};
}

export async function recordCareDirectDebitReturn(tenantId:string,role:RoleKey|null|undefined,openItem:CareReceivableOpenItem,mandates:readonly CareSepaMandate[],orders:readonly CareDirectDebitOrder[],releases:readonly CareDirectDebitRelease[],priorReturns:readonly CareDirectDebitReturn[],returned:CareDirectDebitReturn):Promise<ServiceResult<{id:string;receivedAt:string}>>{
  const denied=enforcePermission<{id:string;receivedAt:string}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string;receivedAt:string}>(tenantId);if(blocked)return blocked;if(openItem.tenantId!==tenantId||returned.tenantId!==tenantId)return{ok:false,error:'Rücklastschrift gehört zu einem anderen Mandanten.'};
  try{const before=buildCareDirectDebitStatus(openItem,mandates,orders,releases,priorReturns,returned.receivedAt.slice(0,10),returned.receivedAt);if(before.currentOrderState!=='released'||before.releases.at(-1)?.directDebitReleaseId!==returned.directDebitReleaseId)throw new Error('Rücklastschrift benötigt eine passende einmalige Dateifreigabe.');buildCareDirectDebitStatus(openItem,mandates,orders,releases,[...priorReturns,returned],returned.receivedAt.slice(0,10),returned.receivedAt);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Rücklastschrift ist ungültig.'};}
  const{data,error}=await rpcClient().rpc('record_pfleger_direct_debit_return',{p_payload:{...returned},p_client_request_id:returned.clientRequestId});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),receivedAt:text(data.received_at)}};
}

export async function listCareInvoiceCostShares(tenantId:string,role:RoleKey|null|undefined,clientId:string):Promise<ServiceResult<CareInvoiceCostShareAssessment[]>>{
  const denied=enforcePermission<CareInvoiceCostShareAssessment[]>(role,'pflege.billing.view');if(denied)return denied;const blocked=live<CareInvoiceCostShareAssessment[]>(tenantId);if(blocked)return blocked;const client=getSupabaseClient()!;
  const assessmentsResult=await fromUnknownTable(client,'pfleger_invoice_cost_share_assessments').select('id,client_request_id,tenant_id,client_id,invoice_approval_id,invoice_draft_id,invoice_number,approval_version,approval_approved_at,document_fingerprint,coverage_basis_id,coverage_basis_version,coverage_basis_fingerprint,approved_total_cents,coverage_total_cents,personal_total_cents,assessed_at').eq('tenant_id',tenantId).eq('client_id',clientId).order('assessed_at',{ascending:false});
  if(assessmentsResult.error)return{ok:false,error:toGermanSupabaseError(assessmentsResult.error)};const assessments=(assessmentsResult.data??[])as Row[];if(!assessments.length)return{ok:true,data:[]};
  const assessmentIds=assessments.map(row=>text(row.id));const draftIds=[...new Set(assessments.map(row=>text(row.invoice_draft_id)))];
  const linesResult=await fromUnknownTable(client,'pfleger_invoice_cost_share_positions').select('assessment_id,position_no,billing_case_id,service_proof_id,service_date,service_code,approved_amount_cents,payer_type,coverage_recipient_id,coverage_recipient_name,coverage_recipient_ik,coverage_recipient_address_fingerprint,personal_recipient_id,personal_recipient_name,personal_recipient_address_fingerprint,coverage_share_cents,personal_share_cents,personal_share_basis_kind,exemption_evidence_id,exemption_evidence_fingerprint,exemption_valid_from,exemption_valid_until,exemption_recorded_at').eq('tenant_id',tenantId).in('assessment_id',assessmentIds).order('position_no',{ascending:true});
  if(linesResult.error)return{ok:false,error:toGermanSupabaseError(linesResult.error)};
  const sourcePositionsResult=await fromUnknownTable(client,'pfleger_invoice_draft_positions').select('invoice_draft_id,position_no,billing_case_id,service_proof_id,service_date,service_code,quantity_milli,unit_amount_cents,amount_cents,proof_fingerprint').eq('tenant_id',tenantId).in('invoice_draft_id',draftIds).order('position_no',{ascending:true});
  if(sourcePositionsResult.error)return{ok:false,error:toGermanSupabaseError(sourcePositionsResult.error)};
  const linesByAssessment=new Map<string,Row[]>();for(const row of (linesResult.data??[])as Row[]){const id=text(row.assessment_id);linesByAssessment.set(id,[...(linesByAssessment.get(id)??[]),row]);}
  const sourceByDraft=new Map<string,Row[]>();for(const row of (sourcePositionsResult.data??[])as Row[]){const id=text(row.invoice_draft_id);sourceByDraft.set(id,[...(sourceByDraft.get(id)??[]),row]);}
  try{return{ok:true,data:assessments.map(row=>{
    const candidate:CareInvoiceCostShareCandidate={invoiceApprovalId:text(row.invoice_approval_id),invoiceDraftId:text(row.invoice_draft_id),invoiceNumber:text(row.invoice_number),tenantId:text(row.tenant_id),clientId:text(row.client_id),approvalVersion:number(row.approval_version),approvedAt:text(row.approval_approved_at),documentFingerprint:text(row.document_fingerprint),totalAmountCents:number(row.approved_total_cents),positions:(sourceByDraft.get(text(row.invoice_draft_id))??[]).map(position=>({positionNo:number(position.position_no),billingCaseId:text(position.billing_case_id),serviceProofId:text(position.service_proof_id),serviceDate:text(position.service_date),serviceCode:text(position.service_code),quantityMilli:number(position.quantity_milli),unitAmountCents:number(position.unit_amount_cents),amountCents:number(position.amount_cents),proofFingerprint:text(position.proof_fingerprint)}))};
    const input:CareInvoiceCostShareInput={costShareAssessmentId:text(row.id),clientRequestId:text(row.client_request_id),coverageBasisId:text(row.coverage_basis_id),coverageBasisVersion:number(row.coverage_basis_version),coverageBasisFingerprint:text(row.coverage_basis_fingerprint),assessedAt:text(row.assessed_at),lines:(linesByAssessment.get(text(row.id))??[]).map(line=>({positionNo:number(line.position_no),billingCaseId:text(line.billing_case_id),serviceProofId:text(line.service_proof_id),serviceDate:text(line.service_date),serviceCode:text(line.service_code),approvedAmountCents:number(line.approved_amount_cents),payerType:text(line.payer_type) as CareInvoiceCostShareLine['payerType'],coverageRecipientId:line.coverage_recipient_id==null?null:text(line.coverage_recipient_id),coverageRecipientName:line.coverage_recipient_name==null?null:text(line.coverage_recipient_name),coverageRecipientIk:line.coverage_recipient_ik==null?null:text(line.coverage_recipient_ik),coverageRecipientAddressFingerprint:line.coverage_recipient_address_fingerprint==null?null:text(line.coverage_recipient_address_fingerprint),personalRecipientId:text(line.personal_recipient_id),personalRecipientName:text(line.personal_recipient_name),personalRecipientAddressFingerprint:text(line.personal_recipient_address_fingerprint),coverageShareCents:number(line.coverage_share_cents),personalShareCents:number(line.personal_share_cents),personalShareBasisKind:text(line.personal_share_basis_kind) as CareInvoiceCostShareLine['personalShareBasisKind'],exemptionEvidenceId:line.exemption_evidence_id==null?null:text(line.exemption_evidence_id),exemptionEvidenceFingerprint:line.exemption_evidence_fingerprint==null?null:text(line.exemption_evidence_fingerprint),exemptionValidFrom:line.exemption_valid_from==null?null:text(line.exemption_valid_from),exemptionValidUntil:line.exemption_valid_until==null?null:text(line.exemption_valid_until),exemptionRecordedAt:line.exemption_recorded_at==null?null:text(line.exemption_recorded_at)}))};
    const value=buildCareInvoiceCostShareAssessment(candidate,input);if(value.coverageTotalCents!==number(row.coverage_total_cents)||value.personalTotalCents!==number(row.personal_total_cents))throw new Error('Gespeicherte Anteilssummen sind widersprüchlich.');return value;
  })};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Anteilsfeststellungen sind widersprüchlich.'};}
}

export async function recordCareInvoiceCostShareAssessment(tenantId:string,role:RoleKey|null|undefined,candidate:CareInvoiceCostShareCandidate,input:CareInvoiceCostShareInput):Promise<ServiceResult<{id:string;assessedAt:string;coverageTotalCents:number;personalTotalCents:number}>>{
  const denied=enforcePermission<{id:string;assessedAt:string;coverageTotalCents:number;personalTotalCents:number}>(role,'pflege.invoices.manage');if(denied)return denied;const blocked=live<{id:string;assessedAt:string;coverageTotalCents:number;personalTotalCents:number}>(tenantId);if(blocked)return blocked;
  if(candidate.tenantId!==tenantId)return{ok:false,error:'Anteilsfeststellung gehört zu einem anderen Mandanten.'};
  let value:CareInvoiceCostShareAssessment;try{value=buildCareInvoiceCostShareAssessment(candidate,input);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Anteilsfeststellung ist ungültig.'};}
  const{data,error}=await rpcClient().rpc('record_pfleger_invoice_cost_share_assessment',{p_invoice_approval_id:value.invoiceApprovalId,p_payload:{...input,invoiceDraftId:value.invoiceDraftId,invoiceNumber:value.invoiceNumber,approvalVersion:value.approvalVersion,documentFingerprint:value.documentFingerprint},p_client_request_id:value.clientRequestId});
  if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),assessedAt:text(data.assessed_at),coverageTotalCents:number(data.coverage_total_cents),personalTotalCents:number(data.personal_total_cents)}};
}

export async function listCareInvoicePeriodClosures(tenantId:string,role:RoleKey|null|undefined,clientId:string):Promise<ServiceResult<CareInvoicePeriodClosure[]>>{
  const denied=enforcePermission<CareInvoicePeriodClosure[]>(role,'pflege.billing.view');if(denied)return denied;const blocked=live<CareInvoicePeriodClosure[]>(tenantId);if(blocked)return blocked;const client=getSupabaseClient()!;
  const closuresResult=await fromUnknownTable(client,'pfleger_invoice_period_closures').select('id,client_request_id,tenant_id,period_id,period_from,period_to,cutoff_at,invoice_count,invoice_total_cents,approval_evidence_id,approval_evidence_fingerprint,approved_by,approved_by_name,approved_at,closed_at').eq('tenant_id',tenantId).order('closed_at',{ascending:false});
  if(closuresResult.error)return{ok:false,error:toGermanSupabaseError(closuresResult.error)};const closures=(closuresResult.data??[])as Row[];if(!closures.length)return{ok:true,data:[]};
  const closureIds=closures.map(row=>text(row.id));
  const invoicesResult=await fromUnknownTable(client,'pfleger_invoice_period_closure_invoices').select('period_closure_id,position_no,invoice_approval_id,invoice_draft_id,client_id,invoice_number,invoice_date,approval_version,approved_at,document_fingerprint,total_amount_cents').eq('tenant_id',tenantId).in('period_closure_id',closureIds).order('position_no',{ascending:true});
  if(invoicesResult.error)return{ok:false,error:toGermanSupabaseError(invoicesResult.error)};
  const correctionsResult=await fromUnknownTable(client,'pfleger_invoice_period_corrections').select('id,client_request_id,tenant_id,original_period_closure_id,original_invoice_approval_id,correction_period_id,correction_period_from,correction_period_to,adjustment_evidence_id,adjustment_evidence_fingerprint,reason,amount_delta_cents,recorded_at,recorded_by,recorded_by_name').eq('tenant_id',tenantId).in('original_period_closure_id',closureIds).order('recorded_at',{ascending:true});
  if(correctionsResult.error)return{ok:false,error:toGermanSupabaseError(correctionsResult.error)};
  const invoicesByClosure=new Map<string,Row[]>();for(const row of (invoicesResult.data??[])as Row[]){const id=text(row.period_closure_id);invoicesByClosure.set(id,[...(invoicesByClosure.get(id)??[]),row]);}
  const correctionsByClosure=new Map<string,Row[]>();for(const row of (correctionsResult.data??[])as Row[]){const id=text(row.original_period_closure_id);correctionsByClosure.set(id,[...(correctionsByClosure.get(id)??[]),row]);}
  try{return{ok:true,data:closures.flatMap(row=>{
    const id=text(row.id);const invoiceRows=invoicesByClosure.get(id)??[];
    const sources:CareInvoicePeriodSource[]=invoiceRows.map(invoice=>({invoiceApprovalId:text(invoice.invoice_approval_id),invoiceDraftId:text(invoice.invoice_draft_id),clientId:text(invoice.client_id),invoiceNumber:text(invoice.invoice_number),invoiceDate:text(invoice.invoice_date),approvalVersion:number(invoice.approval_version),approvedAt:text(invoice.approved_at),documentFingerprint:text(invoice.document_fingerprint),totalAmountCents:number(invoice.total_amount_cents)}));
    if(clientId&&!sources.some(source=>source.clientId===clientId))return[];
    const candidate:CareInvoicePeriodClosureCandidate={tenantId:text(row.tenant_id),periodId:text(row.period_id),periodFrom:text(row.period_from),periodTo:text(row.period_to),cutoffAt:text(row.cutoff_at),invoiceApprovals:sources,openCases:[]};
    const input:CareInvoicePeriodClosureInput={periodClosureId:id,clientRequestId:text(row.client_request_id),approvalEvidenceId:text(row.approval_evidence_id),approvalEvidenceFingerprint:text(row.approval_evidence_fingerprint),approvedBy:text(row.approved_by),approvedByName:text(row.approved_by_name),approvedAt:text(row.approved_at),closedAt:text(row.closed_at),includedInvoiceApprovalIds:sources.map(source=>source.invoiceApprovalId)};
    const corrections:CareInvoicePeriodCorrection[]=(correctionsByClosure.get(id)??[]).map(correction=>({correctionId:text(correction.id),clientRequestId:text(correction.client_request_id),tenantId:text(correction.tenant_id),originalPeriodClosureId:text(correction.original_period_closure_id),originalInvoiceApprovalId:text(correction.original_invoice_approval_id),correctionPeriodId:text(correction.correction_period_id),correctionPeriodFrom:text(correction.correction_period_from),correctionPeriodTo:text(correction.correction_period_to),adjustmentEvidenceId:text(correction.adjustment_evidence_id),adjustmentEvidenceFingerprint:text(correction.adjustment_evidence_fingerprint),reason:text(correction.reason),amountDeltaCents:number(correction.amount_delta_cents),recordedAt:text(correction.recorded_at),recordedBy:text(correction.recorded_by),recordedByName:text(correction.recorded_by_name)}));
    const value=buildCareInvoicePeriodClosure(candidate,input,corrections);if(value.invoiceCount!==number(row.invoice_count)||value.invoiceTotalCents!==number(row.invoice_total_cents))throw new Error('Gespeicherter Periodenabschluss ist widersprüchlich.');return[value];
  })};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Periodenabschlüsse sind widersprüchlich.'};}
}

export async function recordCareInvoicePeriodClosure(tenantId:string,role:RoleKey|null|undefined,candidate:CareInvoicePeriodClosureCandidate,input:CareInvoicePeriodClosureInput):Promise<ServiceResult<{id:string;closedAt:string;invoiceCount:number;invoiceTotalCents:number}>>{
  const denied=enforcePermission<{id:string;closedAt:string;invoiceCount:number;invoiceTotalCents:number}>(role,'pflege.acceptance.manage');if(denied)return denied;const blocked=live<{id:string;closedAt:string;invoiceCount:number;invoiceTotalCents:number}>(tenantId);if(blocked)return blocked;if(candidate.tenantId!==tenantId)return{ok:false,error:'Periodenabschluss gehört zu einem anderen Mandanten.'};
  let value:CareInvoicePeriodClosure;try{value=buildCareInvoicePeriodClosure(candidate,input);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Periodenabschluss ist ungültig.'};}
  const{data,error}=await rpcClient().rpc('record_pfleger_invoice_period_closure',{p_period_from:value.periodFrom,p_period_to:value.periodTo,p_cutoff_at:value.cutoffAt,p_payload:{...input,periodId:value.periodId},p_client_request_id:value.clientRequestId});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),closedAt:text(data.closed_at),invoiceCount:number(data.invoice_count),invoiceTotalCents:number(data.invoice_total_cents)}};
}

export async function recordCareInvoicePeriodCorrection(tenantId:string,role:RoleKey|null|undefined,closure:CareInvoicePeriodClosure,correction:CareInvoicePeriodCorrection):Promise<ServiceResult<{id:string;recordedAt:string}>>{
  const denied=enforcePermission<{id:string;recordedAt:string}>(role,'pflege.acceptance.manage');if(denied)return denied;const blocked=live<{id:string;recordedAt:string}>(tenantId);if(blocked)return blocked;if(closure.tenantId!==tenantId||correction.tenantId!==tenantId)return{ok:false,error:'Periodenkorrektur gehört zu einem anderen Mandanten.'};
  try{buildCareInvoicePeriodClosure(closure,closure,[...closure.corrections,correction]);}catch(error){return{ok:false,error:error instanceof Error?error.message:'Periodenkorrektur ist ungültig.'};}
  const{data,error}=await rpcClient().rpc('record_pfleger_invoice_period_correction',{p_payload:{...correction},p_client_request_id:correction.clientRequestId});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id),recordedAt:text(data.recorded_at)}};
}

export async function fetchPflegePeriodAcceptances(tenantId:string,role?:RoleKey|null):Promise<ServiceResult<PflegePeriodAcceptanceItem[]>>{
  const denied=enforcePermission<PflegePeriodAcceptanceItem[]>(role,'pflege.billing.view');if(denied)return denied;const blocked=live<PflegePeriodAcceptanceItem[]>(tenantId);if(blocked)return blocked;
  const {data,error}=await fromUnknownTable(getSupabaseClient()!,'pfleger_period_acceptances').select('*').eq('tenant_id',tenantId).order('accepted_at',{ascending:false});if(error)return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:((data??[])as Row[]).map((r)=>({id:text(r.id),periodFrom:text(r.period_from),periodTo:text(r.period_to),proofCount:number(r.proof_count),approvedProofCount:number(r.approved_proof_count),releasedCaseCount:number(r.released_case_count),blockedCaseCount:number(r.blocked_case_count),invoiceFoundationCount:number(r.invoice_foundation_count),totalAmountCents:number(r.total_amount_cents),status:text(r.status) as PflegePeriodAcceptanceItem['status'],acceptedByName:text(r.accepted_by_name),acceptedAt:text(r.accepted_at)}))};
}

export async function acceptPflegeBillingPeriod(tenantId:string,role:RoleKey|null|undefined,periodFrom:string,periodTo:string,note:string):Promise<ServiceResult<{id:string}>>{
  const denied=enforcePermission<{id:string}>(role,'pflege.acceptance.manage');if(denied)return denied;const blocked=live<{id:string}>(tenantId);if(blocked)return blocked;
  const {data,error}=await rpcClient().rpc('accept_pfleger_billing_period',{p_period_from:periodFrom,p_period_to:periodTo,p_exception_note:note});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id)}};
}

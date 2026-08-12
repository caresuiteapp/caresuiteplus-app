import type { RoleKey, ServiceResult } from '@/types';
import type { PflegeBillingCaseItem, PflegeInvoiceFoundationItem, PflegePeriodAcceptanceItem, PflegeServiceProofItem } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

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
  if (error || !data || Array.isArray(data)) return { ok: false, error: toGermanSupabaseError(error) };
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

export async function fetchPflegePeriodAcceptances(tenantId:string,role?:RoleKey|null):Promise<ServiceResult<PflegePeriodAcceptanceItem[]>>{
  const denied=enforcePermission<PflegePeriodAcceptanceItem[]>(role,'pflege.billing.view');if(denied)return denied;const blocked=live<PflegePeriodAcceptanceItem[]>(tenantId);if(blocked)return blocked;
  const {data,error}=await fromUnknownTable(getSupabaseClient()!,'pfleger_period_acceptances').select('*').eq('tenant_id',tenantId).order('accepted_at',{ascending:false});if(error)return{ok:false,error:toGermanSupabaseError(error)};
  return{ok:true,data:((data??[])as Row[]).map((r)=>({id:text(r.id),periodFrom:text(r.period_from),periodTo:text(r.period_to),proofCount:number(r.proof_count),approvedProofCount:number(r.approved_proof_count),releasedCaseCount:number(r.released_case_count),blockedCaseCount:number(r.blocked_case_count),invoiceFoundationCount:number(r.invoice_foundation_count),totalAmountCents:number(r.total_amount_cents),status:text(r.status) as PflegePeriodAcceptanceItem['status'],acceptedByName:text(r.accepted_by_name),acceptedAt:text(r.accepted_at)}))};
}

export async function acceptPflegeBillingPeriod(tenantId:string,role:RoleKey|null|undefined,periodFrom:string,periodTo:string,note:string):Promise<ServiceResult<{id:string}>>{
  const denied=enforcePermission<{id:string}>(role,'pflege.acceptance.manage');if(denied)return denied;const blocked=live<{id:string}>(tenantId);if(blocked)return blocked;
  const {data,error}=await rpcClient().rpc('accept_pfleger_billing_period',{p_period_from:periodFrom,p_period_to:periodTo,p_exception_note:note});if(error||!data||Array.isArray(data))return{ok:false,error:toGermanSupabaseError(error)};return{ok:true,data:{id:text(data.id)}};
}

import type { RoleKey, ServiceResult } from '@/types';
import type { CareDiagnosis, CareMedicalOrder } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);

async function clientNames(tenantId: string, ids: string[]): Promise<ServiceResult<Map<string, string>>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  if (!ids.length) return { ok: true, data: new Map() };
  const { data, error } = await fromUnknownTable(supabase, 'clients')
    .select('id,first_name,last_name')
    .eq('tenant_id', tenantId)
    .in('id', [...new Set(ids)]);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return {
    ok: true,
    data: new Map(((data ?? []) as Row[]).map((row) => [
      text(row.id),
      `${text(row.first_name)} ${text(row.last_name)}`.trim() || '—',
    ])),
  };
}

function liveOnly<T>(): ServiceResult<T> | null {
  return getServiceMode() === 'supabase'
    ? null
    : { ok: false, error: 'Diese Pflegefunktion steht ausschließlich mit Live-Datenbank zur Verfügung.' };
}

export async function fetchCareDiagnoses(
  tenantId: string,
  role?: RoleKey | null,
): Promise<ServiceResult<CareDiagnosis[]>> {
  const denied = enforcePermission<CareDiagnosis[]>(role, 'pflege.diagnoses.view');
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant;
  const live = liveOnly<CareDiagnosis[]>();
  if (live) return live;
  const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'care_diagnoses')
    .select('*').eq('tenant_id', tenantId).neq('status', 'archived')
    .order('updated_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[];
  const names = await clientNames(tenantId, rows.map((row) => text(row.client_id)));
  if (!names.ok) return names;
  return { ok: true, data: rows.map((row) => ({
    id: text(row.id), tenantId: text(row.tenant_id), clientId: text(row.client_id),
    clientName: names.data.get(text(row.client_id)) ?? '—',
    carePlanId: row.care_plan_id ? text(row.care_plan_id) : null,
    diagnosisType: text(row.diagnosis_type) as CareDiagnosis['diagnosisType'],
    icdCode: text(row.icd_code), icdTitle: text(row.icd_title),
    physicianStatement: text(row.physician_statement),
    diagnosedAt: row.diagnosed_at ? text(row.diagnosed_at) : null,
    diagnosedBy: text(row.diagnosed_by), sourceDocument: text(row.source_document),
    relevanceForCare: text(row.relevance_for_care), precautions: text(row.precautions),
    status: text(row.status) as CareDiagnosis['status'], validFrom: text(row.valid_from),
    validUntil: row.valid_until ? text(row.valid_until) : null,
    recordedByName: text(row.recorded_by_name), createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  })) };
}

export async function createCareDiagnosis(
  tenantId: string,
  input: {
    clientId: string; icdCode: string; icdTitle: string; physicianStatement: string;
    diagnosedAt?: string; diagnosedBy: string; sourceDocument?: string;
    relevanceForCare: string; precautions?: string; actorName: string;
  },
  role?: RoleKey | null,
): Promise<ServiceResult<CareDiagnosis>> {
  const denied = enforcePermission<CareDiagnosis>(role, 'pflege.diagnoses.manage');
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant;
  const live = liveOnly<CareDiagnosis>();
  if (live) return live;
  if (!input.clientId || !input.icdTitle.trim() || !input.physicianStatement.trim() || !input.diagnosedBy.trim()) {
    return { ok: false, error: 'Klient:in, Diagnose, ärztliche Angabe und mitteilende Ärztin/Arzt sind erforderlich.' };
  }
  const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'care_diagnoses').insert({
    tenant_id: tenantId, client_id: input.clientId, diagnosis_type: 'physician_statement',
    icd_code: input.icdCode.trim() || null, icd_title: input.icdTitle.trim(),
    physician_statement: input.physicianStatement.trim(), diagnosed_at: input.diagnosedAt || null,
    diagnosed_by: input.diagnosedBy.trim(), source_document: input.sourceDocument?.trim() ?? '',
    relevance_for_care: input.relevanceForCare.trim(), precautions: input.precautions?.trim() ?? '',
    recorded_by_name: input.actorName,
  }).select('*').single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  const all = await fetchCareDiagnoses(tenantId, role);
  if (!all.ok) return all;
  const saved = all.data.find((entry) => entry.id === text((data as Row).id));
  return saved ? { ok: true, data: saved } : { ok: false, error: 'Diagnose wurde nicht zurückgelesen.' };
}

export async function fetchCareMedicalOrders(
  tenantId: string,
  role?: RoleKey | null,
): Promise<ServiceResult<CareMedicalOrder[]>> {
  const denied = enforcePermission<CareMedicalOrder[]>(role, 'pflege.orders.view');
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant;
  const live = liveOnly<CareMedicalOrder[]>();
  if (live) return live;
  const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'care_medical_orders')
    .select('*').eq('tenant_id', tenantId).neq('status', 'archived')
    .order('updated_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[];
  const names = await clientNames(tenantId, rows.map((row) => text(row.client_id)));
  if (!names.ok) return names;
  return { ok: true, data: rows.map((row) => ({
    id: text(row.id), tenantId: text(row.tenant_id), clientId: text(row.client_id),
    clientName: names.data.get(text(row.client_id)) ?? '—',
    carePlanId: row.care_plan_id ? text(row.care_plan_id) : null,
    orderType: text(row.order_type), title: text(row.title), description: text(row.description),
    orderingPhysician: text(row.ordering_physician), orderedAt: text(row.ordered_at),
    validFrom: text(row.valid_from), validUntil: row.valid_until ? text(row.valid_until) : null,
    insurerApprovalRequired: Boolean(row.insurer_approval_required),
    insurerApprovalStatus: text(row.insurer_approval_status) as CareMedicalOrder['insurerApprovalStatus'],
    frequency: text(row.frequency), executionInstructions: text(row.execution_instructions),
    qualificationRequirement: text(row.qualification_requirement),
    status: text(row.status) as CareMedicalOrder['status'], recordedByName: text(row.recorded_by_name),
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  })) };
}

export async function createCareMedicalOrder(
  tenantId: string,
  input: {
    clientId: string; orderType: string; title: string; description: string;
    orderingPhysician: string; orderedAt: string; validFrom: string; validUntil?: string;
    approvalRequired: boolean; frequency: string; executionInstructions: string;
    qualificationRequirement: string; actorName: string;
  },
  role?: RoleKey | null,
): Promise<ServiceResult<CareMedicalOrder>> {
  const denied = enforcePermission<CareMedicalOrder>(role, 'pflege.orders.manage');
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant;
  const live = liveOnly<CareMedicalOrder>();
  if (live) return live;
  if (!input.clientId || !input.title.trim() || !input.description.trim() || !input.orderingPhysician.trim()) {
    return { ok: false, error: 'Klient:in, Verordnung, Inhalt und verordnende Ärztin/Arzt sind erforderlich.' };
  }
  const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'care_medical_orders').insert({
    tenant_id: tenantId, client_id: input.clientId, order_type: input.orderType,
    title: input.title.trim(), description: input.description.trim(),
    ordering_physician: input.orderingPhysician.trim(), ordered_at: input.orderedAt,
    valid_from: input.validFrom, valid_until: input.validUntil || null,
    insurer_approval_required: input.approvalRequired,
    insurer_approval_status: input.approvalRequired ? 'pending' : 'not_required',
    frequency: input.frequency.trim(), execution_instructions: input.executionInstructions.trim(),
    qualification_requirement: input.qualificationRequirement.trim(), recorded_by_name: input.actorName,
  }).select('*').single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  const all = await fetchCareMedicalOrders(tenantId, role);
  if (!all.ok) return all;
  const saved = all.data.find((entry) => entry.id === text((data as Row).id));
  return saved ? { ok: true, data: saved } : { ok: false, error: 'Verordnung wurde nicht zurückgelesen.' };
}

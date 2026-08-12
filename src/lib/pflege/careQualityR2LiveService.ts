import type { RoleKey, ServiceResult } from '@/types';
import type {
  CareMeasureLiveItem,
  CareQualityDeviationItem,
  CareRiskLiveItem,
  PflegeMdReadinessItem,
} from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);

function live<T>(tenantId: string): ServiceResult<T> | null {
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant as ServiceResult<T>;
  if (getServiceMode() !== 'supabase' || !getSupabaseClient()) {
    return { ok: false, error: 'Pflege-Qualitätsmanagement ist ausschließlich live verfügbar.' };
  }
  return null;
}

async function clientNames(tenantId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { ok: true as const, names: new Map<string, string>() };
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'clients')
    .select('id,first_name,last_name').eq('tenant_id', tenantId).in('id', unique);
  if (error) return { ok: false as const, error: toGermanSupabaseError(error) };
  return { ok: true as const, names: new Map(((data ?? []) as Row[]).map((row) => [
    text(row.id), `${text(row.first_name)} ${text(row.last_name)}`.trim() || '—',
  ])) };
}

const rpcClient = () => getSupabaseClient()! as unknown as {
  rpc: (name: string, params?: Record<string, unknown>) => Promise<{
    data: Row | Row[] | null;
    error: Parameters<typeof toGermanSupabaseError>[0];
  }>;
};

export async function fetchLiveCareRisks(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<CareRiskLiveItem[]>> {
  const denied = enforcePermission<CareRiskLiveItem[]>(role, 'pflege.risks.view'); if (denied) return denied;
  const blocked = live<CareRiskLiveItem[]>(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient()!;
  const { data: assessments, error: assessmentError } = await fromUnknownTable(supabase, 'care_assessments')
    .select('id,subject_id,subject_name_snapshot,assessor_name_snapshot').eq('tenant_id', tenantId).eq('subject_type', 'client').neq('status', 'archived');
  if (assessmentError) return { ok: false, error: toGermanSupabaseError(assessmentError) };
  const parents = (assessments ?? []) as Row[];
  if (!parents.length) return { ok: true, data: [] };
  const { data, error } = await fromUnknownTable(supabase, 'care_assessment_risks').select('*')
    .eq('tenant_id', tenantId).in('assessment_id', parents.map((row) => text(row.id)))
    .in('risk_state', ['present', 'unclear', 'controlled']).order('next_review_at', { ascending: true });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const parentMap = new Map(parents.map((row) => [text(row.id), row]));
  return { ok: true, data: ((data ?? []) as Row[]).map((row) => {
    const parent = parentMap.get(text(row.assessment_id));
    return {
      id: text(row.id), assessmentId: text(row.assessment_id), clientId: text(parent?.subject_id),
      clientName: text(parent?.subject_name_snapshot) || '—', riskKey: text(row.risk_key),
      state: text(row.risk_state) as CareRiskLiveItem['state'], urgency: text(row.urgency) as CareRiskLiveItem['urgency'],
      evidence: text(row.evidence), professionalRationale: text(row.professional_rationale),
      nextReviewAt: row.next_review_at ? text(row.next_review_at) : null,
      assessorName: text(parent?.assessor_name_snapshot) || 'Pflegefachperson',
    };
  }) };
}

export async function reviewLiveCareRisk(tenantId: string, role: RoleKey | null | undefined, riskId: string, payload: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.risks.manage'); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('review_care_risk', { p_risk_id: riskId, p_payload: payload });
  if (error || !data || Array.isArray(data)) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function fetchLiveCareMeasures(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<CareMeasureLiveItem[]>> {
  const denied = enforcePermission<CareMeasureLiveItem[]>(role, 'pflege.plans.view'); if (denied) return denied;
  const blocked = live<CareMeasureLiveItem[]>(tenantId); if (blocked) return blocked;
  const supabase = getSupabaseClient()!;
  const { data: plans, error: planError } = await fromUnknownTable(supabase, 'care_plans').select('id,client_id,title')
    .eq('tenant_id', tenantId).neq('status', 'archived');
  if (planError) return { ok: false, error: toGermanSupabaseError(planError) };
  const planRows = (plans ?? []) as Row[];
  if (!planRows.length) return { ok: true, data: [] };
  const { data, error } = await fromUnknownTable(supabase, 'care_plan_items').select('*').eq('tenant_id', tenantId)
    .in('care_plan_id', planRows.map((row) => text(row.id))).in('status', ['active', 'paused']).order('next_evaluation_date', { ascending: true });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const planMap = new Map(planRows.map((row) => [text(row.id), row]));
  const names = await clientNames(tenantId, planRows.map((row) => text(row.client_id))); if (!names.ok) return names;
  return { ok: true, data: ((data ?? []) as Row[]).map((row) => {
    const plan = planMap.get(text(row.care_plan_id)); const due = row.next_evaluation_date ? text(row.next_evaluation_date) : null;
    return {
      id: text(row.id), carePlanId: text(row.care_plan_id), clientId: text(plan?.client_id),
      clientName: names.names.get(text(plan?.client_id)) ?? '—', planTitle: text(plan?.title), title: text(row.title),
      intervention: text(row.intervention) || text(row.description), frequency: text(row.frequency) || text(row.timing),
      responsibleRole: text(row.responsible_role), status: text(row.status) as CareMeasureLiveItem['status'],
      nextEvaluationAt: due, overdue: Boolean(due && Date.parse(due) <= Date.now()),
    };
  }) };
}

export async function reviewLiveCareMeasure(tenantId: string, role: RoleKey | null | undefined, itemId: string, payload: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.measures.review'); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('review_care_plan_measure', { p_item_id: itemId, p_payload: payload });
  if (error || !data || Array.isArray(data)) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function fetchQualityDeviations(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<CareQualityDeviationItem[]>> {
  const denied = enforcePermission<CareQualityDeviationItem[]>(role, 'pflege.deviations.view'); if (denied) return denied;
  const blocked = live<CareQualityDeviationItem[]>(tenantId); if (blocked) return blocked;
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'care_quality_deviations').select('*')
    .eq('tenant_id', tenantId).neq('status', 'cancelled').order('created_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[]; const names = await clientNames(tenantId, rows.map((row) => text(row.client_id))); if (!names.ok) return names;
  return { ok: true, data: rows.map((row) => ({
    id: text(row.id), clientId: row.client_id ? text(row.client_id) : null,
    clientName: row.client_id ? names.names.get(text(row.client_id)) ?? '—' : 'Organisation',
    carePlanId: row.care_plan_id ? text(row.care_plan_id) : null, sourceType: text(row.source_type), category: text(row.category),
    severity: text(row.severity) as CareQualityDeviationItem['severity'], title: text(row.title), description: text(row.description),
    immediateAction: text(row.immediate_action), rootCause: text(row.root_cause), correctiveAction: text(row.corrective_action),
    status: text(row.status) as CareQualityDeviationItem['status'], recurringProblem: Boolean(row.recurring_problem),
    responsibleName: text(row.responsible_name), effectivenessResult: text(row.effectiveness_result),
    dueAt: row.due_at ? text(row.due_at) : null, createdAt: text(row.created_at),
  })) };
}

export async function createQualityDeviation(tenantId: string, role: RoleKey | null | undefined, clientId: string | null, carePlanId: string | null, payload: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.deviations.manage'); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('create_care_quality_deviation', { p_client_id: clientId, p_care_plan_id: carePlanId, p_payload: payload });
  if (error || !data || Array.isArray(data)) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function advanceQualityDeviation(tenantId: string, role: RoleKey | null | undefined, deviationId: string, payload: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.deviations.manage'); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('advance_care_quality_deviation', { p_deviation_id: deviationId, p_payload: payload });
  if (error || !data || Array.isArray(data)) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function fetchMdReadiness(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<PflegeMdReadinessItem[]>> {
  const denied = enforcePermission<PflegeMdReadinessItem[]>(role, 'pflege.md.readiness'); if (denied) return denied;
  const blocked = live<PflegeMdReadinessItem[]>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('get_pfleger_md_readiness');
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: (Array.isArray(data) ? data : []) as unknown as PflegeMdReadinessItem[] };
}

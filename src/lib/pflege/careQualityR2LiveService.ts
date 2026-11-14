import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
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
import { isCalendarDate } from './ambulatoryOperationsDomain';
import { readCompleteCarePlanRows } from './carePlanCompleteRead';
import { berlinCalendarDate } from './careTourWorkflow';
import { woundUuid } from './woundCareDomain';
import { readMdEvidenceRows } from './mdEvidenceWorkspace';
import { canReviewMeasure, sameMeasureReviewFrame } from './carePlanDailyWorklist';
import { NATIVE_SERVICE_QUERY_TIMEOUT_MS, withServiceQueryTimeout } from '@/lib/services/queryTimeout';

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

export type CareMeasureReadOptions = {
  planId?: string;
  clientId?: string;
  itemId?: string;
  permissions?: readonly PermissionKey[];
  isCurrent?: () => boolean;
};

const measureStatuses = new Set<string>(['active', 'paused', 'completed', 'cancelled']);
const invalidMeasures = 'Die Maßnahmenliste konnte nicht vollständig im aktuellen Pflegebezug gelesen werden.';
const plainRow = (value: unknown): value is Row => value !== null && typeof value === 'object' && !Array.isArray(value);
const nullableText = (value: unknown): value is string | null => typeof value === 'string' || value === null;

export async function fetchLiveCareMeasures(
  tenantId: string,
  role?: RoleKey | null,
  options: CareMeasureReadOptions = {},
): Promise<ServiceResult<CareMeasureLiveItem[]>> {
  const { itemId, planId, clientId, isCurrent, permissions } = options;
  const denied = enforcePermission<CareMeasureLiveItem[]>(role, 'pflege.plans.view', { effectivePermissions: permissions });
  if (denied) return denied;
  if (!woundUuid(tenantId) || [itemId, planId, clientId].some(value => value !== undefined && !woundUuid(value))) {
    return { ok: false, error: 'Die Maßnahme, der Pflegeplan oder die Pflegeakte konnte nicht eindeutig ausgewählt werden.' };
  }
  const blocked = live<CareMeasureLiveItem[]>(tenantId); if (blocked) return blocked;
  const db = getSupabaseClient();
  function assertCurrent() {
    if (getSupabaseClient() !== db || getServiceMode() !== 'supabase' || (isCurrent && !isCurrent())) throw Error(invalidMeasures);
  }
  if (!db) return { ok: false, error: invalidMeasures };
  const parentFrames = new Map<string, Row>();
  const clientFrames = new Map<string, Row>();
  const equalFields = (before: Row | undefined, next: Row, keys: string[]) => !before || keys.every(key => before[key] === next[key]);
  const result = await readCompleteCarePlanRows(async (from, to) => {
    assertCurrent();
    let query = fromUnknownTable(db, 'care_plan_items').select(
      'id,tenant_id,care_plan_id,title,intervention,frequency,responsible_role,status,next_evaluation_date,updated_at,'
      + 'plan:care_plans!care_plan_items_care_plan_id_fkey!inner(id,tenant_id,client_id,title,status,updated_at,client:clients!care_plans_client_id_fkey!inner(id,tenant_id,first_name,last_name))',
      { count: 'exact' },
    ).eq('tenant_id', tenantId).eq('plan.tenant_id', tenantId).eq('plan.client.tenant_id', tenantId)
      .neq('plan.status', 'archived');
    if (itemId) query = query.eq('id', itemId);
    if (planId) query = query.eq('care_plan_id', planId);
    if (clientId) query = query.eq('plan.client_id', clientId);
    const page = await query.order('id', { ascending: true }).range(from, to);
    assertCurrent();
    return page;
  }, (row) => {
    const { plan } = row;
    if (!woundUuid(row.id) || row.tenant_id !== tenantId || !woundUuid(row.care_plan_id) || !plainRow(plan)
      || plan.id !== row.care_plan_id || plan.tenant_id !== tenantId || !woundUuid(plan.client_id)
      || (itemId && row.id !== itemId) || (planId && row.care_plan_id !== planId) || (clientId && plan.client_id !== clientId)
      || typeof plan.status !== 'string' || !plan.status.trim() || plan.status === 'archived'
      || typeof row.status !== 'string' || !measureStatuses.has(row.status)
      || typeof row.title !== 'string' || typeof plan.title !== 'string' || typeof plan.updated_at !== 'string'
      || !nullableText(row.intervention) || !nullableText(row.frequency) || !nullableText(row.responsible_role)
      || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))
      || !(row.next_evaluation_date === null || (typeof row.next_evaluation_date === 'string' && isCalendarDate(row.next_evaluation_date)))) return false;
    const { client } = plan;
    if (!plainRow(client) || client.id !== plan.client_id || client.tenant_id !== tenantId
      || !nullableText(client.first_name) || !nullableText(client.last_name)
      || !equalFields(parentFrames.get(row.care_plan_id), plan, ['client_id', 'title', 'status', 'updated_at'])
      || !equalFields(clientFrames.get(plan.client_id), client, ['first_name', 'last_name'])) return false;
    parentFrames.set(row.care_plan_id, plan);
    clientFrames.set(plan.client_id, client);
    return true;
  });
  if (!result.ok) return { ok: false, error: invalidMeasures };
  try { assertCurrent(); } catch { return { ok: false, error: invalidMeasures }; }
  const day = berlinCalendarDate();
  // Production uses an English-only enum. Older text schemas can have "archiviert";
  // omit those rows after the full counted read rather than sending an invalid enum filter.
  return { ok: true, data: result.data.filter(row => (row.plan as Row).status !== 'archiviert').map(row => {
    const plan = row.plan as Row;
    const client = plan.client as Row;
    const nextEvaluationAt = row.next_evaluation_date as string | null;
    const status = row.status as CareMeasureLiveItem['status'];
    return {
      id: text(row.id), carePlanId: text(row.care_plan_id), clientId: text(plan.client_id),
      clientName: [text(client.first_name), text(client.last_name)].filter(Boolean).join(' ').trim(),
      planTitle: text(plan.title), planStatus: text(plan.status), title: text(row.title),
      intervention: text(row.intervention), frequency: text(row.frequency), responsibleRole: text(row.responsible_role),
      status, nextEvaluationAt, updatedAt: text(row.updated_at),
      overdue: status === 'active' && ['active', 'aktiv'].includes(text(plan.status)) && nextEvaluationAt !== null && nextEvaluationAt <= day,
    };
  }) };
}

export type CareMeasureReviewScope = {
  actorId: string;
  expected: CareMeasureLiveItem;
  permissions: readonly PermissionKey[];
  isCurrent(): boolean;
};

export async function reviewLiveCareMeasure(tenantId: string, role: RoleKey | null | undefined, itemId: string, payload: Record<string, unknown>, scope: CareMeasureReviewScope): Promise<ServiceResult<{ id: string }> | { ok: false; error: string; uncertain: true }> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.measures.review', { effectivePermissions: scope.permissions }); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  const sdk = getSupabaseClient();
  const current = () => scope.isCurrent() && !!sdk && sdk === getSupabaseClient() && getServiceMode() === 'supabase';
  if (!current() || !woundUuid(scope.actorId) || itemId !== scope.expected.id || !canReviewMeasure(scope.expected)) return { ok: false, error: 'Die Maßnahme ist im aktuellen Pflegebezug nicht zur Evaluation verfügbar.' };
  const expected = scope.expected;
  const read = await fetchLiveCareMeasures(tenantId, role, { itemId, planId: expected.carePlanId, clientId: expected.clientId, permissions: scope.permissions, isCurrent: current });
  if (!read.ok || !current() || read.data.length !== 1 || !sameMeasureReviewFrame(expected, read.data[0])) return { ok: false, error: 'Die Maßnahme oder die Leseberechtigung hat sich geändert. Bitte laden Sie die Angaben neu.' };
  const uncertain = { ok: false as const, error: 'Der Server hat die Speicherung nicht eindeutig bestätigt. Prüfen Sie den aktuellen Stand, bevor Sie eine weitere Evaluation erfassen.', uncertain: true as const };
  try {
    const { data, error } = await withServiceQueryTimeout(rpcClient().rpc('review_care_plan_measure', { p_item_id: itemId, p_payload: payload }), 'Maßnahmenevaluation', NATIVE_SERVICE_QUERY_TIMEOUT_MS);
    if (!current()) return uncertain;
    if (error) {
      if (plainRow(error) && (error.code === '42501' || error.code === '23514')) return { ok: false, error: toGermanSupabaseError(error) };
      return uncertain;
    }
    if (!data || Array.isArray(data) || !woundUuid(data.id) || data.tenant_id !== tenantId || data.care_plan_item_id !== itemId
      || data.care_plan_id !== expected.carePlanId || data.client_id !== expected.clientId || data.reviewer_profile_id !== scope.actorId
      || data.decision !== payload.decision || data.observed_effect !== payload.observedEffect || data.professional_rationale !== payload.professionalRationale) return uncertain;
    return { ok: true, data: { id: data.id } };
  } catch { return uncertain; }
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

export async function fetchMdReadiness(tenantId: string, role: RoleKey | null, effectivePermissions: readonly PermissionKey[]): Promise<ServiceResult<PflegeMdReadinessItem[]>> {
  const denied = enforcePermission<PflegeMdReadinessItem[]>(role, 'pflege.md.readiness', { effectivePermissions }); if (denied) return denied;
  const blocked = live<PflegeMdReadinessItem[]>(tenantId); if (blocked) return blocked;
  const { data, error } = await rpcClient().rpc('get_pfleger_md_readiness');
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = readMdEvidenceRows(data);
  return rows === null ? { ok: false, error: 'Die Nachweisübersicht wurde nicht vollständig bestätigt.' } : { ok: true, data: rows };
}

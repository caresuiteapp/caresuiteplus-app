import type { RoleKey, ServiceResult } from '@/types';
import type {
  CarePlanEvaluationListItem,
  CareQualityVisitListItem,
  PflegeReportStats,
} from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import type { PermissionEnforcementContext } from '@/lib/permissions/enforce';
import { parsePflegeQualityStats } from './pflegeQualityWorkspace';
import { readCompleteCarePlanRows } from './carePlanCompleteRead';
import { woundUuid } from './woundCareDomain';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type Row = Record<string, unknown>;
const text = (value: unknown): string => value == null ? '' : String(value);

function liveGuard<T>(tenantId: string): ServiceResult<T> | null {
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant as ServiceResult<T>;
  if (getServiceMode() !== 'supabase' || !getSupabaseClient()) {
    return { ok: false, error: 'Pflegeplanung und Qualität sind ausschließlich live verfügbar.' };
  }
  return null;
}

async function referenceMaps(tenantId: string, rows: Row[]) {
  const supabase = getSupabaseClient()!;
  const clientIds = [...new Set(rows.map((row) => text(row.client_id)).filter(Boolean))];
  const planIds = [...new Set(rows.map((row) => text(row.care_plan_id)).filter(Boolean))];
  const [clients, plans] = await Promise.all([
    clientIds.length
      ? fromUnknownTable(supabase, 'clients').select('id,first_name,last_name').eq('tenant_id', tenantId).in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    planIds.length
      ? fromUnknownTable(supabase, 'care_plans').select('id,title').eq('tenant_id', tenantId).in('id', planIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = clients.error ?? plans.error;
  if (error) return { ok: false as const, error: toGermanSupabaseError(error) };
  return {
    ok: true as const,
    clients: new Map(((clients.data ?? []) as Row[]).map((row) => [text(row.id), row])),
    plans: new Map(((plans.data ?? []) as Row[]).map((row) => [text(row.id), row])),
  };
}

export async function fetchCarePlanEvaluations(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  scope?: { carePlanId?: string; permissionContext: PermissionEnforcementContext; isCurrent(): boolean },
): Promise<ServiceResult<CarePlanEvaluationListItem[]>> {
  const denied = enforcePermission<CarePlanEvaluationListItem[]>(actorRoleKey, 'pflege.evaluations.view', scope?.permissionContext);
  if (denied) return denied;
  const blocked = liveGuard<CarePlanEvaluationListItem[]>(tenantId);
  if (blocked) return blocked;
  const supabase = getSupabaseClient()!;
  const current = () => (!scope || scope.isCurrent()) && supabase === getSupabaseClient();
  const scopeError = { ok: false as const, error: 'Der Zugriff auf die Evaluationen ist nicht mehr aktuell.' };
  if (!current() || (scope?.carePlanId !== undefined && !woundUuid(scope.carePlanId))) return scopeError;
  const read = await readCompleteCarePlanRows((from, to) => {
    if (!current()) throw Error(scopeError.error);
    let query = fromUnknownTable(supabase, 'care_plan_evaluations')
      .select('id,tenant_id,client_id,care_plan_id,outcome,observed_effect,professional_conclusion,requires_plan_update,evaluated_at,next_evaluation_at,evaluator_name_snapshot', { count: 'exact' })
      .eq('tenant_id', tenantId);
    if (scope?.carePlanId) query = query.eq('care_plan_id', scope.carePlanId);
    return query.order('id', { ascending: true }).range(from, to);
  }, row => row.tenant_id === tenantId && woundUuid(row.client_id) && woundUuid(row.care_plan_id)
    && (!scope?.carePlanId || row.care_plan_id === scope.carePlanId));
  if (!current()) return scopeError;
  if (!read.ok) return { ok: false, error: 'Die Evaluationen konnten nicht vollständig geladen werden.' };
  const clients = new Map<string, Row>(), plans = new Map<string, Row>();
  const loadReferences = async (table: string, columns: string, ids: string[], target: Map<string, Row>) => {
    const unique = [...new Set(ids)];
    for (let offset = 0; offset < unique.length; offset += 100) {
      if (!current()) return false;
      const batch = unique.slice(offset, offset + 100);
      const { data, error } = await fromUnknownTable(supabase, table).select(columns).eq('tenant_id', tenantId).in('id', batch);
      if (error || !Array.isArray(data) || !current()) return false;
      const delivered: unknown[] = data;
      for (const value of delivered) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
        const row = value as Row;
        if (row.tenant_id !== tenantId || typeof row.id !== 'string' || !batch.includes(row.id) || target.has(row.id)) return false;
        target.set(row.id, row);
      }
    }
    return true;
  };
  const confirmedRefs = await Promise.all([
    loadReferences('clients', 'id,tenant_id,first_name,last_name', read.data.map(row => text(row.client_id)), clients),
    loadReferences('care_plans', 'id,tenant_id,client_id,title', read.data.map(row => text(row.care_plan_id)), plans),
  ]);
  if (!current()) return scopeError;
  if (!confirmedRefs.every(Boolean) || read.data.some(row => {
    const plan = plans.get(text(row.care_plan_id));
    return plan && plan.client_id !== row.client_id;
  })) return { ok: false, error: 'Die Bezüge der Evaluationen konnten nicht geprüft werden.' };
  return { ok: true, data: read.data.map((row) => {
    const client = clients.get(text(row.client_id));
    return {
      id: text(row.id), tenantId: text(row.tenant_id), clientId: text(row.client_id),
      clientName: client ? `${text(client.first_name)} ${text(client.last_name)}`.trim() : '—',
      carePlanId: text(row.care_plan_id), planTitle: text(plans.get(text(row.care_plan_id))?.title) || 'Pflegeplan',
      outcome: text(row.outcome) as CarePlanEvaluationListItem['outcome'],
      observedEffect: text(row.observed_effect), professionalConclusion: text(row.professional_conclusion),
      requiresPlanUpdate: Boolean(row.requires_plan_update), evaluatedAt: text(row.evaluated_at),
      nextEvaluationAt: row.next_evaluation_at ? text(row.next_evaluation_at) : null,
      evaluatorName: text(row.evaluator_name_snapshot) || 'Pflegefachperson',
    };
  }).sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt) || a.id.localeCompare(b.id)) };
}

export async function createCarePlanEvaluation(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  input: {
    carePlanId: string; outcome: CarePlanEvaluationListItem['outcome']; observedEffect: string;
    personFeedback: string; professionalConclusion: string; changesRequired: string;
    requiresPlanUpdate: boolean; evaluatedAt: string; nextEvaluationAt: string | null; actorName: string;
  },
  permissionContext?: PermissionEnforcementContext,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.evaluations.manage', permissionContext);
  if (denied) return denied;
  const blocked = liveGuard<{ id: string }>(tenantId);
  if (blocked) return blocked;
  if (!input.carePlanId || !input.observedEffect.trim() || !input.professionalConclusion.trim()) {
    return { ok: false, error: 'Pflegeplan, beobachtete Wirkung und fachliche Schlussfolgerung sind erforderlich.' };
  }
  const supabase = getSupabaseClient()! as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }>;
  };
  const { data, error } = await supabase.rpc('create_care_plan_evaluation', {
    p_care_plan_id: input.carePlanId, p_payload: input,
  });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function fetchCareQualityVisits(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareQualityVisitListItem[]>> {
  const denied = enforcePermission<CareQualityVisitListItem[]>(actorRoleKey, 'pflege.visits.view');
  if (denied) return denied;
  const blocked = liveGuard<CareQualityVisitListItem[]>(tenantId);
  if (blocked) return blocked;
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'care_quality_visits')
    .select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[];
  const refs = await referenceMaps(tenantId, rows);
  if (!refs.ok) return refs;
  return { ok: true, data: rows.map((row) => {
    const client = refs.clients.get(text(row.client_id));
    return {
      id: text(row.id), tenantId: text(row.tenant_id), clientId: text(row.client_id),
      clientName: client ? `${text(client.first_name)} ${text(client.last_name)}`.trim() : '—',
      carePlanId: row.care_plan_id ? text(row.care_plan_id) : null,
      planTitle: text(refs.plans.get(text(row.care_plan_id))?.title),
      visitType: text(row.visit_type) as CareQualityVisitListItem['visitType'],
      status: text(row.status) as CareQualityVisitListItem['status'], scope: text(row.scope),
      findings: text(row.findings), deviations: text(row.deviations),
      scheduledAt: row.scheduled_at ? text(row.scheduled_at) : null,
      conductedAt: row.conducted_at ? text(row.conducted_at) : null,
      nextVisitAt: row.next_visit_at ? text(row.next_visit_at) : null,
      visitorName: text(row.visitor_name_snapshot) || 'Pflegefachperson',
    };
  }) };
}

export async function createCareQualityVisit(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  input: {
    clientId: string; carePlanId: string | null; visitType: CareQualityVisitListItem['visitType'];
    status: CareQualityVisitListItem['status']; scheduledAt: string | null; conductedAt: string | null;
    scope: string; findings: string; deviations: string; agreedActions: string;
    personFeedback: string; nextVisitAt: string | null; actorName: string;
  },
  permissionContext?: PermissionEnforcementContext,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.visits.manage', permissionContext);
  if (denied) return denied;
  const blocked = liveGuard<{ id: string }>(tenantId);
  if (blocked) return blocked;
  if (!input.clientId || !input.scope.trim()) return { ok: false, error: 'Pflegefall und Prüfumfang sind erforderlich.' };
  const supabase = getSupabaseClient()! as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }>;
  };
  const { data, error } = await supabase.rpc('create_care_quality_visit', {
    p_client_id: input.clientId, p_care_plan_id: input.carePlanId, p_payload: input,
  });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

export async function fetchLivePflegeQualityStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  permissionContext?: PermissionEnforcementContext,
): Promise<ServiceResult<PflegeReportStats>> {
  const denied = enforcePermission<PflegeReportStats>(actorRoleKey, 'pflege.quality.view', permissionContext);
  if (denied) return denied;
  const blocked = liveGuard<PflegeReportStats>(tenantId);
  if (blocked) return blocked;
  const supabase = getSupabaseClient()! as unknown as {
    rpc: (name: string) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }>;
  };
  const { data, error } = await supabase.rpc('get_pfleger_quality_stats');
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  const stats = parsePflegeQualityStats(data);
  return stats ? { ok: true, data: stats } : { ok: false, error: 'Die Kennzahlen konnten nicht vollständig ermittelt werden.' };
}

import type { ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { NATIVE_SERVICE_QUERY_TIMEOUT_MS, withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { emptyPflegeDashboardStats, type PflegeDashboardStats } from '@/types/modules/pflege';
import { berlinCalendarDate } from './careTourWorkflow';
import { woundUuid } from './woundCareDomain';

export type CareDashboardScope = {
  tenantId: string;
  actorId: string;
  isCurrent(): boolean;
  can(permission: PermissionKey): boolean;
};

const contextError = 'Der aktuelle Zugriff auf die Pflegekennzahlen ist nicht bestätigt.';
const unavailableByDesign = ['pflege-ws-kpi-due-vitals', 'pflege-ws-kpi-medication', 'pflege-ws-kpi-client-assignment'];
type CountResponse = { count: number | null; error: unknown };
type CountField = Exclude<keyof PflegeDashboardStats, 'unavailableKpiIds' | 'failedKpiIds'>;

/** Read aggregate records already available to the authenticated RLS caller. */
export async function fetchCareOperationalStats(scope: CareDashboardScope): Promise<ServiceResult<PflegeDashboardStats>> {
  const { tenantId, actorId } = scope;
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  const client = getSupabaseClient();
  const current = () => woundUuid(actorId) && woundUuid(tenantId) && scope.actorId === actorId && scope.tenantId === tenantId
    && scope.isCurrent() && scope.can('pflege.access') && client === getSupabaseClient() && getServiceMode() === 'supabase';
  if (!client || !current()) return { ok: false, error: contextError };
  const day = berlinCalendarDate();
  const select = (table: string, columns = 'id') => fromUnknownTable(client, table)
    .select(columns, { count: 'exact', head: true }).eq('tenant_id', tenantId);
  const tours = () => select('care_tour_stops', 'id,care_tours!inner(id)')
    .eq('care_tours.tenant_id', tenantId).eq('care_tours.tour_date', day).neq('care_tours.status', 'cancelled');
  async function count(
    permission: PermissionKey,
    request: () => PromiseLike<CountResponse>,
  ): Promise<{ value: number | null; failed: boolean }> {
    if (!current() || !scope.can(permission)) return { value: null, failed: false };
    try {
      const result = await withServiceQueryTimeout(Promise.resolve(request()), 'Pflegekennzahl', NATIVE_SERVICE_QUERY_TIMEOUT_MS);
      if (!current() || !scope.can(permission)) return { value: null, failed: false };
      if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) return { value: null, failed: true };
      return { value: result.count, failed: false };
    } catch {
      return { value: null, failed: current() && scope.can(permission) };
    }
  }

  const specs = [
    ['visitsToday', 'pflege-ws-kpi-visits-today', 'pflege.plans.view', () => tours().neq('status', 'cancelled')],
    ['runningNow', 'pflege-ws-kpi-running', 'pflege.plans.view', () => tours().eq('status', 'in_progress')],
    ['totalPlans', 'pflege-ws-kpi-plan-total', 'pflege.plans.view', () => select('care_plans').in('status', ['draft', 'active', 'paused', 'completed'])],
    ['activePlansCount', 'pflege-ws-kpi-active-plans', 'pflege.plans.view', () => select('care_plans').eq('status', 'active')],
    ['dueMeasuresCount', 'pflege-ws-kpi-due-measures', 'pflege.plans.view', () => select('care_plan_items', 'id,care_plans!care_plan_items_care_plan_id_fkey!inner(id,clients!care_plans_client_id_fkey!inner(id))')
      .eq('care_plans.tenant_id', tenantId).eq('care_plans.clients.tenant_id', tenantId).eq('care_plans.status', 'active').eq('status', 'active').lte('next_evaluation_date', day)],
    ['openDocumentationCount', 'pflege-ws-kpi-open-docs', 'pflege.documentation.view', () => select('clinical_documentation_entries').eq('signature_status', 'unsigned')],
    ['openReportsCount', 'pflege-ws-kpi-reports', 'pflege.documentation.view', () => select('clinical_documentation_entries').eq('signature_status', 'unsigned').eq('entry_type', 'care_report')],
    ['openWoundDocsCount', 'pflege-ws-kpi-wounds', 'pflege.wounds.view', () => select('clinical_wound_cases').in('status', ['active', 'healing', 'deteriorated'])],
    ['openHandoversCount', 'pflege-ws-kpi-handovers', 'pflege.handovers.view', () => select('clinical_handovers').eq('status', 'open')],
    ['openSisAssessmentCount', 'pflege-ws-kpi-sis', 'pflege.plans.view', () => select('care_assessments').eq('subject_type', 'client').in('status', ['draft', 'in_progress', 'professional_review'])],
    ['abnormalVitalsCount', 'pflege-ws-kpi-abnormal-vitals', 'pflege.vitals.view', () => select('vital_sign_measurements').eq('flag_status', 'outside_configured_range')],
  ] as const satisfies readonly (readonly [CountField, string, PermissionKey, () => PromiseLike<CountResponse>])[];

  const results = await Promise.all(specs.map(async ([field, id, permission, request]) => ({ field, id, permission, ...await count(permission, request) })));
  if (!current() || berlinCalendarDate() !== day) return { ok: false, error: 'Der Zugriff oder der Auswertungstag hat sich geändert. Bitte neu laden.' };
  const data = emptyPflegeDashboardStats();
  const unavailableKpiIds = [...unavailableByDesign];
  const failedKpiIds: string[] = [];
  for (const { field, id, permission, value, failed } of results) {
    if (value === null || !scope.can(permission)) {
      unavailableKpiIds.push(id);
      if (failed && scope.can(permission)) failedKpiIds.push(id);
    } else data[field] = value;
  }
  return { ok: true, data: { ...data, unavailableKpiIds, failedKpiIds } };
}

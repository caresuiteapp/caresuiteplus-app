import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fetchEligibleCareClients } from '@/lib/careAssessment/careAssessmentService';
import { fetchCareTours } from './careTourPlanningService';
import { berlinCalendarDate } from './careTourWorkflow';
import type { PflegeDashboardStats } from '@/types/modules/pflege';

/** Missing/unavailable indicators must never appear as reassuring zero counts. */
export async function fetchCareOperationalStats(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<Partial<PflegeDashboardStats>>> {
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Live-Datenbank nicht verfügbar.' };
  async function count(table: string, permission: PermissionKey, column: string, values: string[], entryType?: string, typeColumn = 'entry_type'): Promise<ServiceResult<number | null>> {
    if (!hasPermission(role, permission)) return { ok: true, data: null };
    let query = fromUnknownTable(client!, table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in(column, values);
    if (entryType) query = query.eq(typeColumn, entryType);
    const result = await query;
    return result.error ? { ok: false, error: toGermanSupabaseError(result.error) } : { ok: true, data: result.count ?? 0 };
  }
  const [tours, clients, documents, reports, wounds, handovers, assessments, vitals] = await Promise.all([
    fetchCareTours(tenantId, role), fetchEligibleCareClients(tenantId, role),
    count('clinical_documentation_entries', 'pflege.documentation.view', 'signature_status', ['unsigned']),
    count('clinical_documentation_entries', 'pflege.documentation.view', 'signature_status', ['unsigned'], 'care_report'),
    count('clinical_wound_cases', 'pflege.wounds.view', 'status', ['active', 'healing', 'deteriorated']),
    count('clinical_handovers', 'pflege.handovers.view', 'status', ['open']),
    count('care_assessments', 'pflege.plans.view', 'status', ['draft', 'in_progress', 'professional_review'], 'client', 'subject_type'),
    count('vital_sign_measurements', 'pflege.vitals.view', 'flag_status', ['outside_configured_range']),
  ]);
  const results = [tours, clients, documents, reports, wounds, handovers, assessments, vitals];
  const failure = results.find((r) => !r.ok);
  if (failure && !failure.ok) return { ok: false, error: failure.error };
  if (!tours.ok || !clients.ok || !documents.ok || !reports.ok || !wounds.ok || !handovers.ok || !assessments.ok || !vitals.ok) return { ok: false, error: 'Kennzahlen konnten nicht vollständig geladen werden.' };
  const today = tours.data.filter((tour) => tour.tourDate === berlinCalendarDate() && tour.status !== 'cancelled').flatMap((tour) => tour.stops).filter((stop) => stop.status !== 'cancelled');
  const unavailableKpiIds = ['pflege-ws-kpi-due-vitals', 'pflege-ws-kpi-medication'];
  for (const [result, id] of [[documents, 'pflege-ws-kpi-open-docs'], [reports, 'pflege-ws-kpi-reports'], [wounds, 'pflege-ws-kpi-wounds'], [handovers, 'pflege-ws-kpi-handovers'], [assessments, 'pflege-ws-kpi-sis'], [vitals, 'pflege-ws-kpi-abnormal-vitals']] as const) {
    if (result.data === null) unavailableKpiIds.push(id);
  }
  return { ok: true, data: {
    visitsToday: today.length, runningNow: today.filter((s) => s.status === 'in_progress').length,
    assignedClientsCount: clients.data.length,
    openDocumentationCount: documents.data ?? 0, openReportsCount: reports.data ?? 0,
    openWoundDocsCount: wounds.data ?? 0, openHandoversCount: handovers.data ?? 0,
    openSisAssessmentCount: assessments.data ?? 0, abnormalVitalsCount: vitals.data ?? 0,
    unavailableKpiIds,
  } };
}

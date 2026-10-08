import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { ensurePortalWriteSession } from '@/lib/auth/portalSupabaseAuth';
import { resolveLiveAssignment } from '@/features/liveTracking/resolveLiveAssignment';
import { resolveExecutableVisitId } from '@/lib/assist/visitService';
import { isUuid } from '@/lib/validation/uuid';
import { OPTIONAL_VISIT_TASKS_RELEASE, optionalTaskTitleKey, validateOptionalTaskDrafts, type OptionalVisitTaskDraft } from './optionalVisitTasks';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

export type OptionalTaskSaveResult = { ok: true; inserted: number; tasks: EmployeePortalTaskItem[] }
  | { ok: false; error: string };
export type OptionalTaskScope = { tenantId: string; assignmentId: string; employeeId: string;
  portalSession: Parameters<typeof ensurePortalWriteSession>[0] };

function taskWriteError(error: { code?: string; message?: string } | null): string {
  if (error?.code === '42501') return 'Sie können Aufgaben nur zu Ihrem eigenen freigegebenen Einsatz hinzufügen.';
  if (error?.code === '55000') return 'Dieser Einsatz ist bereits gesperrt oder zur Unterschrift freigegeben. Neue Aufgaben können nicht mehr ergänzt werden.';
  if (error?.code === '22023' && error.message?.startsWith('Aufgabe')) return error.message;
  if (error?.code === 'PGRST202') return 'Die Aufgabenfunktion ist auf dem Server noch nicht freigeschaltet.';
  return 'Die Speicherung konnte nicht bestätigt werden. Ihre Auswahl bleibt erhalten. Bitte erneut versuchen.';
}

export async function addEmployeeOptionalVisitTasks(scope: OptionalTaskScope, drafts: OptionalVisitTaskDraft[]): Promise<OptionalTaskSaveResult> {
  const valid = validateOptionalTaskDrafts(drafts);
  if (!valid.ok) return valid;
  if (getServiceMode() !== 'supabase')
    return { ok: false, error: 'Neue Einsatzaufgaben werden im angemeldeten Mitarbeitendenzugang gespeichert. Im Demozugang wird kein echter Einsatz verändert.' };
  if (!isUuid(scope.tenantId) || !isUuid(scope.employeeId) || !scope.assignmentId)
    return { ok: false, error: 'Die Einsatzzuordnung ist unvollständig. Bitte den Einsatz erneut öffnen.' };
  try {
    const session = await ensurePortalWriteSession(scope.portalSession);
    if (!session.ok) return { ok: false, error: session.error };
    // Materialize recurring occurrences before writing, never add to the series master.
    const executable = await resolveExecutableVisitId(scope.tenantId, scope.assignmentId, 'employee_portal');
    if (!executable.ok) return { ok: false, error: executable.error };
    const resolved = await resolveLiveAssignment({ tenantId: scope.tenantId, rawId: executable.data.visitId, employeeId: scope.employeeId });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    if (!resolved.data || resolved.data.detail.tenantId !== scope.tenantId || resolved.data.employeeId !== scope.employeeId)
      return { ok: false, error: 'Der Einsatz ist Ihnen nicht zugeordnet.' };
    const source = resolved.data.persistenceSource;
    const parentId = source === 'assist_visits' ? resolved.data.visitId : resolved.data.assignmentId;
    if (!isUuid(parentId)) return { ok: false, error: 'Der einzelne Einsatz konnte nicht bestätigt werden.' };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Die Verbindung zum Einsatz ist nicht verfügbar.' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let result: { data: unknown; error: { code?: string; message?: string } | null };
    try {
      result = await client.rpc('employee_add_optional_visit_tasks' as never, {
        p_tenant_id: scope.tenantId, p_source: source, p_parent_id: parentId, p_tasks: valid.data,
      } as never).abortSignal(controller.signal) as unknown as typeof result;
    } finally { clearTimeout(timer); }
    const { data, error } = result;
    if (error) return { ok: false, error: taskWriteError(error) };
    const response = data as { release?: unknown; source?: unknown; parentId?: unknown; inserted?: unknown; tasks?: unknown } | null;
    if (response?.release !== OPTIONAL_VISIT_TASKS_RELEASE || response.source !== source || response.parentId !== parentId
      || !Number.isInteger(response.inserted) || (response.inserted as number) < 0 || (response.inserted as number) > drafts.length
      || !Array.isArray(response.tasks) || response.tasks.length !== drafts.length)
      return { ok: false, error: taskWriteError(null) };
    const tasks: EmployeePortalTaskItem[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < response.tasks.length; i++) {
      const row = response.tasks[i] as Record<string, unknown>;
      if (!row || !isUuid(row.id as string) || seen.has(row.id as string) || typeof row.title !== 'string' || optionalTaskTitleKey(row.title) !== optionalTaskTitleKey(valid.data[i].title)
        || typeof row.required !== 'boolean' || !['open','done','not_requested','not_done','cancelled','partial','not_possible','deferred'].includes(String(row.status)))
        return { ok: false, error: taskWriteError(null) };
      seen.add(row.id as string);
      tasks.push({ id: row.id as string, title: row.title as string, description: '', required: row.required as boolean,
        status: row.status === 'partial' || row.status === 'not_possible' || row.status === 'deferred' ? 'not_done' : row.status as EmployeePortalTaskItem['status'],
        completionNote: typeof row.completionNote === 'string' ? row.completionNote : null, requiresNote: true });
    }
    return { ok: true, inserted: response.inserted as number, tasks };
  } catch {
    return { ok: false, error: taskWriteError(null) };
  }
}

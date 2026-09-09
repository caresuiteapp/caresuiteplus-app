import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import { calculateVisitTimes, type TimeEventLike } from './calculateVisitTimes';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from './resolveAllowedActions';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { ensureVisitTimeEvent } from './saveVisitTimeEvent';
import type { AssistExecutionContext } from './types';
import type { WorkflowDeviationApproval } from './startService';

const pending = () => ({ ok: false as const, errorCode: 'WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED',
  error: 'Der Server hat den Einsatzstart noch nicht eindeutig bestätigt. Der Status wird erneut abgeglichen. Bitte nicht erneut starten.' });

function failure(code: string, message: string) {
  return { ok: false as const, errorCode: code, error: message };
}

/** One RLS-scoped transaction returns the canonical start and its timer events. */
export async function startServiceAtomic(
  ctx: AssistExecutionContext,
  options: WorkflowDeviationApproval,
): Promise<ServiceResult<AssistExecutionContext>> {
  const client = getSupabaseClient();
  if (!client) return failure('START_SERVICE_CONTEXT_MISSING', 'Keine Verbindung zur Einsatzverwaltung. Bitte erneut anmelden.');
  const approved = options.deviationApproved === true && options.deviationPhase === 'start' &&
    options.deviationVisitId === ctx.assistVisitId && (options.deviationJustification?.trim().length ?? 0) >= 10;
  let response;
  try {
    response = await (client as SupabaseClient).rpc('web_start_assist_visit_service', {
      p_tenant_id: ctx.tenantId,
      p_visit_id: ctx.assistVisitId,
      p_employee_id: ctx.employeeId,
      p_started_at: approved && options.deviationActualAt ? options.deviationActualAt : new Date().toISOString(),
      p_justification: approved ? options.deviationJustification?.trim() : null,
    });
  } catch {
    return pending();
  }
  if (response.error) {
    const code = response.error.code ?? '';
    if (code === 'P0S03') return failure('WORKFLOW_DEVIATION_JUSTIFICATION_REQUIRED', response.error.message);
    if (['P0S01', 'P0S02', 'P0S04', 'P0S05'].includes(code)) return failure('START_SERVICE_INVALID_TRANSITION', response.error.message);
    if (code === '42501' || response.status === 401 || response.status === 403) {
      return failure('START_SERVICE_RLS_DENIED', 'Der Einsatzstart wurde nicht freigegeben. Bitte Anmeldung und Einsatzzuordnung prüfen.');
    }
    if (['PGRST202', '42883'].includes(code)) {
      return failure('START_SERVICE_SCHEMA_MISSING', 'Die Startfunktion ist auf dem Server noch nicht verfügbar. Bitte die Verwaltung informieren.');
    }
    if (code === '55P03' || code === '40P01') {
      return failure('START_SERVICE_BUSY', 'Dieser Einsatz wird gerade gleichzeitig aktualisiert. Bitte den Status neu laden und anschließend erneut starten.');
    }
    if (!code || code === '57014' || response.status === 0 || response.status >= 500) return pending();
    const reference = /^[A-Z0-9]{5,12}$/.test(code) ? code : 'UNBEKANNT';
    return failure('START_SERVICE_DB_ERROR', `Der Server hat den Einsatzstart abgewiesen (Fehlercode ${reference}). Bitte der Verwaltung diesen Code mitteilen.`);
  }
  const saved = response.data;
  if (!saved || saved.visitId !== ctx.assistVisitId || saved.employeeId !== ctx.employeeId ||
      saved.status !== 'started' || !saved.eventId || !Number.isFinite(Date.parse(saved.startedAt)) ||
      !Array.isArray(saved.events)) return pending();
  const events: TimeEventLike[] = saved.events.filter((event: unknown): event is TimeEventLike =>
    Boolean(event && typeof event === 'object' && 'eventType' in event && 'occurredAt' in event &&
      typeof event.eventType === 'string' && typeof event.occurredAt === 'string' && Number.isFinite(Date.parse(event.occurredAt))));
  if (!events.some(event => event.eventType === 'service_start' &&
      Date.parse(event.occurredAt) === Date.parse(saved.startedAt))) return pending();
  const visitTimes = calculateVisitTimes(events, 'gestartet');
  const detail = { ...ctx.detail, status: 'gestartet' as const,
    actualStartAt: saved.startedAt, arrivedAt: saved.arrivedAt ?? ctx.detail.arrivedAt };
  const workflow = { derivedStatus: 'gestartet' as const, recordedStatus: 'gestartet' as const,
    consistencyStatus: ctx.consistencyStatus, inconsistencies: ctx.inconsistencies,
    repairOptions: ctx.repairOptions, canStartService: false, nextActionHint: null };
  const confirmed: AssistExecutionContext = { ...ctx, detail, timeEvents: events, visitTimes,
    assignmentStatus: 'gestartet', derivedStatus: 'gestartet',
    diagnostics: resolveAssistExecutionDiagnostics('gestartet', visitTimes, workflow),
    allowedActions: resolveAllowedActions({ assignmentStatus: 'gestartet', derivedStatus: 'gestartet',
      visitTimes, detail, canStartService: false }) };
  scheduleDeferredTask(`assist-service-start-projections:${ctx.tenantId}:${ctx.assistVisitId}`, async () => {
    const state = await upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'gestartet',
      { employeeId: ctx.employeeId, visitTimes });
    // Passing the canonical server events reuses the existing WFM mirror without another INSERT.
    const mirror = await ensureVisitTimeEvent({ tenantId: ctx.tenantId, visitId: ctx.assistVisitId,
      eventType: 'service_start', occurredAt: saved.startedAt, employeeId: ctx.employeeId,
      profileId: ctx.profileId, recordedBy: ctx.profileId }, events);
    if (!state.ok || !mirror.ok) throw new Error('Der Einsatzstart ist gespeichert; eine nachgelagerte Anzeige wird erneut abgeglichen.');
  });
  return { ok: true, data: confirmed };
}

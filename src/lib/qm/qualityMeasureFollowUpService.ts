import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforceQmPermission, QM_CREATE_MEASURE, QM_VIEW } from './qmPermissions';
import { buildQualityMeasureFollowUp, type QualityMeasureEvidence, type QualityMeasureFollowUp, type QualityMeasureFollowUpEventInput, type QualityMeasureFollowUpInput } from './qualityMeasureFollowUpDomain';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
const nullable = (value: unknown) => value == null ? null : String(value);
function live<T>(tenantId: string): ServiceResult<T> | null { const tenant = guardServiceTenant(tenantId); if (tenant) return tenant as ServiceResult<T>; if (getServiceMode() !== 'supabase' || !getSupabaseClient()) return { ok: false, error: 'Qualitätsmaßnahmen-Nachhaltung ist ausschließlich live verfügbar.' }; return null; }

export async function fetchQualityMeasureFollowUps(tenantId: string, roleKey?: RoleKey | null): Promise<ServiceResult<QualityMeasureFollowUp[]>> {
  const denied = enforceQmPermission<QualityMeasureFollowUp[]>(roleKey, QM_VIEW); if (denied) return denied;
  const blocked = live<QualityMeasureFollowUp[]>(tenantId); if (blocked) return blocked;
  const db = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(db, 'qm_quality_measure_follow_ups').select('*').eq('tenant_id', tenantId).order('recorded_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const roots = (data ?? []) as Row[]; if (!roots.length) return { ok: true, data: [] };
  const ids = roots.map(row => text(row.id));
  const [eventResult, evidenceResult] = await Promise.all([
    fromUnknownTable(db, 'qm_quality_measure_follow_up_events').select('*').eq('tenant_id', tenantId).in('follow_up_id', ids).order('sequence_no', { ascending: true }),
    fromUnknownTable(db, 'qm_quality_measure_follow_up_evidence').select('*').eq('tenant_id', tenantId).in('follow_up_id', ids).order('position_no', { ascending: true }),
  ]);
  const childError = eventResult.error ?? evidenceResult.error; if (childError) return { ok: false, error: toGermanSupabaseError(childError) };
  const events = (eventResult.data ?? []) as Row[], evidence = (evidenceResult.data ?? []) as Row[];
  try {
    return { ok: true, data: roots.map(root => buildQualityMeasureFollowUp({
      followUpId: text(root.id), clientRequestId: text(root.client_request_id), tenantId: text(root.tenant_id), sourceDeviationId: text(root.source_deviation_id), sourceDeviationSha256: text(root.source_deviation_sha256), deviationCategory: text(root.deviation_category), deviationSummary: text(root.deviation_summary), deviationRecordedAt: text(root.deviation_recorded_at), recordedAt: text(root.recorded_at), recordedBy: text(root.recorded_by), recordedByName: text(root.recorded_by_name),
      events: events.filter(event => text(event.follow_up_id) === text(root.id)).map((event): QualityMeasureFollowUpEventInput => ({
        eventId: text(event.id), clientRequestId: text(event.client_request_id), kind: text(event.event_kind) as QualityMeasureFollowUpEventInput['kind'], occurredAt: text(event.occurred_at), recordedAt: text(event.recorded_at), actorId: text(event.actor_id), actorName: text(event.actor_name), summary: text(event.summary), referencesEventIds: Array.isArray(event.references_event_ids) ? event.references_event_ids.map(text) : [], actionDescription: nullable(event.action_description), responsibleId: nullable(event.responsible_id), responsibleName: nullable(event.responsible_name), dueAt: nullable(event.due_at), progressNote: nullable(event.progress_note), observedFrom: nullable(event.observed_from), observedUntil: nullable(event.observed_until), effectivenessOutcome: nullable(event.effectiveness_outcome) as QualityMeasureFollowUpEventInput['effectivenessOutcome'], effectivenessResult: nullable(event.effectiveness_result), resultSha256: nullable(event.result_sha256),
        evidence: evidence.filter(item => text(item.event_id) === text(event.id)).map((item): QualityMeasureEvidence => ({ evidenceId: text(item.id), sourceType: text(item.source_type) as QualityMeasureEvidence['sourceType'], sourceEntityId: text(item.source_entity_id), sourceVersionId: nullable(item.source_version_id), recordLocator: text(item.record_locator), sourceSha256: text(item.source_sha256) })),
      })),
    })) };
  } catch (caught) { return { ok: false, error: caught instanceof Error ? caught.message : 'Qualitätsmaßnahmen-Nachhaltung ist widersprüchlich.' }; }
}

export async function recordQualityMeasureFollowUp(tenantId: string, roleKey: RoleKey | null | undefined, input: QualityMeasureFollowUpInput): Promise<ServiceResult<{ id: string }>> {
  const denied = enforceQmPermission<{ id: string }>(roleKey, QM_CREATE_MEASURE); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  if (input.tenantId !== tenantId) return { ok: false, error: 'Mandant der Nachhaltung stimmt nicht mit dem aktiven Mandanten überein.' };
  try { buildQualityMeasureFollowUp(input); } catch (caught) { return { ok: false, error: caught instanceof Error ? caught.message : 'Qualitätsmaßnahmen-Nachhaltung ist unvollständig.' }; }
  const client = getSupabaseClient()! as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }> };
  const { data, error } = await client.rpc('record_qm_quality_measure_follow_up', { p_payload: input, p_client_request_id: input.clientRequestId });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforceQmPermission, QM_CLOSE_MEASURE, QM_VIEW } from './qmPermissions';
import { buildAmbulatoryProfessionalAcceptance, type AmbulatoryProfessionalAcceptance, type AmbulatoryProfessionalAcceptanceInput, type ProfessionalAcceptanceEvidence, type ProfessionalAcceptanceEventInput } from './ambulatoryProfessionalAcceptanceDomain';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
const nullable = (value: unknown) => value == null ? null : String(value);
function live<T>(tenantId: string): ServiceResult<T> | null { const tenant = guardServiceTenant(tenantId); if (tenant) return tenant as ServiceResult<T>; if (getServiceMode() !== 'supabase' || !getSupabaseClient()) return { ok: false, error: 'Pflegefachliche Abnahme ist ausschließlich live verfügbar.' }; return null; }

export async function fetchAmbulatoryProfessionalAcceptances(tenantId: string, roleKey?: RoleKey | null): Promise<ServiceResult<AmbulatoryProfessionalAcceptance[]>> {
  const denied = enforceQmPermission<AmbulatoryProfessionalAcceptance[]>(roleKey, QM_VIEW); if (denied) return denied;
  const blocked = live<AmbulatoryProfessionalAcceptance[]>(tenantId); if (blocked) return blocked;
  const db = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(db, 'qm_ambulatory_professional_acceptances').select('*').eq('tenant_id', tenantId).order('prepared_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const roots = (data ?? []) as Row[]; if (!roots.length) return { ok: true, data: [] };
  const ids = roots.map(row => text(row.id));
  const [eventResult, evidenceResult] = await Promise.all([
    fromUnknownTable(db, 'qm_ambulatory_professional_acceptance_events').select('*').eq('tenant_id', tenantId).in('acceptance_id', ids).order('sequence_no', { ascending: true }),
    fromUnknownTable(db, 'qm_ambulatory_professional_acceptance_evidence').select('*').eq('tenant_id', tenantId).in('acceptance_id', ids).order('position_no', { ascending: true }),
  ]);
  const childError = eventResult.error ?? evidenceResult.error; if (childError) return { ok: false, error: toGermanSupabaseError(childError) };
  const events = (eventResult.data ?? []) as Row[], evidence = (evidenceResult.data ?? []) as Row[];
  try { return { ok: true, data: roots.map(root => buildAmbulatoryProfessionalAcceptance({
    acceptanceId: text(root.id), clientRequestId: text(root.client_request_id), tenantId: text(root.tenant_id), reviewScope: text(root.review_scope), scopeVersionId: text(root.scope_version_id), scopeSha256: text(root.scope_sha256), requiredScenarioIds: Array.isArray(root.required_scenario_ids) ? root.required_scenario_ids.map(text) : [], preparedAt: text(root.prepared_at), preparedBy: text(root.prepared_by), preparedByName: text(root.prepared_by_name),
    events: events.filter(event => text(event.acceptance_id) === text(root.id)).map((event): ProfessionalAcceptanceEventInput => ({
      eventId: text(event.id), clientRequestId: text(event.client_request_id), kind: text(event.event_kind) as ProfessionalAcceptanceEventInput['kind'], occurredAt: text(event.occurred_at), recordedAt: text(event.recorded_at), actorId: text(event.actor_id), actorName: text(event.actor_name), summary: text(event.summary), referencesEventIds: Array.isArray(event.references_event_ids) ? event.references_event_ids.map(text) : [], scenarioId: nullable(event.scenario_id), scenarioTitle: nullable(event.scenario_title), scenarioResult: nullable(event.scenario_result) as ProfessionalAcceptanceEventInput['scenarioResult'], reviewerId: nullable(event.reviewer_id), reviewerName: nullable(event.reviewer_name), reviewerQualification: nullable(event.reviewer_qualification), restrictionId: nullable(event.restriction_id), restrictionText: nullable(event.restriction_text), restrictionOwnerId: nullable(event.restriction_owner_id), restrictionOwnerName: nullable(event.restriction_owner_name), restrictionReviewDueAt: nullable(event.restriction_review_due_at), decision: nullable(event.decision) as ProfessionalAcceptanceEventInput['decision'], decisionReason: nullable(event.decision_reason), decisionSha256: nullable(event.decision_sha256),
      evidence: evidence.filter(item => text(item.event_id) === text(event.id)).map((item): ProfessionalAcceptanceEvidence => ({ evidenceId: text(item.id), sourceType: text(item.source_type) as ProfessionalAcceptanceEvidence['sourceType'], sourceEntityId: text(item.source_entity_id), sourceVersionId: nullable(item.source_version_id), recordLocator: text(item.record_locator), sourceSha256: text(item.source_sha256) })),
    })),
  })) }; } catch (caught) { return { ok: false, error: caught instanceof Error ? caught.message : 'Pflegefachliche Abnahmeakte ist widersprüchlich.' }; }
}

export async function recordAmbulatoryProfessionalAcceptance(tenantId: string, roleKey: RoleKey | null | undefined, input: AmbulatoryProfessionalAcceptanceInput): Promise<ServiceResult<{ id: string }>> {
  const denied = enforceQmPermission<{ id: string }>(roleKey, QM_CLOSE_MEASURE); if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId); if (blocked) return blocked;
  if (input.tenantId !== tenantId) return { ok: false, error: 'Mandant der Abnahmeakte stimmt nicht mit dem aktiven Mandanten überein.' };
  try { buildAmbulatoryProfessionalAcceptance(input); } catch (caught) { return { ok: false, error: caught instanceof Error ? caught.message : 'Pflegefachliche Abnahmeakte ist unvollständig.' }; }
  const client = getSupabaseClient()! as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }> };
  const { data, error } = await client.rpc('record_qm_ambulatory_professional_acceptance', { p_payload: input, p_client_request_id: input.clientRequestId });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

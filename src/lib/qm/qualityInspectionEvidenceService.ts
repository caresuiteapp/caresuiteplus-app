import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforceQmPermission, QM_CREATE_AUDIT, QM_VIEW } from './qmPermissions';
import {
  buildQualityInspectionEvidenceSet,
  type QualityInspectionEvidenceSet,
  type QualityInspectionEvidenceSetInput,
  type QualityInspectionEvidenceReference,
  type QualityInspectionGap,
  type QualityInspectionRequirementInput,
} from './qualityInspectionEvidenceDomain';

type Row = Record<string, unknown>;
const text = (value: unknown): string => value == null ? '' : String(value);
const nullableText = (value: unknown): string | null => value == null ? null : String(value);

function live<T>(tenantId: string): ServiceResult<T> | null {
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant as ServiceResult<T>;
  if (getServiceMode() !== 'supabase' || !getSupabaseClient()) return { ok: false, error: 'Qualitätsprüfungsnachweise sind ausschließlich live verfügbar.' };
  return null;
}

export async function fetchQualityInspectionEvidenceSets(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  auditId?: string,
): Promise<ServiceResult<QualityInspectionEvidenceSet[]>> {
  const denied = enforceQmPermission<QualityInspectionEvidenceSet[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const blocked = live<QualityInspectionEvidenceSet[]>(tenantId);
  if (blocked) return blocked;
  const supabase = getSupabaseClient()!;
  let setQuery = fromUnknownTable(supabase, 'qm_quality_inspection_evidence_sets').select('*').eq('tenant_id', tenantId);
  if (auditId) setQuery = setQuery.eq('audit_id', auditId);
  const { data: setData, error: setError } = await setQuery.order('recorded_at', { ascending: false });
  if (setError) return { ok: false, error: toGermanSupabaseError(setError) };
  const sets = (setData ?? []) as Row[];
  if (!sets.length) return { ok: true, data: [] };
  const setIds = sets.map((row) => text(row.id));
  const { data: requirementData, error: requirementError } = await fromUnknownTable(supabase, 'qm_quality_inspection_requirements')
    .select('*').eq('tenant_id', tenantId).in('evidence_set_id', setIds).order('sort_order', { ascending: true });
  if (requirementError) return { ok: false, error: toGermanSupabaseError(requirementError) };
  const requirementRows = (requirementData ?? []) as Row[];
  const mappingIds = requirementRows.map((row) => text(row.id));
  const [evidenceResult, gapResult] = mappingIds.length ? await Promise.all([
    fromUnknownTable(supabase, 'qm_quality_inspection_evidence_refs').select('*').eq('tenant_id', tenantId).in('requirement_mapping_id', mappingIds).order('position_no', { ascending: true }),
    fromUnknownTable(supabase, 'qm_quality_inspection_gaps').select('*').eq('tenant_id', tenantId).in('requirement_mapping_id', mappingIds).order('position_no', { ascending: true }),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const childError = evidenceResult.error ?? gapResult.error;
  if (childError) return { ok: false, error: toGermanSupabaseError(childError) };
  const evidenceRows = (evidenceResult.data ?? []) as Row[];
  const gapRows = (gapResult.data ?? []) as Row[];

  try {
    const result = sets.map((setRow) => {
      const requirements = requirementRows.filter((row) => text(row.evidence_set_id) === text(setRow.id)).map((row): QualityInspectionRequirementInput => ({
        requirementMappingId: text(row.id),
        requirementCode: text(row.requirement_code),
        requirementTitle: text(row.requirement_title),
        inspectionLevel: text(row.inspection_level) as QualityInspectionRequirementInput['inspectionLevel'],
        clientId: nullableText(row.client_id),
        evidence: evidenceRows.filter((entry) => text(entry.requirement_mapping_id) === text(row.id)).map((entry): QualityInspectionEvidenceReference => ({
          evidenceRefId: text(entry.id), sourceType: text(entry.source_type) as QualityInspectionEvidenceReference['sourceType'],
          sourceEntityId: text(entry.source_entity_id), sourceVersionId: nullableText(entry.source_version_id), clientId: nullableText(entry.client_id),
          recordLocator: text(entry.record_locator), sourceSha256: text(entry.source_sha256), documentedAt: text(entry.documented_at), capturedAt: text(entry.captured_at),
        })),
        gaps: gapRows.filter((entry) => text(entry.requirement_mapping_id) === text(row.id)).map((entry): QualityInspectionGap => ({
          gapId: text(entry.id), description: text(entry.description), severity: text(entry.severity) as QualityInspectionGap['severity'],
          identifiedAt: text(entry.identified_at), responsibleRole: text(entry.responsible_role), dueAt: nullableText(entry.due_at),
        })),
      }));
      const model = buildQualityInspectionEvidenceSet({
        evidenceSetId: text(setRow.id), clientRequestId: text(setRow.client_request_id), tenantId: text(setRow.tenant_id), auditId: text(setRow.audit_id),
        qprProfileCode: text(setRow.qpr_profile_code), qprVersionDate: text(setRow.qpr_version_date), qprEffectiveFrom: text(setRow.qpr_effective_from),
        qprSourceUrl: text(setRow.qpr_source_url), qprSourceSha256: text(setRow.qpr_source_sha256), recordedBy: text(setRow.recorded_by),
        recordedByName: text(setRow.recorded_by_name), recordedAt: text(setRow.recorded_at), requirements,
      });
      for (const requirement of model.requirements) {
        const stored = requirementRows.find((row) => text(row.id) === requirement.requirementMappingId);
        if (text(stored?.mapping_state) !== requirement.mappingState) throw new Error('Gespeicherter Prüfzuordnungsstatus widerspricht den Originalreferenzen und Lücken.');
      }
      return model;
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Qualitätsprüfungsnachweis ist widersprüchlich.' };
  }
}

export async function recordQualityInspectionEvidenceSet(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  input: QualityInspectionEvidenceSetInput,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforceQmPermission<{ id: string }>(actorRoleKey, QM_CREATE_AUDIT);
  if (denied) return denied;
  const blocked = live<{ id: string }>(tenantId);
  if (blocked) return blocked;
  if (input.tenantId !== tenantId) return { ok: false, error: 'Mandant des Nachweissatzes stimmt nicht mit dem aktiven Mandanten überein.' };
  try { buildQualityInspectionEvidenceSet(input); } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Qualitätsprüfungsnachweis ist unvollständig.' };
  }
  const client = getSupabaseClient()! as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }> };
  const { data, error } = await client.rpc('record_qm_quality_inspection_evidence_set', {
    p_audit_id: input.auditId, p_payload: input, p_client_request_id: input.clientRequestId,
  });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: text(data.id) } };
}

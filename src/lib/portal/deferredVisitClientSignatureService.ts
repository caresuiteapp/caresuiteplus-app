/**
 * Deferred client signature — employee portal finalizes without on-device signature;
 * signature request is released to Klient:innenportal for later signing.
 */
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { buildServiceRecordSnapshot } from '@/features/assistWorkflow/buildServiceRecordHtml';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import type { VisitDispositionDetail, VisitTaskStatus } from '@/lib/assist/visitTypes';
import type { CanonicalAssignmentStatus, ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import {
  computeVisitProofPayloadHash,
  fetchLatestVisitProof,
  persistVisitProof,
  updateVisitProofRow,
} from '@/lib/assist/assistVisitProofPersistenceService';
import { invalidatePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { resolvePortalSignatureVisitId } from './resolveEmployeePortalSignatureRequirement';

export type DeferredClientSignatureReleaseResult = {
  proofId: string;
  clientDocumentId: string | null;
};

const ADMIN_CANONICAL_STATUS: Record<VisitDispositionDetail['assignmentStatus'], CanonicalAssignmentStatus> = {
  geplant: 'planned',
  bestaetigt: 'confirmed',
  unterwegs: 'on_the_way',
  angekommen: 'arrived',
  gestartet: 'started',
  pausiert: 'paused',
  beendet: 'finished',
  dokumentation_offen: 'documentation_pending',
  unterschrift_offen: 'signature_pending',
  abgeschlossen: 'completed',
  storniert: 'cancelled',
  nicht_erschienen: 'no_show',
};

function administrativeTaskStatus(status: VisitTaskStatus): ExtendedAssignmentTaskStatus {
  if (status === 'done' || status === 'open') return status;
  if (status === 'not_requested') return 'not_wanted';
  if (status === 'not_possible') return 'not_possible';
  if (status === 'cancelled') return 'skipped';
  return 'requires_follow_up';
}

/** Build the same canonical deferred-signature proof from the Office follow-up view. */
export async function releaseAdministrativeDeferredClientSignatureRequest(
  tenantId: string,
  visit: VisitDispositionDetail,
  actorProfileId: string | null = null,
): Promise<ServiceResult<DeferredClientSignatureReleaseResult>> {
  const documentationText = visit.documentationNotes?.trim() || '';
  if (!documentationText) {
    return { ok: false, error: 'Dokumentation ist vor der Signaturanforderung erforderlich.' };
  }

  const serviceSeconds =
    visit.actualStartAt && visit.actualEndAt
      ? Math.max(0, Math.round((Date.parse(visit.actualEndAt) - Date.parse(visit.actualStartAt)) / 1000))
      : null;
  const detail: AssistExecutionContext['detail'] = {
    assignmentId: visit.id,
    tenantId,
    title: visit.serviceName ?? visit.title,
    clientId: visit.clientId,
    clientName: visit.clientName,
    locationAddress: visit.addressSnapshot ?? visit.location,
    plannedStartAt: visit.scheduledStart,
    plannedEndAt: visit.scheduledEnd,
    actualStartAt: visit.actualStartAt,
    actualEndAt: visit.actualEndAt,
    onTheWayAt: visit.onTheWayAt,
    arrivedAt: visit.arrivedAt,
    status: visit.assignmentStatus,
    canonicalStatus: ADMIN_CANONICAL_STATUS[visit.assignmentStatus],
    notesForEmployee: visit.employeeNotes ?? '',
    accessHints: null,
    emergencyContact: null,
    tasks: visit.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: '',
      required: task.isRequired,
      status: administrativeTaskStatus(task.status),
      completionNote: task.notDoneReason,
      requiresNote: task.status !== 'done' && task.status !== 'open',
    })),
    statusHistory: [],
    pauseEvents: [],
    documentationStatus: 'submitted',
    documentationNotes: documentationText,
    signatureStatus: 'pending',
    requiresSignature: true,
    requiresDocumentation: true,
    requiresRoute: false,
    canStartExecution: false,
    canOpenRoute: false,
    canCaptureGps: false,
    allowedTransitions: visit.allowedStatusTransitions,
    isLocked: false,
    enabledModules: [],
  };
  const visitTimes: AssistExecutionContext['visitTimes'] = {
    driveSeconds: null,
    serviceSeconds,
    pauseSeconds: null,
    totalSeconds: serviceSeconds,
    driveStartedAt: visit.onTheWayAt,
    arrivedAt: visit.arrivedAt,
    serviceStartedAt: visit.actualStartAt,
    pauseStartedAt: null,
    serviceEndedAt: visit.actualEndAt,
    activeTimer: null,
  };
  return releaseDeferredClientSignatureRequest({
    tenantId,
    assignmentId: visit.id,
    employeeId: visit.employeeId ?? '',
    profileId: actorProfileId,
    roleKey: 'admin',
    assistVisitId: visit.id,
    assignmentStatus: visit.assignmentStatus,
    derivedStatus: visit.assignmentStatus,
    consistencyStatus: 'consistent',
    inconsistencies: [],
    repairOptions: [],
    detail,
    liveContext: null,
    visitTimes,
    timeEvents: [],
    allowedActions: [],
    diagnostics: {
      isServiceStarted: Boolean(visit.actualStartAt),
      isServiceEnded: Boolean(visit.actualEndAt),
      isTravelEnded: Boolean(visit.arrivedAt),
      canEndService: false,
      inconsistentStatus: false,
      repairHint: null,
    },
  }, documentationText);
}

/** True when visit has a portal-visible proof awaiting client signature. */
export async function hasPortalDeferredClientSignature(
  tenantId: string,
  assignmentId: string,
  employeeId?: string | null,
): Promise<boolean> {
  if (getServiceMode() !== 'supabase') return false;

  const visitId = await resolvePortalSignatureVisitId(tenantId, assignmentId, employeeId);
  if (!visitId) return false;

  const proof = await fetchLatestVisitProof(tenantId, visitId);
  if (!proof.ok || !proof.data) return false;

  return (
    proof.data.portalVisible === true &&
    proof.data.portalReleaseStatus === 'pending_client_signature' &&
    !proof.data.signatureId
  );
}

async function upsertDeferredSignatureClientPortalDocument(
  tenantId: string,
  proof: AssistVisitProofRow,
  clientId: string,
  options?: { actorProfileId?: string | null },
): Promise<ServiceResult<{ clientDocumentId: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const snapshot = proof.payloadSnapshot ?? {};
  const title =
    String(snapshot.title ?? snapshot.serviceName ?? 'Leistungsnachweis').trim() ||
    'Leistungsnachweis';

  const { data, error } = await (supabase.rpc(
    'employee_portal_upsert_deferred_signature_client_document' as never,
    {
      p_tenant_id: tenantId,
      p_proof_id: proof.id,
      p_client_id: clientId,
      p_title: title,
      p_actor_profile_id: options?.actorProfileId ?? null,
    } as never,
  ) as unknown as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>);

  if (error) {
    return { ok: false, error: error.message };
  }

  const clientDocumentId = typeof data === 'string' ? data : proof.id;
  return { ok: true, data: { clientDocumentId } };
}

/**
 * Create or update a draft proof and release a signature request to the client portal.
 * No PDF / Leistungsnachweis is generated — that happens after the client signs (Phase 2+).
 */
export async function releaseDeferredClientSignatureRequest(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
): Promise<ServiceResult<DeferredClientSignatureReleaseResult>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { proofId: 'demo-proof', clientDocumentId: null } };
  }

  const visitId = await resolvePortalSignatureVisitId(
    ctx.tenantId,
    ctx.assignmentId,
    ctx.employeeId,
  );
  if (!visitId) {
    return { ok: false, error: 'Einsatzbesuch konnte nicht zugeordnet werden.' };
  }

  const docText =
    documentationText?.trim() ||
    ctx.detail.documentationNotes?.trim() ||
    '';
  if (!docText) {
    return { ok: false, error: 'Dokumentation ist vor der Signaturanforderung erforderlich.' };
  }

  const snapshot = {
    ...buildServiceRecordSnapshot({
      detail: ctx.detail,
      visitTimes: ctx.visitTimes,
      documentationText: docText,
      visitId,
      employeeId: ctx.employeeId,
      serviceName: ctx.detail.title,
    }),
    signatureDeferredToClientPortal: true,
    signatureDeferredAt: new Date().toISOString(),
    signatureDeferredBy: ctx.profileId ?? ctx.employeeId ?? null,
  };

  let proofId: string;
  const existing = await fetchLatestVisitProof(ctx.tenantId, visitId);
  if (existing.ok && existing.data) {
    proofId = existing.data.id;
    const payloadHash = await computeVisitProofPayloadHash(snapshot);
    const updated = await updateVisitProofRow(ctx.tenantId, proofId, {
      payload_snapshot: snapshot,
      payload_hash: payloadHash,
      signature_id: null,
    });
    if (!updated.ok) {
      return { ok: false, error: updated.error ?? 'Unterschriftsanfrage konnte nicht gespeichert werden.' };
    }
  } else {
    const created = await persistVisitProof(
      ctx.tenantId,
      {
        visitId,
        payloadSnapshot: snapshot,
        status: 'draft',
      },
      ctx.profileId ?? ctx.employeeId ?? null,
    );
    if (!created.ok) return { ok: false, error: created.error };
    if (!created.data) return { ok: false, error: 'Unterschriftsanfrage konnte nicht angelegt werden.' };
    proofId = created.data.id;
  }

  const now = new Date().toISOString();
  const released = await updateVisitProofRow(ctx.tenantId, proofId, {
    portal_visible: true,
    portal_release_status: 'pending_client_signature',
    released_to_portal_at: now,
    updated_by: ctx.profileId ?? null,
  });
  if (!released.ok) return { ok: false, error: released.error };
  if (!released.data) return { ok: false, error: 'Portal-Freigabe fehlgeschlagen.' };

  const clientId = ctx.detail.clientId;
  if (!clientId) {
    return { ok: false, error: 'Klient:in konnte dem Einsatz nicht zugeordnet werden.' };
  }

  const documentSync = await upsertDeferredSignatureClientPortalDocument(
    ctx.tenantId,
    released.data,
    clientId,
    { actorProfileId: ctx.profileId ?? null },
  );
  if (!documentSync.ok) {
    return { ok: false, error: documentSync.error ?? 'Klient:innenportal-Eintrag fehlgeschlagen.' };
  }

  invalidatePortalProofCache();

  return {
    ok: true,
    data: {
      proofId,
      clientDocumentId: documentSync.data.clientDocumentId,
    },
  };
}

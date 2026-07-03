/**
 * ASSIST.WORKFLOW.1 — Generate service record + Leistungsnachweis proof.
 */
import type { ServiceResult } from '@/types';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { persistEmployeePortalVisitProof } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { resolveVisitSignatureImageUrl } from '@/lib/assist/visitSignatureImageService';
import { buildServiceRecordHtml, buildServiceRecordSnapshot } from './buildServiceRecordHtml';
import type { AssistExecutionContext } from './types';

export type GenerateServiceRecordResult = {
  serviceRecordId: string | null;
  proofPersisted: boolean;
  html: string;
};

export async function generateServiceRecord(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
): Promise<ServiceResult<GenerateServiceRecordResult>> {
  let signatureSummary: { signerName: string; signedAt: string; signerRole?: string | null } | null =
    null;
  let signatureImageUrl: string | null = null;
  const sig = await fetchValidVisitSignature(ctx.tenantId, ctx.assistVisitId);
  if (sig.ok && sig.data) {
    signatureSummary = {
      signerName: sig.data.signerName,
      signedAt: sig.data.signedAt,
      signerRole: sig.data.signerRole,
    };
    signatureImageUrl = await resolveVisitSignatureImageUrl(sig.data.storagePath);
  }

  const html = buildServiceRecordHtml({
    detail: ctx.detail,
    visitTimes: ctx.visitTimes,
    documentationText,
    signatureSummary,
    signatureImageUrl,
    visitId: ctx.assistVisitId,
    employeeId: ctx.employeeId,
    serviceName: ctx.detail.title,
  });

  const snapshot = buildServiceRecordSnapshot({
    detail: ctx.detail,
    visitTimes: ctx.visitTimes,
    documentationText,
    signatureSummary,
    visitId: ctx.assistVisitId,
    employeeId: ctx.employeeId,
    serviceName: ctx.detail.title,
  });

  const proof = await persistEmployeePortalVisitProof(
    {
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      locationAddress: ctx.detail.locationAddress,
    },
    snapshot,
    sig.ok && sig.data ? sig.data.id : null,
  );

  if (!proof.ok) {
    return { ok: false, error: proof.error ?? 'Leistungsnachweis konnte nicht gespeichert werden.' };
  }

  const record = await assignmentSupabaseRepository.prepareServiceRecord(
    ctx.tenantId,
    ctx.assignmentId,
    {
      actorProfileId: ctx.profileId ?? ctx.employeeId,
      actorEmployeeId: ctx.employeeId,
    },
  );

  if (!record.ok) {
    return { ok: false, error: record.error ?? 'Leistungsnachweis konnte nicht vorbereitet werden.' };
  }

  return {
    ok: true,
    data: {
      serviceRecordId: record.data?.id ?? null,
      proofPersisted: true,
      html,
    },
  };
}

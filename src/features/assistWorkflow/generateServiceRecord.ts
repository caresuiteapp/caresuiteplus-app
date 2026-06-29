/**
 * ASSIST.WORKFLOW.1 — Generate service record + Leistungsnachweis proof.
 */
import type { ServiceResult } from '@/types';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { persistEmployeePortalVisitProof } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
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
  let signatureSummary: { signerName: string; signedAt: string } | null = null;
  const sig = await fetchValidVisitSignature(ctx.tenantId, ctx.assistVisitId);
  if (sig.ok && sig.data) {
    signatureSummary = {
      signerName: sig.data.signerName,
      signedAt: sig.data.signedAt,
    };
  }

  const html = buildServiceRecordHtml({
    detail: ctx.detail,
    visitTimes: ctx.visitTimes,
    documentationText,
    signatureSummary,
  });

  const snapshot = buildServiceRecordSnapshot({
    detail: ctx.detail,
    visitTimes: ctx.visitTimes,
    documentationText,
    signatureSummary,
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

  const record = await assignmentSupabaseRepository.prepareServiceRecord(
    ctx.tenantId,
    ctx.assignmentId,
    {
      actorProfileId: ctx.profileId ?? ctx.employeeId,
      actorEmployeeId: ctx.employeeId,
    },
  );

  return {
    ok: true,
    data: {
      serviceRecordId: record.ok && record.data ? record.data.id : null,
      proofPersisted: proof.ok,
      html,
    },
  };
}

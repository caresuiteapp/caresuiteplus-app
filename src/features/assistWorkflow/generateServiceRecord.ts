/**
 * ASSIST.WORKFLOW.1 — Generate service record + Leistungsnachweis proof.
 */
import type { ServiceResult } from '@/types';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { persistEmployeePortalVisitProof } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { resolveVisitSignatureImageUrl } from '@/lib/assist/visitSignatureImageService';
import { probeSignatureImageDimensions } from '@/lib/signatures/signatureOrientation';
import { buildServiceRecordHtml, buildServiceRecordSnapshot } from './buildServiceRecordHtml';
import type { AssistExecutionContext } from './types';
import { signatureMatchesVisitContent } from './signatureMatchesVisitContent';

export type GenerateServiceRecordResult = {
  serviceRecordId: string | null;
  proofPersisted: boolean;
  html: string;
};

export async function generateServiceRecord(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
  options: { requireSignature?: boolean } = {},
): Promise<ServiceResult<GenerateServiceRecordResult>> {
  let signatureSummary: { signerName: string; signedAt: string; signerRole?: string | null } | null =
    null;
  let signatureImageUrl: string | null = null;
  const sig = await fetchValidVisitSignature(ctx.tenantId, ctx.assistVisitId);
  if (!sig.ok) return { ok: false, error: sig.error ?? 'Die gespeicherte Unterschrift konnte nicht geprüft werden. Bitte erneut versuchen.' };
  if (options.requireSignature && !sig.data) {
    return { ok: false, error: 'Die Unterschrift für diese Einsatzfassung fehlt. Bitte erneut unterschreiben, bevor der Leistungsnachweis abgeschlossen wird.' };
  }
  if (sig.ok && sig.data) {
    if (!await signatureMatchesVisitContent(ctx, sig.data, documentationText)) {
      return { ok: false, error: 'Die gespeicherte Unterschrift gehört zu einer früheren Einsatzfassung. Bitte die aktuelle Dokumentation und Aufgaben prüfen und erneut unterschreiben.' };
    }
    signatureSummary = {
      signerName: sig.data.signerName,
      signedAt: sig.data.signedAt,
      signerRole: sig.data.signerRole,
    };
    signatureImageUrl = await resolveVisitSignatureImageUrl(sig.data.storagePath);
  }

  let signatureImageWidth: number | null = null;
  let signatureImageHeight: number | null = null;
  if (signatureImageUrl) {
    const dimensions = await probeSignatureImageDimensions(signatureImageUrl);
    if (dimensions) {
      signatureImageWidth = dimensions.width;
      signatureImageHeight = dimensions.height;
    }
  }

  const html = buildServiceRecordHtml({
    detail: ctx.detail,
    visitTimes: ctx.visitTimes,
    documentationText,
    signatureSummary,
    signatureImageUrl,
    signatureImageWidth,
    signatureImageHeight,
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

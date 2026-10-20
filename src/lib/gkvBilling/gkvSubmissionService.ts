import type { ServiceResult } from '@/types';
import type { GkvExportBatch, GkvSubmissionRecord } from '@/types/gkvBilling';
import {
  appendGkvBillingAudit,
  listGkvExportBatches,
  readGkvBillingProfile,
  saveGkvSubmissionRecord,
  updateGkvExportBatch,
} from './gkvBillingStore';
import { assertDtaNotProductionBillable, assertSubmissionNotEnabled } from './gkvProductionGuard';

export type PrepareGkvSubmissionInput = {
  tenantId: string;
  batchId: string;
  providerKey?: string | null;
};

export function prepareGkvSubmission(input: PrepareGkvSubmissionInput): ServiceResult<GkvSubmissionRecord> {
  const batch = listGkvExportBatches(input.tenantId).find((e) => e.id === input.batchId);
  if (!batch) {
    return { ok: false, error: 'Export-Batch nicht gefunden.' };
  }

  const profile = readGkvBillingProfile(input.tenantId);
  const now = new Date().toISOString();
  let status: GkvSubmissionRecord['status'] = 'prepared';
  let blockedReason: string | null = null;

  if (!input.providerKey) {
    status = 'blocked_no_provider';
    blockedReason = 'Einreichung blockiert — kein konfigurierter Abrechnungsanbieter.';
  } else if (!profile?.dtaValidatorConfigured) {
    status = 'blocked_no_validator';
    blockedReason = 'Einreichung blockiert — DTA-Validator nicht konfiguriert.';
  } else if (!batch.dtaValidated) {
    const dtaGuard = assertDtaNotProductionBillable(batch.dtaValidated);
    if (!dtaGuard.allowed) {
      status = 'blocked_no_validator';
      blockedReason = dtaGuard.reason;
    }
  }

  const submissionGuard = assertSubmissionNotEnabled();
  if (submissionGuard.allowed === false) {
    status = 'blocked_not_enabled';
    blockedReason = submissionGuard.reason;
  }

  const record: GkvSubmissionRecord = {
    id: `gkv-sub-${Date.now()}`,
    tenantId: input.tenantId,
    batchId: input.batchId,
    status,
    providerKey: input.providerKey ?? null,
    submittedAt: null,
    blockedReason,
    notes: 'Einreichung nur vorbereitet — kein produktiver Versand.',
    createdAt: now,
    updatedAt: now,
  };

  saveGkvSubmissionRecord(input.tenantId, record);

  const updatedBatch: GkvExportBatch = {
    ...batch,
    status: status === 'prepared' ? 'submitted_prepared' : batch.status,
    updatedAt: now,
  };
  updateGkvExportBatch(input.tenantId, updatedBatch);

  appendGkvBillingAudit({
    id: `gkv-audit-sub-${record.id}`,
    tenantId: input.tenantId,
    action: 'gkv.submission_prepared',
    entityType: 'gkv_submission_records',
    entityId: record.id,
    summary: blockedReason ?? 'Einreichung vorbereitet (nicht produktiv).',
    createdAt: now,
  });

  return { ok: true, data: record };
}

export function markGkvSubmissionAsSubmitted(
  tenantId: string,
  batchId: string,
): ServiceResult<GkvSubmissionRecord> {
  const profile = readGkvBillingProfile(tenantId);
  if (!profile?.dtaValidatorConfigured) {
    return {
      ok: false,
      error: 'Einreichung blockiert — DTA-Validator nicht konfiguriert.',
    };
  }

  const batch = listGkvExportBatches(tenantId).find((e) => e.id === batchId);
  if (!batch) {
    return { ok: false, error: 'Export-Batch nicht gefunden.' };
  }

  const dtaGuard = assertDtaNotProductionBillable(batch.dtaValidated);
  if (!dtaGuard.allowed) {
    return { ok: false, error: dtaGuard.reason };
  }

  return { ok: false, error: 'Produktive Einreichung ist derzeit nicht freigeschaltet.' };
}

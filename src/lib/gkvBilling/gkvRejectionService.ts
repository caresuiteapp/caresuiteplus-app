import type { ServiceResult } from '@/types';
import type { GkvRejectionCase } from '@/types/gkvBilling';
import { appendGkvBillingAudit, listGkvRejectionCases, saveGkvRejectionCase } from './gkvBillingStore';

export type CreateGkvRejectionCaseInput = {
  tenantId: string;
  exportBatchId?: string | null;
  exportItemId?: string | null;
  caseType: GkvRejectionCase['caseType'];
  reasonCode?: string | null;
  reasonText: string;
};

export function createGkvRejectionCase(input: CreateGkvRejectionCaseInput): ServiceResult<GkvRejectionCase> {
  const now = new Date().toISOString();
  const rejectionCase: GkvRejectionCase = {
    id: `gkv-rej-${Date.now()}`,
    tenantId: input.tenantId,
    exportBatchId: input.exportBatchId ?? null,
    exportItemId: input.exportItemId ?? null,
    caseType: input.caseType,
    status: 'open',
    reasonCode: input.reasonCode ?? null,
    reasonText: input.reasonText,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  saveGkvRejectionCase(input.tenantId, rejectionCase);
  appendGkvBillingAudit({
    id: `gkv-audit-rej-${rejectionCase.id}`,
    tenantId: input.tenantId,
    action: 'gkv.rejection_case_created',
    entityType: 'gkv_rejection_cases',
    entityId: rejectionCase.id,
    summary: `Rückläufer/Absetzung vorbereitet: ${input.caseType}`,
    createdAt: now,
  });

  return { ok: true, data: rejectionCase };
}

export function getGkvRejectionCases(tenantId: string): GkvRejectionCase[] {
  return listGkvRejectionCases(tenantId);
}

export function resolveGkvRejectionCase(
  tenantId: string,
  caseId: string,
): ServiceResult<GkvRejectionCase> {
  const existing = listGkvRejectionCases(tenantId).find((e) => e.id === caseId);
  if (!existing) {
    return { ok: false, error: 'Rückläufer-Fall nicht gefunden.' };
  }

  const now = new Date().toISOString();
  const updated: GkvRejectionCase = {
    ...existing,
    status: 'resolved',
    resolvedAt: now,
    updatedAt: now,
  };

  saveGkvRejectionCase(tenantId, updated);
  appendGkvBillingAudit({
    id: `gkv-audit-rej-res-${caseId}`,
    tenantId,
    action: 'gkv.rejection_case_resolved',
    entityType: 'gkv_rejection_cases',
    entityId: caseId,
    summary: 'Rückläufer-Fall als erledigt markiert.',
    createdAt: now,
  });

  return { ok: true, data: updated };
}

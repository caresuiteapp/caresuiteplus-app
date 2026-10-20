import type {
  ClassificationConfidence,
  DocumentInboxExecutionContext,
  DocumentInboxGuardCode,
  DocumentInboxGuardResult,
  DocumentInboxItem,
  DocumentInboxStatus,
} from '@/types/documents/documentInbox';
import {
  assertHealthDataOcrAllowed,
  assertTenantScope,
  validateOcrProviderReady,
} from '@/lib/documents/connectDocumentGuard';
import type { DocumentExecutionContext } from '@/types/documents/connect';

function deny(code: DocumentInboxGuardCode, message: string): DocumentInboxGuardResult {
  return { allowed: false, code, message };
}

export function assertInboxTenantScope(
  tenantId: string | null | undefined,
  resourceTenantId?: string | null,
): DocumentInboxGuardResult {
  const result = assertTenantScope(tenantId ?? null, resourceTenantId);
  if (!result.allowed) {
    return deny(
      result.code === 'tenant_mismatch' ? 'tenant_mismatch' : 'missing_tenant',
      result.message,
    );
  }
  return { allowed: true };
}

export function assertInboxItemMutable(item: DocumentInboxItem): DocumentInboxGuardResult {
  if (item.status === 'archived') {
    return deny('item_archived', 'Archiviertes Dokument kann nicht mehr bearbeitet werden.');
  }
  if (item.status === 'deleted') {
    return deny('item_deleted', 'Gelöschtes Dokument ist nicht mehr verfügbar.');
  }
  return { allowed: true };
}

export function toConnectOcrContext(
  ctx: DocumentInboxExecutionContext,
  item: DocumentInboxItem,
): DocumentExecutionContext {
  return {
    tenantId: ctx.tenantId,
    documentTenantId: item.tenantId,
    signatureProviderKey: null,
    ocrProviderKey: ctx.ocrProviderKey,
    signatureProviderActive: false,
    ocrProviderActive: ctx.ocrProviderActive,
    ocrExternalApproved: ctx.ocrExternalApproved,
    healthDataOcrApproved: ctx.healthDataOcrApproved,
    hasCredentialReference: false,
    containsHealthData: item.containsHealthData,
    isArchived: item.status === 'archived',
    isMockProvider: ctx.demoMode,
    demoMode: ctx.demoMode,
    environment: ctx.environment,
    gobdProtectionActive: false,
  };
}

export function validateInboxOcrReady(
  ctx: DocumentInboxExecutionContext,
  item: DocumentInboxItem,
): DocumentInboxGuardResult {
  const tenantCheck = assertInboxTenantScope(ctx.tenantId, item.tenantId);
  if (!tenantCheck.allowed) return tenantCheck;

  const mutable = assertInboxItemMutable(item);
  if (!mutable.allowed) return mutable;

  const ocrContext = toConnectOcrContext(ctx, item);
  const ready = validateOcrProviderReady(ocrContext);
  if (!ready.allowed) {
    return deny(
      ready.code === 'ocr_approval_required' ? 'ocr_approval_required' : 'ocr_blocked',
      ready.message,
    );
  }

  if (item.containsHealthData) {
    const health = assertHealthDataOcrAllowed(ocrContext);
    if (!health.allowed) {
      return deny('health_data_ocr_denied', health.message);
    }
  }

  return { allowed: true };
}

export function shouldRequireReviewForClassification(input: {
  confidence: ClassificationConfidence;
  suggestedEntityId: string | null;
}): boolean {
  if (!input.suggestedEntityId) return true;
  return input.confidence === 'low' || input.confidence === 'unknown';
}

export function resolveStatusAfterClassification(input: {
  confidence: ClassificationConfidence;
  suggestedEntityId: string | null;
}): DocumentInboxStatus {
  return shouldRequireReviewForClassification(input) ? 'review_required' : 'classification_pending';
}

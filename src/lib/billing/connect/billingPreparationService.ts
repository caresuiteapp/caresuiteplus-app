import type { ServiceResult } from '@/types';
import type {
  BillingCaseInput,
  BillingPreparationResult,
  BillingProviderConfig,
  ConnectBillingMode,
  ConnectBillingProviderKey,
  RejectionManagementCase,
} from '@/types/connect/billing';
import { runService } from '@/lib/services/serviceRunner';
import { getBillingModeDefinition } from './billingModes';
import { listBillingProviderDefinitions } from './billingProviders';
import { createExportPackage } from './billingExportService';
import { createBillingValidationReport } from './billingValidationService';
import {
  appendBillingAudit,
  listProviderConfigs,
  listRejectionCases,
  readIkProfile,
  saveRejectionCase,
  updateProviderConfig,
} from './connectBillingStore';
import { getTenantIkProfile, updateTenantBillingMode } from './tenantIkCostCarrierService';

export type PrepareBillingInput = {
  tenantId: string;
  billingMode?: ConnectBillingMode;
  billingCase: BillingCaseInput;
  providerKey?: ConnectBillingProviderKey | null;
  preparedBy?: string | null;
};

export function prepareBilling(input: PrepareBillingInput): BillingPreparationResult {
  const profile = readIkProfile(input.tenantId);
  const billingMode = input.billingMode ?? profile?.billingMode ?? 'leistungsnachweise_export';
  const modeDef = getBillingModeDefinition(billingMode);

  const validationInput: BillingCaseInput = {
    ...input.billingCase,
    tenantIkNumber: input.billingCase.tenantIkNumber ?? profile?.ikNumber ?? null,
  };

  const validation = createBillingValidationReport(input.tenantId, validationInput);
  const canPrepare = validation.passed && !modeDef.allowsDirectBilling;
  const canExport = canPrepare && modeDef.key !== 'direktabrechnung_spaeter';

  let message = 'Abrechnungsvorbereitung abgeschlossen.';
  if (!validation.passed) {
    message = validation.blockedReason ?? 'Abrechnung blockiert.';
  } else if (modeDef.key === 'direktabrechnung_spaeter') {
    message = 'Direktabrechnung ist vorbereitet, aber nicht produktiv freigeschaltet.';
  } else if (modeDef.allowsDtaPreparation) {
    message = 'Vorbereitung inkl. DTA-Stub — Datei ist nicht als abrechenbar validiert.';
  }

  appendBillingAudit({
    id: `audit-prep-${validation.validationRunId}`,
    tenantId: input.tenantId,
    action: 'billing.preparation_completed',
    entityType: 'billing_validation_results',
    entityId: validation.validationRunId,
    summary: message,
    createdAt: validation.checkedAt,
  });

  return {
    validation,
    canPrepare,
    canExport,
    canSubmit: false,
    message,
  };
}

export async function prepareBillingAsync(
  input: PrepareBillingInput,
): Promise<ServiceResult<BillingPreparationResult>> {
  return runService(async () => ({ ok: true, data: prepareBilling(input) }), { delayMs: 200 });
}

export function listBillingProviders(tenantId: string): BillingProviderConfig[] {
  return listProviderConfigs(tenantId);
}

export function getBillingProviderCatalog() {
  return listBillingProviderDefinitions();
}

export function configureBillingProvider(
  tenantId: string,
  providerKey: ConnectBillingProviderKey,
  patch: Partial<Pick<BillingProviderConfig, 'status' | 'isActive' | 'exportFormat' | 'notes'>>,
): ServiceResult<BillingProviderConfig> {
  const updated = updateProviderConfig(tenantId, providerKey, {
    ...patch,
    apiReady: false,
    configuredAt: patch.isActive ? new Date().toISOString() : null,
  });
  if (!updated) {
    return { ok: false, error: 'Abrechnungsanbieter nicht gefunden.' };
  }
  appendBillingAudit({
    id: `audit-provider-${Date.now()}`,
    tenantId,
    action: 'billing.provider_config_updated',
    entityType: 'billing_provider_configs',
    entityId: updated.id,
    summary: `Anbieter ${providerKey} aktualisiert (Status: ${updated.status}).`,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, data: updated };
}

export type CreateRejectionCaseInput = {
  tenantId: string;
  exportBatchId?: string | null;
  exportItemId?: string | null;
  caseType: RejectionManagementCase['caseType'];
  reasonCode?: string | null;
  reasonText: string;
};

export function createRejectionCase(input: CreateRejectionCaseInput): ServiceResult<RejectionManagementCase> {
  const now = new Date().toISOString();
  const rejectionCase: RejectionManagementCase = {
    id: `rej-${Date.now()}`,
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
  saveRejectionCase(input.tenantId, rejectionCase);
  appendBillingAudit({
    id: `audit-rej-${rejectionCase.id}`,
    tenantId: input.tenantId,
    action: 'billing.rejection_case_created',
    entityType: 'rejection_management_cases',
    entityId: rejectionCase.id,
    summary: `Rückläufer/Absetzung vorbereitet: ${input.caseType}`,
    createdAt: now,
  });
  return { ok: true, data: rejectionCase };
}

export function getRejectionCases(tenantId: string): RejectionManagementCase[] {
  return listRejectionCases(tenantId);
}

export function buildBillingCaseFromProfile(
  tenantId: string,
  partial: BillingCaseInput,
): BillingCaseInput {
  const profile = getTenantIkProfile(tenantId);
  return {
    ...partial,
    tenantIkNumber: partial.tenantIkNumber ?? profile?.ikNumber ?? null,
  };
}

export {
  createExportPackage,
  updateTenantBillingMode,
  getTenantIkProfile,
};

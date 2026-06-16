import type { GkvBillingCaseInput, GkvBillingPreparationResult } from '@/types/gkvBilling';
import type { GkvBillingMode } from '@/types/gkvBilling';
import { appendGkvBillingAudit, readGkvBillingProfile } from './gkvBillingStore';
import { createGkvValidationReport } from './gkvValidationService';
import { getGkvBillingProfile } from './gkvIkProfileService';

export type PrepareGkvBillingInput = {
  tenantId: string;
  billingMode?: GkvBillingMode;
  billingCase: GkvBillingCaseInput;
  preparedBy?: string | null;
};

export function prepareGkvBilling(input: PrepareGkvBillingInput): GkvBillingPreparationResult {
  const profile = readGkvBillingProfile(input.tenantId);
  const billingMode = input.billingMode ?? profile?.billingMode ?? 'leistungsnachweise_export';

  const validationInput: GkvBillingCaseInput = {
    ...input.billingCase,
    tenantIkNumber: input.billingCase.tenantIkNumber ?? profile?.ikNumber ?? null,
    ikVerificationStatus:
      input.billingCase.ikVerificationStatus ?? profile?.verificationStatus ?? 'unverified',
    statutorySector: input.billingCase.statutorySector ?? profile?.statutorySector ?? null,
    dtaValidatorConfigured:
      input.billingCase.dtaValidatorConfigured ?? profile?.dtaValidatorConfigured ?? false,
    dtaValidated: input.billingCase.dtaValidated ?? false,
  };

  const validation = createGkvValidationReport(input.tenantId, validationInput);
  const canPrepare = validation.passed && billingMode !== 'direktabrechnung_spaeter';
  const canExport = canPrepare && validation.passed;

  let message = 'Kassenabrechnung vorbereitet.';
  if (!validation.passed) {
    message = validation.blockedReason ?? 'Kassenabrechnung blockiert.';
  } else if (billingMode === 'direktabrechnung_spaeter') {
    message = 'Direktabrechnung ist vorbereitet, aber nicht produktiv freigeschaltet.';
  } else if (billingMode === 'dta_vorbereitung') {
    message = 'DTA-Vorbereitung — Datei ist nicht validiert und nicht produktiv abrechenbar.';
  }

  appendGkvBillingAudit({
    id: `gkv-audit-prep-${validation.validationRunId}`,
    tenantId: input.tenantId,
    action: 'gkv.preparation_completed',
    entityType: 'gkv_validation_results',
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

export function buildGkvBillingCaseFromProfile(
  tenantId: string,
  partial: GkvBillingCaseInput,
): GkvBillingCaseInput {
  const profile = getGkvBillingProfile(tenantId);
  return {
    ...partial,
    tenantIkNumber: partial.tenantIkNumber ?? profile?.ikNumber ?? null,
    ikVerificationStatus: partial.ikVerificationStatus ?? profile?.verificationStatus ?? 'unverified',
    statutorySector: partial.statutorySector ?? profile?.statutorySector ?? null,
    dtaValidatorConfigured: partial.dtaValidatorConfigured ?? profile?.dtaValidatorConfigured ?? false,
    dtaValidated: partial.dtaValidated ?? false,
  };
}

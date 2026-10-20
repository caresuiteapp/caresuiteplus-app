import type {
  CareBillingCaseInput,
  CareBillingValidationCheckKey,
  CareBillingValidationCheckResult,
  CareBillingValidationReport,
} from '@/types/careBilling/billingValidation';
import { isCareServiceAreaPreparedOnly } from '@/types/careBilling';
import { parseCareGrade } from './budgetAllocationService';
import { appendCareBillingAudit, saveValidationReport } from './careBillingStore';

export const CARE_VALIDATION_MESSAGES = {
  klientMissing: 'Klient fehlt — Abrechnung blockiert.',
  klientOk: 'Klient ist hinterlegt.',
  pflegegradMissing: 'Pflegegrad fehlt oder ist ungültig (PG 1–5).',
  pflegegradOk: 'Pflegegrad ist vorhanden.',
  leistungsnachweisMissing: 'Leistungsnachweis fehlt — Abrechnung blockiert.',
  leistungsnachweisNotApproved: 'Leistungsnachweis ist nicht freigegeben.',
  leistungsnachweisOk: 'Leistungsnachweis liegt vor und ist freigegeben.',
  leistungsartMissing: 'Leistungsart fehlt.',
  leistungsartPrepared: 'Leistungsart ist nur vorbereitet — keine produktive Abrechnung.',
  leistungsartOk: 'Leistungsart ist hinterlegt.',
  zeitraumMissing: 'Leistungszeitraum ist unvollständig.',
  zeitraumOk: 'Leistungszeitraum ist vollständig.',
  stundensatzMissing: 'Stundensatz fehlt.',
  stundensatzOk: 'Stundensatz ist hinterlegt.',
  kostentraegerMissing: 'Kein Kostenträger oder Selbstzahler — Abrechnung blockiert.',
  kostentraegerOk: 'Kostenträger/Selbstzahler ist hinterlegt.',
  empfaengerMissing: 'Rechnungsempfänger unklar — Abrechnung blockiert.',
  empfaengerOk: 'Rechnungsempfänger ist aufgelöst.',
  budgetMissing: 'Budgetinformationen fehlen.',
  budgetExceeded: 'Budget überschritten — Selbstzahleranteil erforderlich.',
  budgetOk: 'Budgetzuordnung ist gültig.',
  steuerInvalid: 'Steuerlogik inkonsistent.',
  steuerOk: 'Steuerlogik ist konsistent.',
} as const;

function newValidationRunId(): string {
  return `cb-val-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function checkKlient(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (!input.clientId?.trim()) {
    return { checkKey: 'klient', status: 'failed', message: CARE_VALIDATION_MESSAGES.klientMissing };
  }
  return { checkKey: 'klient', status: 'passed', message: CARE_VALIDATION_MESSAGES.klientOk };
}

function checkPflegegrad(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (input.isPreparedService) {
    return { checkKey: 'pflegegrad', status: 'skipped', message: 'Pflegegrad-Prüfung übersprungen (vorbereitete Leistung).' };
  }
  const grade = parseCareGrade(input.careGrade);
  if (!grade) {
    return { checkKey: 'pflegegrad', status: 'failed', message: CARE_VALIDATION_MESSAGES.pflegegradMissing };
  }
  return { checkKey: 'pflegegrad', status: 'passed', message: CARE_VALIDATION_MESSAGES.pflegegradOk };
}

function checkLeistungsnachweis(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (!input.hasServiceProof) {
    return {
      checkKey: 'leistungsnachweis',
      status: 'failed',
      message: CARE_VALIDATION_MESSAGES.leistungsnachweisMissing,
    };
  }
  if (!input.serviceProofApproved) {
    return {
      checkKey: 'leistungsnachweis',
      status: 'failed',
      message: CARE_VALIDATION_MESSAGES.leistungsnachweisNotApproved,
    };
  }
  return {
    checkKey: 'leistungsnachweis',
    status: 'passed',
    message: CARE_VALIDATION_MESSAGES.leistungsnachweisOk,
  };
}

function checkLeistungsart(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (!input.serviceAreaKey?.trim()) {
    return { checkKey: 'leistungsart', status: 'failed', message: CARE_VALIDATION_MESSAGES.leistungsartMissing };
  }
  if (
    isCareServiceAreaPreparedOnly(input.serviceAreaKey as Parameters<typeof isCareServiceAreaPreparedOnly>[0])
  ) {
    return {
      checkKey: 'leistungsart',
      status: 'failed',
      message: CARE_VALIDATION_MESSAGES.leistungsartPrepared,
    };
  }
  return { checkKey: 'leistungsart', status: 'passed', message: CARE_VALIDATION_MESSAGES.leistungsartOk };
}

function checkLeistungszeitraum(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (!input.servicePeriodFrom?.trim() || !input.servicePeriodTo?.trim()) {
    return { checkKey: 'leistungszeitraum', status: 'failed', message: CARE_VALIDATION_MESSAGES.zeitraumMissing };
  }
  return { checkKey: 'leistungszeitraum', status: 'passed', message: CARE_VALIDATION_MESSAGES.zeitraumOk };
}

function checkStundensatz(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (input.hourlyRateNetCents == null || input.hourlyRateNetCents <= 0) {
    return { checkKey: 'stundensatz', status: 'failed', message: CARE_VALIDATION_MESSAGES.stundensatzMissing };
  }
  return { checkKey: 'stundensatz', status: 'passed', message: CARE_VALIDATION_MESSAGES.stundensatzOk };
}

function checkKostentraegerSelbstzahler(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (!input.costCarrierProfileId?.trim() && !input.isSelfPayer) {
    return {
      checkKey: 'kostentraeger_selbstzahler',
      status: 'failed',
      message: CARE_VALIDATION_MESSAGES.kostentraegerMissing,
    };
  }
  return {
    checkKey: 'kostentraeger_selbstzahler',
    status: 'passed',
    message: CARE_VALIDATION_MESSAGES.kostentraegerOk,
  };
}

function checkRechnungsempfaenger(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (!input.recipientResolved || input.recipientType === 'unclear') {
    return {
      checkKey: 'rechnungsempfaenger',
      status: 'failed',
      message: CARE_VALIDATION_MESSAGES.empfaengerMissing,
    };
  }
  return {
    checkKey: 'rechnungsempfaenger',
    status: 'passed',
    message: CARE_VALIDATION_MESSAGES.empfaengerOk,
  };
}

function checkBudget(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (input.budgetAvailableCents == null && input.budgetType !== 'selbstzahler') {
    return { checkKey: 'budget', status: 'warning', message: CARE_VALIDATION_MESSAGES.budgetMissing };
  }
  if (
    input.amountCents != null &&
    input.budgetAvailableCents != null &&
    input.selfPayerAmountCents == null &&
    input.amountCents > input.budgetAvailableCents
  ) {
    return { checkKey: 'budget', status: 'failed', message: CARE_VALIDATION_MESSAGES.budgetExceeded };
  }
  if (input.selfPayerAmountCents != null && input.selfPayerAmountCents > 0) {
    return {
      checkKey: 'budget',
      status: 'warning',
      message: `Selbstzahleranteil ${(input.selfPayerAmountCents / 100).toFixed(2)} EUR.`,
    };
  }
  return { checkKey: 'budget', status: 'passed', message: CARE_VALIDATION_MESSAGES.budgetOk };
}

function checkSteuerlogik(input: CareBillingCaseInput): CareBillingValidationCheckResult {
  if (input.taxConsistent === false) {
    return { checkKey: 'steuerlogik', status: 'failed', message: CARE_VALIDATION_MESSAGES.steuerInvalid };
  }
  if (!input.taxMode?.trim()) {
    return { checkKey: 'steuerlogik', status: 'warning', message: 'Steuermodus nicht gesetzt.' };
  }
  return { checkKey: 'steuerlogik', status: 'passed', message: CARE_VALIDATION_MESSAGES.steuerOk };
}

const CHECK_RUNNERS: Record<
  CareBillingValidationCheckKey,
  (input: CareBillingCaseInput) => CareBillingValidationCheckResult
> = {
  klient: checkKlient,
  pflegegrad: checkPflegegrad,
  leistungsnachweis: checkLeistungsnachweis,
  leistungsart: checkLeistungsart,
  leistungszeitraum: checkLeistungszeitraum,
  stundensatz: checkStundensatz,
  kostentraeger_selbstzahler: checkKostentraegerSelbstzahler,
  rechnungsempfaenger: checkRechnungsempfaenger,
  budget: checkBudget,
  steuerlogik: checkSteuerlogik,
};

export function runCareBillingValidationChecks(
  input: CareBillingCaseInput,
): CareBillingValidationCheckResult[] {
  return (Object.keys(CHECK_RUNNERS) as CareBillingValidationCheckKey[]).map((key) =>
    CHECK_RUNNERS[key](input),
  );
}

export function createCareBillingValidationReport(
  input: CareBillingCaseInput,
): CareBillingValidationReport {
  const checks = runCareBillingValidationChecks(input);
  const failedCount = checks.filter((c) => c.status === 'failed').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const passed = failedCount === 0;
  const blockedReason = passed
    ? null
    : checks.find((c) => c.status === 'failed')?.message ??
      'Abrechnung blockiert — Prüfungen fehlgeschlagen.';

  const report: CareBillingValidationReport = {
    validationRunId: newValidationRunId(),
    tenantId: input.tenantId,
    clientId: input.clientId ?? null,
    billableItemId: input.billableItemId ?? null,
    invoiceDraftId: input.invoiceDraftId ?? null,
    checks,
    passed,
    failedCount,
    warningCount,
    checkedAt: new Date().toISOString(),
    blockedReason,
  };

  saveValidationReport(input.tenantId, report);
  appendCareBillingAudit({
    id: `cb-audit-${report.validationRunId}`,
    tenantId: input.tenantId,
    action: 'care_billing.validation_completed',
    entityType: 'billing_validation_results',
    entityId: report.validationRunId,
    summary: passed
      ? 'Pflege-Abrechnungsprüfung bestanden.'
      : `Pflege-Abrechnung blockiert: ${blockedReason}`,
    createdAt: report.checkedAt,
  });

  return report;
}

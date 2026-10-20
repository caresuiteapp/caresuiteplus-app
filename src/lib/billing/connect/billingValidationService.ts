import type {
  BillingCaseInput,
  BillingValidationCheckKey,
  BillingValidationCheckResult,
  BillingValidationReport,
} from '@/types/connect/billing';
import { BILLING_VALIDATION_CHECK_LABELS } from '@/types/connect/billing';
import { appendBillingAudit, saveValidationReport } from './connectBillingStore';

const VALIDATION_MESSAGES = {
  pflegegradMissing: 'Pflegegrad fehlt oder ist ungültig (1–5 erforderlich).',
  pflegegradOk: 'Pflegegrad ist vorhanden.',
  abtretungMissing: 'Abtretung oder Einwilligung liegt nicht vor.',
  abtretungOk: 'Abtretung/Einwilligung liegt vor.',
  leistungsnachweisMissing: 'Leistungsnachweis fehlt — Abrechnung blockiert.',
  leistungsnachweisOk: 'Leistungsnachweis liegt vor.',
  unterschriftMissing: 'Unterschrift fehlt.',
  unterschriftOk: 'Unterschrift liegt vor.',
  kostentraegerMissing: 'Kein Kostenträger hinterlegt — Abrechnung blockiert.',
  kostentraegerOk: 'Kostenträger ist hinterlegt.',
  ikMissing: 'Institutionskennzeichen (IK) des Mandanten fehlt — Abrechnung blockiert.',
  ikUnverified: 'IK ist noch nicht verifiziert — nur Vorbereitung möglich.',
  ikOk: 'Mandanten-IK ist hinterlegt.',
  zeitraumMissing: 'Leistungszeitraum ist unvollständig.',
  zeitraumOk: 'Leistungszeitraum ist vollständig.',
  budgetMissing: 'Budgetinformationen fehlen.',
  budgetExceeded: 'Betrag übersteigt verfügbares Budget.',
  budgetOk: 'Budget ist ausreichend.',
  stundensatzMissing: 'Stundensatz fehlt.',
  stundensatzOk: 'Stundensatz ist hinterlegt.',
  rechnungsnummerMissing: 'Rechnungsnummer fehlt.',
  rechnungsnummerOk: 'Rechnungsnummer ist vorhanden.',
  leistungsartMissing: 'Leistungsart fehlt.',
  leistungsartOk: 'Leistungsart ist hinterlegt.',
  dtaNotValidated: 'DTA-Datei ist nicht validiert — kein produktiver Versand.',
} as const;

function newValidationRunId(): string {
  return `val-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function checkPflegegrad(input: BillingCaseInput): BillingValidationCheckResult {
  const grade = input.pflegegrad;
  if (grade == null || grade < 1 || grade > 5) {
    return { checkKey: 'pflegegrad', status: 'failed', message: VALIDATION_MESSAGES.pflegegradMissing };
  }
  return { checkKey: 'pflegegrad', status: 'passed', message: VALIDATION_MESSAGES.pflegegradOk };
}

function checkAbtretung(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.hasAbtretungEinwilligung) {
    return {
      checkKey: 'abtretung_einwilligung',
      status: 'failed',
      message: VALIDATION_MESSAGES.abtretungMissing,
    };
  }
  return {
    checkKey: 'abtretung_einwilligung',
    status: 'passed',
    message: VALIDATION_MESSAGES.abtretungOk,
  };
}

function checkLeistungsnachweis(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.hasLeistungsnachweis) {
    return {
      checkKey: 'leistungsnachweis',
      status: 'failed',
      message: VALIDATION_MESSAGES.leistungsnachweisMissing,
    };
  }
  return {
    checkKey: 'leistungsnachweis',
    status: 'passed',
    message: VALIDATION_MESSAGES.leistungsnachweisOk,
  };
}

function checkUnterschrift(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.hasUnterschrift) {
    return { checkKey: 'unterschrift', status: 'warning', message: VALIDATION_MESSAGES.unterschriftMissing };
  }
  return { checkKey: 'unterschrift', status: 'passed', message: VALIDATION_MESSAGES.unterschriftOk };
}

function checkKostentraeger(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.costCarrierId?.trim() && !input.costCarrierIk?.trim()) {
    return {
      checkKey: 'kostentraeger',
      status: 'failed',
      message: VALIDATION_MESSAGES.kostentraegerMissing,
    };
  }
  return { checkKey: 'kostentraeger', status: 'passed', message: VALIDATION_MESSAGES.kostentraegerOk };
}

function checkIk(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.tenantIkNumber?.trim()) {
    return { checkKey: 'ik', status: 'failed', message: VALIDATION_MESSAGES.ikMissing };
  }
  return { checkKey: 'ik', status: 'passed', message: VALIDATION_MESSAGES.ikOk };
}

function checkLeistungszeitraum(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.leistungszeitraumFrom?.trim() || !input.leistungszeitraumTo?.trim()) {
    return {
      checkKey: 'leistungszeitraum',
      status: 'failed',
      message: VALIDATION_MESSAGES.zeitraumMissing,
    };
  }
  return { checkKey: 'leistungszeitraum', status: 'passed', message: VALIDATION_MESSAGES.zeitraumOk };
}

function checkBudget(input: BillingCaseInput): BillingValidationCheckResult {
  if (input.budgetAvailableCents == null) {
    return { checkKey: 'budget', status: 'warning', message: VALIDATION_MESSAGES.budgetMissing };
  }
  if (input.amountCents != null && input.amountCents > input.budgetAvailableCents) {
    return { checkKey: 'budget', status: 'failed', message: VALIDATION_MESSAGES.budgetExceeded };
  }
  return { checkKey: 'budget', status: 'passed', message: VALIDATION_MESSAGES.budgetOk };
}

function checkStundensatz(input: BillingCaseInput): BillingValidationCheckResult {
  if (input.stundensatzCents == null || input.stundensatzCents <= 0) {
    return { checkKey: 'stundensatz', status: 'failed', message: VALIDATION_MESSAGES.stundensatzMissing };
  }
  return { checkKey: 'stundensatz', status: 'passed', message: VALIDATION_MESSAGES.stundensatzOk };
}

function checkRechnungsnummer(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.rechnungsnummer?.trim()) {
    return {
      checkKey: 'rechnungsnummer',
      status: 'failed',
      message: VALIDATION_MESSAGES.rechnungsnummerMissing,
    };
  }
  return { checkKey: 'rechnungsnummer', status: 'passed', message: VALIDATION_MESSAGES.rechnungsnummerOk };
}

function checkLeistungsart(input: BillingCaseInput): BillingValidationCheckResult {
  if (!input.leistungsart?.trim()) {
    return { checkKey: 'leistungsart', status: 'failed', message: VALIDATION_MESSAGES.leistungsartMissing };
  }
  return { checkKey: 'leistungsart', status: 'passed', message: VALIDATION_MESSAGES.leistungsartOk };
}

const CHECK_RUNNERS: Record<BillingValidationCheckKey, (input: BillingCaseInput) => BillingValidationCheckResult> = {
  pflegegrad: checkPflegegrad,
  abtretung_einwilligung: checkAbtretung,
  leistungsnachweis: checkLeistungsnachweis,
  unterschrift: checkUnterschrift,
  kostentraeger: checkKostentraeger,
  ik: checkIk,
  leistungszeitraum: checkLeistungszeitraum,
  budget: checkBudget,
  stundensatz: checkStundensatz,
  rechnungsnummer: checkRechnungsnummer,
  leistungsart: checkLeistungsart,
};

export function runBillingValidationChecks(input: BillingCaseInput): BillingValidationCheckResult[] {
  return (Object.keys(CHECK_RUNNERS) as BillingValidationCheckKey[]).map((key) =>
    CHECK_RUNNERS[key](input),
  );
}

export function createBillingValidationReport(
  tenantId: string,
  input: BillingCaseInput,
): BillingValidationReport {
  const checks = runBillingValidationChecks(input);
  const failedCount = checks.filter((entry) => entry.status === 'failed').length;
  const warningCount = checks.filter((entry) => entry.status === 'warning').length;
  const passed = failedCount === 0;
  const blockedReason = passed
    ? null
    : checks.find((entry) => entry.status === 'failed')?.message ??
      'Abrechnungsvorbereitung blockiert — Prüfungen fehlgeschlagen.';

  const report: BillingValidationReport = {
    validationRunId: newValidationRunId(),
    tenantId,
    clientId: input.clientId ?? null,
    invoiceId: input.invoiceId ?? null,
    checks,
    passed,
    failedCount,
    warningCount,
    checkedAt: new Date().toISOString(),
    blockedReason,
  };

  saveValidationReport(tenantId, report);
  appendBillingAudit({
    id: `audit-${report.validationRunId}`,
    tenantId,
    action: 'billing.validation_completed',
    entityType: 'billing_validation_results',
    entityId: report.validationRunId,
    summary: passed
      ? 'Abrechnungsprüfung bestanden (Vorbereitung).'
      : `Abrechnungsprüfung blockiert: ${blockedReason}`,
    createdAt: report.checkedAt,
  });

  return report;
}

export function getValidationCheckLabel(checkKey: BillingValidationCheckKey): string {
  return BILLING_VALIDATION_CHECK_LABELS[checkKey];
}

export { VALIDATION_MESSAGES };

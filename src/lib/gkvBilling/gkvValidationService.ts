import type {
  GkvBillingCaseInput,
  GkvValidationCheckKey,
  GkvValidationCheckResult,
  GkvValidationReport,
} from '@/types/gkvBilling';
import { GKV_VALIDATION_CHECK_LABELS } from '@/types/gkvBilling';
import { appendGkvBillingAudit, saveGkvValidationReport } from './gkvBillingStore';

export const GKV_VALIDATION_MESSAGES = {
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
  rechnungsartMissing: 'Rechnungsart/Leistungsart fehlt.',
  rechnungsartOk: 'Rechnungsart/Leistungsart ist hinterlegt.',
  sgbSectorMissing: 'SGB XI/V Sektor nicht festgelegt.',
  sgbSectorOk: 'SGB XI/V Sektor ist hinterlegt.',
  dtaValidatorMissing: 'DTA-Validator nicht konfiguriert — DTA nur als Vorbereitung.',
  dtaNotValidated: 'DTA-Datei ist nicht validiert — kein produktiver Versand.',
  dtaValidatorOk: 'DTA-Validator konfiguriert (Vorbereitung).',
} as const;

function newValidationRunId(): string {
  return `gkv-val-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function checkPflegegrad(input: GkvBillingCaseInput): GkvValidationCheckResult {
  const grade = input.pflegegrad;
  if (grade == null || grade < 1 || grade > 5) {
    return { checkKey: 'pflegegrad', status: 'failed', message: GKV_VALIDATION_MESSAGES.pflegegradMissing };
  }
  return { checkKey: 'pflegegrad', status: 'passed', message: GKV_VALIDATION_MESSAGES.pflegegradOk };
}

function checkAbtretung(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.hasAbtretungEinwilligung) {
    return { checkKey: 'abtretung_einwilligung', status: 'failed', message: GKV_VALIDATION_MESSAGES.abtretungMissing };
  }
  return { checkKey: 'abtretung_einwilligung', status: 'passed', message: GKV_VALIDATION_MESSAGES.abtretungOk };
}

function checkLeistungsnachweis(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.hasLeistungsnachweis) {
    return { checkKey: 'leistungsnachweis', status: 'failed', message: GKV_VALIDATION_MESSAGES.leistungsnachweisMissing };
  }
  return { checkKey: 'leistungsnachweis', status: 'passed', message: GKV_VALIDATION_MESSAGES.leistungsnachweisOk };
}

function checkUnterschrift(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.hasUnterschrift) {
    return { checkKey: 'unterschrift', status: 'warning', message: GKV_VALIDATION_MESSAGES.unterschriftMissing };
  }
  return { checkKey: 'unterschrift', status: 'passed', message: GKV_VALIDATION_MESSAGES.unterschriftOk };
}

function checkKostentraeger(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.costCarrierId?.trim() && !input.costCarrierIk?.trim()) {
    return { checkKey: 'kostentraeger', status: 'failed', message: GKV_VALIDATION_MESSAGES.kostentraegerMissing };
  }
  return { checkKey: 'kostentraeger', status: 'passed', message: GKV_VALIDATION_MESSAGES.kostentraegerOk };
}

function checkIk(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.tenantIkNumber?.trim()) {
    return { checkKey: 'ik', status: 'failed', message: GKV_VALIDATION_MESSAGES.ikMissing };
  }
  return { checkKey: 'ik', status: 'passed', message: GKV_VALIDATION_MESSAGES.ikOk };
}

function checkIkVerification(input: GkvBillingCaseInput): GkvValidationCheckResult {
  const status = input.ikVerificationStatus ?? 'unverified';
  if (status === 'failed') {
    return { checkKey: 'ik_verification', status: 'failed', message: GKV_VALIDATION_MESSAGES.ikUnverified };
  }
  if (status === 'unverified' || status === 'pending') {
    return { checkKey: 'ik_verification', status: 'warning', message: GKV_VALIDATION_MESSAGES.ikUnverified };
  }
  return { checkKey: 'ik_verification', status: 'passed', message: GKV_VALIDATION_MESSAGES.ikOk };
}

function checkLeistungszeitraum(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.leistungszeitraumFrom?.trim() || !input.leistungszeitraumTo?.trim()) {
    return { checkKey: 'leistungszeitraum', status: 'failed', message: GKV_VALIDATION_MESSAGES.zeitraumMissing };
  }
  return { checkKey: 'leistungszeitraum', status: 'passed', message: GKV_VALIDATION_MESSAGES.zeitraumOk };
}

function checkBudget(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (input.budgetAvailableCents == null) {
    return { checkKey: 'budget', status: 'warning', message: GKV_VALIDATION_MESSAGES.budgetMissing };
  }
  if (input.amountCents != null && input.amountCents > input.budgetAvailableCents) {
    return { checkKey: 'budget', status: 'failed', message: GKV_VALIDATION_MESSAGES.budgetExceeded };
  }
  return { checkKey: 'budget', status: 'passed', message: GKV_VALIDATION_MESSAGES.budgetOk };
}

function checkStundensatz(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (input.stundensatzCents == null || input.stundensatzCents <= 0) {
    return { checkKey: 'stundensatz', status: 'failed', message: GKV_VALIDATION_MESSAGES.stundensatzMissing };
  }
  return { checkKey: 'stundensatz', status: 'passed', message: GKV_VALIDATION_MESSAGES.stundensatzOk };
}

function checkRechnungsart(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.leistungsart?.trim() && !input.rechnungsnummer?.trim()) {
    return { checkKey: 'rechnungsart', status: 'failed', message: GKV_VALIDATION_MESSAGES.rechnungsartMissing };
  }
  return { checkKey: 'rechnungsart', status: 'passed', message: GKV_VALIDATION_MESSAGES.rechnungsartOk };
}

function checkSgbSector(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.statutorySector) {
    return { checkKey: 'sgb_sector', status: 'warning', message: GKV_VALIDATION_MESSAGES.sgbSectorMissing };
  }
  return { checkKey: 'sgb_sector', status: 'passed', message: GKV_VALIDATION_MESSAGES.sgbSectorOk };
}

function checkDtaValidator(input: GkvBillingCaseInput): GkvValidationCheckResult {
  if (!input.dtaValidatorConfigured) {
    return { checkKey: 'dta_validator', status: 'warning', message: GKV_VALIDATION_MESSAGES.dtaValidatorMissing };
  }
  if (!input.dtaValidated) {
    return { checkKey: 'dta_validator', status: 'failed', message: GKV_VALIDATION_MESSAGES.dtaNotValidated };
  }
  return { checkKey: 'dta_validator', status: 'passed', message: GKV_VALIDATION_MESSAGES.dtaValidatorOk };
}

const CHECK_RUNNERS: Record<GkvValidationCheckKey, (input: GkvBillingCaseInput) => GkvValidationCheckResult> = {
  pflegegrad: checkPflegegrad,
  abtretung_einwilligung: checkAbtretung,
  leistungsnachweis: checkLeistungsnachweis,
  unterschrift: checkUnterschrift,
  kostentraeger: checkKostentraeger,
  ik: checkIk,
  ik_verification: checkIkVerification,
  leistungszeitraum: checkLeistungszeitraum,
  budget: checkBudget,
  stundensatz: checkStundensatz,
  rechnungsart: checkRechnungsart,
  sgb_sector: checkSgbSector,
  dta_validator: checkDtaValidator,
};

export function runGkvValidationChecks(input: GkvBillingCaseInput): GkvValidationCheckResult[] {
  return (Object.keys(CHECK_RUNNERS) as GkvValidationCheckKey[]).map((key) => CHECK_RUNNERS[key](input));
}

export function createGkvValidationReport(
  tenantId: string,
  input: GkvBillingCaseInput,
  batchId?: string | null,
): GkvValidationReport {
  const checks = runGkvValidationChecks(input);
  const failedCount = checks.filter((e) => e.status === 'failed').length;
  const warningCount = checks.filter((e) => e.status === 'warning').length;
  const passed = failedCount === 0;
  const blockedReason = passed
    ? null
    : checks.find((e) => e.status === 'failed')?.message ??
      'Kassenabrechnung blockiert — Prüfungen fehlgeschlagen.';

  const report: GkvValidationReport = {
    validationRunId: newValidationRunId(),
    tenantId,
    clientId: input.clientId ?? null,
    batchId: batchId ?? null,
    checks,
    passed,
    failedCount,
    warningCount,
    checkedAt: new Date().toISOString(),
    blockedReason,
    status: passed ? 'validation_passed' : 'validation_failed',
  };

  saveGkvValidationReport(tenantId, report);
  appendGkvBillingAudit({
    id: `gkv-audit-val-${report.validationRunId}`,
    tenantId,
    action: 'gkv.validation_completed',
    entityType: 'gkv_validation_results',
    entityId: report.validationRunId,
    summary: passed
      ? 'GKV-Prüfprotokoll bestanden (Vorbereitung).'
      : `GKV-Prüfprotokoll blockiert: ${blockedReason}`,
    createdAt: report.checkedAt,
  });

  return report;
}

export function listGkvValidationErrors(report: GkvValidationReport): GkvValidationCheckResult[] {
  return report.checks.filter((e) => e.status === 'failed' || e.status === 'warning');
}

export function getGkvValidationCheckLabel(checkKey: GkvValidationCheckKey): string {
  return GKV_VALIDATION_CHECK_LABELS[checkKey];
}

export function generateGkvValidationProtocol(
  tenantId: string,
  input: GkvBillingCaseInput,
): GkvValidationReport {
  return createGkvValidationReport(tenantId, input);
}

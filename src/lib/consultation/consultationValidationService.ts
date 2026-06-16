import type {
  ConsultationBillingPrepInput,
  ConsultationBillingPrepReport,
  ConsultationValidationCheckResult,
} from '@/types/modules/consultation';
import { CONSULTATION_BILLABLE_OCCASIONS } from '@/types/modules/consultation';
import { parseCareGrade } from '@/lib/careBilling/budgetAllocationService';

export const CONSULTATION_VALIDATION_MESSAGES = {
  klientMissing: 'Klient fehlt — Abrechnungsvorbereitung blockiert.',
  klientOk: 'Klient ist hinterlegt.',
  pflegegradMissing: 'Pflegegrad fehlt oder ist ungültig (PG 1–5 erforderlich für abrechenbare Beratung).',
  pflegegradOk: 'Pflegegrad ist vorhanden.',
  protokollMissing: 'Finalisiertes Beratungsprotokoll fehlt.',
  protokollOk: 'Beratungsprotokoll liegt vor.',
  unterschriftMissing: 'Unterschrift fehlt — Abrechnung nicht freigegeben.',
  unterschriftOk: 'Unterschrift liegt vor.',
  anlassMissing: 'Beratungsanlass fehlt.',
  anlassNotBillable: 'Beratungsanlass ist nicht abrechenbar vorbereitet.',
  anlassOk: 'Beratungsanlass ist abrechenbar.',
  dauerMissing: 'Leistungsdauer fehlt.',
  dauerOk: 'Leistungsdauer ist hinterlegt.',
  kostentraegerMissing: 'Kostenträger fehlt — Abrechnung blockiert.',
  kostentraegerOk: 'Kostenträger ist hinterlegt.',
} as const;

function newValidationRunId(): string {
  return `con-val-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function checkKlient(input: ConsultationBillingPrepInput): ConsultationValidationCheckResult {
  if (!input.clientId?.trim()) {
    return { checkKey: 'klient', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.klientMissing };
  }
  return { checkKey: 'klient', status: 'passed', message: CONSULTATION_VALIDATION_MESSAGES.klientOk };
}

function checkPflegegrad(input: ConsultationBillingPrepInput): ConsultationValidationCheckResult {
  if (!input.occasionKey || !CONSULTATION_BILLABLE_OCCASIONS.has(input.occasionKey)) {
    return { checkKey: 'pflegegrad', status: 'skipped', message: 'Pflegegrad-Prüfung übersprungen (nicht abrechenbarer Anlass).' };
  }
  const grade = input.careGrade && input.careGrade !== 'none' && input.careGrade !== 'unknown'
    ? parseCareGrade(input.careGrade)
    : null;
  if (!grade) {
    return { checkKey: 'pflegegrad', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.pflegegradMissing };
  }
  return { checkKey: 'pflegegrad', status: 'passed', message: CONSULTATION_VALIDATION_MESSAGES.pflegegradOk };
}

function checkProtokoll(input: ConsultationBillingPrepInput): ConsultationValidationCheckResult {
  if (!input.hasFinalizedProtocol) {
    return { checkKey: 'protokoll', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.protokollMissing };
  }
  return { checkKey: 'protokoll', status: 'passed', message: CONSULTATION_VALIDATION_MESSAGES.protokollOk };
}

function checkUnterschrift(input: ConsultationBillingPrepInput): ConsultationValidationCheckResult {
  if (!input.hasSignature) {
    return { checkKey: 'unterschrift', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.unterschriftMissing };
  }
  return { checkKey: 'unterschrift', status: 'passed', message: CONSULTATION_VALIDATION_MESSAGES.unterschriftOk };
}

function checkAnlass(input: ConsultationBillingPrepInput): ConsultationValidationCheckResult {
  if (!input.occasionKey) {
    return { checkKey: 'beratungsanlass', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.anlassMissing };
  }
  if (!CONSULTATION_BILLABLE_OCCASIONS.has(input.occasionKey)) {
    return { checkKey: 'beratungsanlass', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.anlassNotBillable };
  }
  return { checkKey: 'beratungsanlass', status: 'passed', message: CONSULTATION_VALIDATION_MESSAGES.anlassOk };
}

function checkDauer(input: ConsultationBillingPrepInput): ConsultationValidationCheckResult {
  if (!CONSULTATION_BILLABLE_OCCASIONS.has(input.occasionKey ?? ('' as never))) {
    return { checkKey: 'leistungsdauer', status: 'skipped', message: 'Dauer-Prüfung übersprungen.' };
  }
  if (input.durationMinutes == null || input.durationMinutes <= 0) {
    return { checkKey: 'leistungsdauer', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.dauerMissing };
  }
  return { checkKey: 'leistungsdauer', status: 'passed', message: CONSULTATION_VALIDATION_MESSAGES.dauerOk };
}

function checkKostentraeger(input: ConsultationBillingPrepInput): ConsultationValidationCheckResult {
  if (!CONSULTATION_BILLABLE_OCCASIONS.has(input.occasionKey ?? ('' as never))) {
    return { checkKey: 'kostentraeger', status: 'skipped', message: 'Kostenträger-Prüfung übersprungen.' };
  }
  if (!input.costCarrierProfileId?.trim()) {
    return { checkKey: 'kostentraeger', status: 'failed', message: CONSULTATION_VALIDATION_MESSAGES.kostentraegerMissing };
  }
  return { checkKey: 'kostentraeger', status: 'passed', message: CONSULTATION_VALIDATION_MESSAGES.kostentraegerOk };
}

export function createConsultationBillingPrepReport(
  input: ConsultationBillingPrepInput,
): ConsultationBillingPrepReport {
  const checks: ConsultationValidationCheckResult[] = [
    checkKlient(input),
    checkAnlass(input),
    checkPflegegrad(input),
    checkProtokoll(input),
    checkUnterschrift(input),
    checkDauer(input),
    checkKostentraeger(input),
  ];

  const failed = checks.filter((c) => c.status === 'failed');
  const passed = failed.length === 0;

  return {
    validationRunId: newValidationRunId(),
    tenantId: input.tenantId,
    caseId: input.caseId,
    checks,
    passed,
    blockedReason: passed ? null : failed.map((f) => f.message).join(' '),
    checkedAt: new Date().toISOString(),
  };
}

export function isConsultationBillingReady(input: ConsultationBillingPrepInput): boolean {
  return createConsultationBillingPrepReport(input).passed;
}

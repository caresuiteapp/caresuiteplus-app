import type {
  EmployeeHrCase,
  EmployeeHrCaseAreaKey,
  EmployeeConversationPayload,
  EmployeeReferencePayload,
  EmployeeReturnProtocolPayload,
  EmployeeTerminationPayload,
  EmployeeWarningPayload,
} from '@/types/modules/employeeHr';
import { HR_CONVERSATION_AREAS } from '@/types/modules/employeeHr';
import type { TemplateValidationIssue, TemplateValidationResult } from '@/features/documents/templateEngine/types';

export const HR_TEMPLATE_BY_AREA: Partial<Record<EmployeeHrCaseAreaKey, string>> = {
  abmahnung: 'sys-dtpl-023',
  ermahnung: 'sys-dtpl-023',
  kuendigung: 'sys-dtpl-022',
  aufhebungsvereinbarung: 'sys-dtpl-022',
  rueckgabe_uebergabeprotokoll: 'sys-dtpl-025',
};

import { SYSTEM_TEMPLATE_LEGAL_DISCLAIMER } from '@/lib/documents/systemTemplateLegal';

export const FINALIZE_HR_HTML_TEMPLATE = `<!DOCTYPE html><html><body></body></html>`;

function isConversationArea(areaKey: EmployeeHrCaseAreaKey): boolean {
  return HR_CONVERSATION_AREAS.includes(areaKey);
}

function isWarningArea(areaKey: EmployeeHrCaseAreaKey): boolean {
  return areaKey === 'abmahnung' || areaKey === 'ermahnung';
}

function validateConversationPayload(
  areaKey: EmployeeHrCaseAreaKey,
  payload: EmployeeConversationPayload | null,
  issues: TemplateValidationIssue[],
): void {
  if (!payload) {
    issues.push({
      code: 'conversation_payload_missing',
      message: 'Gesprächsdaten fehlen.',
      fieldKey: 'conversation',
      severity: 'error',
    });
    return;
  }

  if (!payload.scheduledAt?.trim()) {
    issues.push({
      code: 'scheduled_at_missing',
      message: 'Termin fehlt.',
      fieldKey: 'conversation.scheduled_at',
      severity: 'error',
    });
  }

  if (!payload.participants.length) {
    issues.push({
      code: 'participants_missing',
      message: 'Teilnehmende fehlen.',
      fieldKey: 'conversation.participants',
      severity: 'error',
    });
  }

  if (!payload.topics?.trim()) {
    issues.push({
      code: 'topics_missing',
      message: 'Themen fehlen.',
      fieldKey: 'conversation.topics',
      severity: 'error',
    });
  }

  if (!payload.summary?.trim()) {
    issues.push({
      code: 'summary_missing',
      message: 'Zusammenfassung fehlt.',
      fieldKey: 'conversation.summary',
      severity: 'error',
    });
  }

  if (areaKey === 'zielvereinbarung' && !payload.agreements?.trim()) {
    issues.push({
      code: 'agreements_missing',
      message: 'Vereinbarungen fehlen.',
      fieldKey: 'conversation.agreements',
      severity: 'error',
    });
  }
}

function validateWarningPayload(payload: EmployeeWarningPayload | null, issues: TemplateValidationIssue[]): void {
  if (!payload) {
    issues.push({
      code: 'warning_payload_missing',
      message: 'Abmahnungsdaten fehlen.',
      fieldKey: 'warning',
      severity: 'error',
    });
    return;
  }

  if (!payload.incidentDescription?.trim()) {
    issues.push({
      code: 'incident_description_missing',
      message: 'Vorfallbeschreibung fehlt.',
      fieldKey: 'warning.incident_description',
      severity: 'error',
    });
  }

  if (!payload.incidentDate?.trim()) {
    issues.push({
      code: 'incident_date_missing',
      message: 'Vorfallsdatum fehlt.',
      fieldKey: 'warning.incident_date',
      severity: 'error',
    });
  }

  if (!payload.breachedDuties?.trim()) {
    issues.push({
      code: 'breached_duties_missing',
      message: 'Verletzte Pflichten fehlen.',
      fieldKey: 'warning.breached_duties',
      severity: 'error',
    });
  }

  if (!payload.expectedBehavior?.trim()) {
    issues.push({
      code: 'expected_behavior_missing',
      message: 'Erwartetes Verhalten fehlt.',
      fieldKey: 'warning.expected_behavior',
      severity: 'error',
    });
  }

  if (!payload.consequencesNotice?.trim()) {
    issues.push({
      code: 'consequences_notice_missing',
      message: 'Konsequenzhinweis fehlt.',
      fieldKey: 'warning.consequences_notice',
      severity: 'error',
    });
  }

  if (!payload.deliveryMethod) {
    issues.push({
      code: 'delivery_method_missing',
      message: 'Zustellungsart fehlt.',
      fieldKey: 'warning.delivery_method',
      severity: 'error',
    });
  }
}

function validateTerminationPayload(payload: EmployeeTerminationPayload | null, issues: TemplateValidationIssue[]): void {
  if (!payload) {
    issues.push({
      code: 'termination_payload_missing',
      message: 'Kündigungsdaten fehlen.',
      fieldKey: 'termination',
      severity: 'error',
    });
    return;
  }

  if (!payload.effectiveDate?.trim()) {
    issues.push({
      code: 'effective_date_missing',
      message: 'Wirksamkeitsdatum fehlt.',
      fieldKey: 'termination.effective_date',
      severity: 'error',
    });
  }

  if (!payload.terminationDate?.trim()) {
    issues.push({
      code: 'termination_date_missing',
      message: 'Kündigungsdatum fehlt.',
      fieldKey: 'termination.termination_date',
      severity: 'error',
    });
  }

  if (!payload.reasonInternal?.trim()) {
    issues.push({
      code: 'reason_internal_missing',
      message: 'Interne Begründung fehlt.',
      fieldKey: 'termination.reason_internal',
      severity: 'error',
    });
  }

  if (!payload.noticePeriod?.trim()) {
    issues.push({
      code: 'notice_period_missing',
      message: 'Kündigungsfrist fehlt.',
      fieldKey: 'termination.notice_period',
      severity: 'error',
    });
  }
}

function validateReferencePayload(payload: EmployeeReferencePayload | null, issues: TemplateValidationIssue[]): void {
  if (!payload) {
    issues.push({
      code: 'reference_payload_missing',
      message: 'Zeugnisdaten fehlen.',
      fieldKey: 'reference',
      severity: 'error',
    });
    return;
  }

  if (!payload.employmentPeriod?.trim()) {
    issues.push({
      code: 'employment_period_missing',
      message: 'Beschäftigungszeitraum fehlt.',
      fieldKey: 'reference.employment_period',
      severity: 'error',
    });
  }

  if (!payload.roleDescription?.trim()) {
    issues.push({
      code: 'role_description_missing',
      message: 'Tätigkeitsbeschreibung fehlt.',
      fieldKey: 'reference.role_description',
      severity: 'error',
    });
  }

  if (!payload.tasks?.trim()) {
    issues.push({
      code: 'tasks_missing',
      message: 'Aufgaben fehlen.',
      fieldKey: 'reference.tasks',
      severity: 'error',
    });
  }

  if (!payload.performanceAssessment?.trim()) {
    issues.push({
      code: 'performance_assessment_missing',
      message: 'Leistungsbeurteilung fehlt.',
      fieldKey: 'reference.performance_assessment',
      severity: 'error',
    });
  }

  if (!payload.conductAssessment?.trim()) {
    issues.push({
      code: 'conduct_assessment_missing',
      message: 'Verhaltensbeurteilung fehlt.',
      fieldKey: 'reference.conduct_assessment',
      severity: 'error',
    });
  }

  if (!payload.closingFormula?.trim()) {
    issues.push({
      code: 'closing_formula_missing',
      message: 'Schlussformel fehlt.',
      fieldKey: 'reference.closing_formula',
      severity: 'error',
    });
  }
}

function validateReturnProtocolPayload(
  payload: EmployeeReturnProtocolPayload | null,
  issues: TemplateValidationIssue[],
): void {
  if (!payload) {
    issues.push({
      code: 'return_protocol_payload_missing',
      message: 'Protokolldaten fehlen.',
      fieldKey: 'return_protocol',
      severity: 'error',
    });
    return;
  }

  if (!payload.handoverDate?.trim()) {
    issues.push({
      code: 'handover_date_missing',
      message: 'Übergabedatum fehlt.',
      fieldKey: 'return_protocol.handover_date',
      severity: 'error',
    });
  }

  if (!payload.itemsDescription?.trim()) {
    issues.push({
      code: 'items_description_missing',
      message: 'Gegenstände fehlen.',
      fieldKey: 'return_protocol.items_description',
      severity: 'error',
    });
  }

  if (!payload.receivedBy?.trim()) {
    issues.push({
      code: 'received_by_missing',
      message: 'Empfangsbestätigung fehlt.',
      fieldKey: 'return_protocol.received_by',
      severity: 'error',
    });
  }
}

export function validateHrCaseRecord(hrCase: EmployeeHrCase): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (!hrCase.employeeId?.trim()) {
    issues.push({
      code: 'employee_missing',
      message: 'Mitarbeitende:r fehlt.',
      fieldKey: 'employee_id',
      severity: 'error',
    });
  }

  if (hrCase.areaKey === 'dokumentenarchiv_personal') {
    issues.push({
      code: 'archive_not_finalizable',
      message: 'Archivbereich ist keine finalisierbare Vorgangsart.',
      fieldKey: 'area_key',
      severity: 'error',
    });
  }

  if (isConversationArea(hrCase.areaKey)) {
    validateConversationPayload(hrCase.areaKey, hrCase.conversation, issues);
  } else if (isWarningArea(hrCase.areaKey)) {
    validateWarningPayload(hrCase.warning, issues);
  } else if (hrCase.areaKey === 'kuendigung' || hrCase.areaKey === 'aufhebungsvereinbarung') {
    validateTerminationPayload(hrCase.termination, issues);
  } else if (hrCase.areaKey === 'arbeitszeugnis') {
    validateReferencePayload(hrCase.reference, issues);
  } else if (hrCase.areaKey === 'rueckgabe_uebergabeprotokoll') {
    validateReturnProtocolPayload(hrCase.returnProtocol, issues);
  }

  return {
    status: issues.some((i) => i.severity === 'error') ? 'error' : 'valid',
    issues,
  };
}

export function getHrTemplateVersionId(areaKey: EmployeeHrCaseAreaKey): string {
  return HR_TEMPLATE_BY_AREA[areaKey] ?? 'sys-dtpl-023';
}

export function hrCaseToPreviewHtml(hrCase: EmployeeHrCase, employeeName: string): string {
  const title = hrCase.title;
  const parts: string[] = [`<h1>${title}</h1>`, `<p>Mitarbeitende:r: ${employeeName}</p>`];

  if (hrCase.conversation) {
    parts.push(`<p>Termin: ${hrCase.conversation.scheduledAt ?? '—'}</p>`);
    parts.push(`<p>Themen: ${hrCase.conversation.topics}</p>`);
    parts.push(`<p>Zusammenfassung: ${hrCase.conversation.summary}</p>`);
    if (hrCase.conversation.agreements) {
      parts.push(`<p>Vereinbarungen: ${hrCase.conversation.agreements}</p>`);
    }
  }

  if (hrCase.warning) {
    parts.push(`<p>Vorfall am ${hrCase.warning.incidentDate ?? '—'}: ${hrCase.warning.incidentDescription}</p>`);
    parts.push(`<p>Verletzte Pflichten: ${hrCase.warning.breachedDuties}</p>`);
    parts.push(`<p>Erwartetes Verhalten: ${hrCase.warning.expectedBehavior}</p>`);
    parts.push(`<p>Konsequenzen: ${hrCase.warning.consequencesNotice}</p>`);
  }

  if (hrCase.termination) {
    parts.push(`<p>Kündigung zum ${hrCase.termination.effectiveDate ?? '—'}</p>`);
    parts.push(`<p>Frist: ${hrCase.termination.noticePeriod}</p>`);
    parts.push(`<p>Interne Begründung: ${hrCase.termination.reasonInternal}</p>`);
    if (hrCase.termination.propertyReturnDueAt) {
      parts.push(`<p>Rückgabe Firmeneigentum bis: ${hrCase.termination.propertyReturnDueAt}</p>`);
    }
  }

  if (hrCase.reference) {
    parts.push(`<p>Zeitraum: ${hrCase.reference.employmentPeriod}</p>`);
    parts.push(`<p>Tätigkeit: ${hrCase.reference.roleDescription}</p>`);
    parts.push(`<p>Leistung: ${hrCase.reference.performanceAssessment}</p>`);
    parts.push(`<p>Verhalten: ${hrCase.reference.conductAssessment}</p>`);
    parts.push(`<p>${hrCase.reference.closingFormula}</p>`);
  }

  if (hrCase.returnProtocol) {
    parts.push(`<p>Übergabe am ${hrCase.returnProtocol.handoverDate ?? '—'}</p>`);
    parts.push(`<p>Gegenstände: ${hrCase.returnProtocol.itemsDescription}</p>`);
    parts.push(`<p>Empfangen von: ${hrCase.returnProtocol.receivedBy}</p>`);
  }

  return parts.join('\n');
}

export function conversationTypeForArea(areaKey: EmployeeHrCaseAreaKey): EmployeeConversationPayload['conversationType'] {
  switch (areaKey) {
    case 'probezeitgespraech':
      return 'probation';
    case 'kritik_feedbackgespraech':
      return 'feedback';
    case 'zielvereinbarung':
      return 'goal_agreement';
    default:
      return 'general';
  }
}

export function warningTypeForArea(areaKey: EmployeeHrCaseAreaKey): EmployeeWarningPayload['warningType'] {
  return areaKey === 'ermahnung' ? 'admonition' : 'formal_warning';
}

export function terminationTypeForArea(areaKey: EmployeeHrCaseAreaKey): EmployeeTerminationPayload['terminationType'] {
  return areaKey === 'aufhebungsvereinbarung' ? 'mutual_termination' : 'ordinary';
}

export function defaultConversationPayload(
  areaKey: EmployeeHrCaseAreaKey,
  patch?: Partial<EmployeeConversationPayload>,
): EmployeeConversationPayload {
  return {
    conversationType: patch?.conversationType ?? conversationTypeForArea(areaKey),
    scheduledAt: patch?.scheduledAt ?? null,
    participants: patch?.participants ?? [],
    topics: patch?.topics ?? '',
    summary: patch?.summary ?? '',
    agreements: patch?.agreements ?? '',
    nextSteps: patch?.nextSteps ?? '',
    followUpAt: patch?.followUpAt ?? null,
    documentId: patch?.documentId ?? null,
  };
}

export function defaultWarningPayload(
  areaKey: EmployeeHrCaseAreaKey,
  patch?: Partial<EmployeeWarningPayload>,
): EmployeeWarningPayload {
  return {
    warningType: patch?.warningType ?? warningTypeForArea(areaKey),
    incidentDate: patch?.incidentDate ?? null,
    incidentDescription: patch?.incidentDescription ?? '',
    breachedDuties: patch?.breachedDuties ?? '',
    priorDiscussion: patch?.priorDiscussion ?? null,
    expectedBehavior: patch?.expectedBehavior ?? '',
    consequencesNotice: patch?.consequencesNotice ?? '',
    deliveryMethod: patch?.deliveryMethod ?? null,
    deliveredAt: patch?.deliveredAt ?? null,
    acknowledgedAt: patch?.acknowledgedAt ?? null,
    documentId: patch?.documentId ?? null,
  };
}

export function defaultTerminationPayload(
  areaKey: EmployeeHrCaseAreaKey,
  patch?: Partial<EmployeeTerminationPayload>,
): EmployeeTerminationPayload {
  return {
    terminationType: patch?.terminationType ?? terminationTypeForArea(areaKey),
    terminationDate: patch?.terminationDate ?? null,
    effectiveDate: patch?.effectiveDate ?? null,
    reasonInternal: patch?.reasonInternal ?? '',
    noticePeriod: patch?.noticePeriod ?? '',
    probationPeriod: patch?.probationPeriod ?? false,
    propertyReturnDueAt: patch?.propertyReturnDueAt ?? null,
    returnProtocolCaseId: patch?.returnProtocolCaseId ?? null,
    portalBlockAt: patch?.portalBlockAt ?? null,
    finalPayrollCheckStatus: patch?.finalPayrollCheckStatus ?? 'pending',
    documentId: patch?.documentId ?? null,
  };
}

export function defaultReferencePayload(patch?: Partial<EmployeeReferencePayload>): EmployeeReferencePayload {
  return {
    referenceType: patch?.referenceType ?? 'simple',
    employmentPeriod: patch?.employmentPeriod ?? '',
    roleDescription: patch?.roleDescription ?? '',
    tasks: patch?.tasks ?? '',
    performanceAssessment: patch?.performanceAssessment ?? '',
    conductAssessment: patch?.conductAssessment ?? '',
    closingFormula: patch?.closingFormula ?? '',
    gradeInternal: patch?.gradeInternal ?? null,
    documentId: patch?.documentId ?? null,
  };
}

export function defaultReturnProtocolPayload(
  patch?: Partial<EmployeeReturnProtocolPayload>,
): EmployeeReturnProtocolPayload {
  return {
    handoverDate: patch?.handoverDate ?? null,
    itemsDescription: patch?.itemsDescription ?? '',
    conditionNotes: patch?.conditionNotes ?? '',
    receivedBy: patch?.receivedBy ?? '',
    linkedTerminationCaseId: patch?.linkedTerminationCaseId ?? null,
    documentId: patch?.documentId ?? null,
  };
}

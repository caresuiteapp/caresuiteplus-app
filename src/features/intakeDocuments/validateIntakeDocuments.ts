import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  ASSIGNMENT_TEMPLATE_KEY,
  PRIVACY_TEMPLATE_KEY,
  type IntakeDocumentState,
  type IntakeDocumentTemplate,
} from './intakeDocumentTypes';
import { resolveContractTemplateKey } from './buildIntakeDocumentContext';

export type IntakeDocumentsValidation = {
  ok: boolean;
  errors: Record<string, string>;
  checklist: { key: string; label: string; complete: boolean }[];
};

function docByKey(documents: IntakeDocumentState[], templateKey: string): IntakeDocumentState | undefined {
  return documents.find((d) => d.templateKey === templateKey);
}

function isDocComplete(doc: IntakeDocumentState | undefined, template: IntakeDocumentTemplate | undefined): boolean {
  if (!doc || !template) return false;
  if (doc.status === 'skipped_optional') return true;
  if (doc.status !== 'finalized') return false;
  if (doc.missingPlaceholders.length > 0) return false;

  for (const slot of template.signatureSlots) {
    if (slot.required && !doc.signatures[slot.role]?.dataUrl) {
      return false;
    }
  }
  return true;
}

export function validateIntakeDocumentsStep(
  form: ClientIntakeFormData,
  templates: IntakeDocumentTemplate[],
): IntakeDocumentsValidation {
  const errors: Record<string, string> = {};
  const checklist: IntakeDocumentsValidation['checklist'] = [];

  const privacyTemplate = templates.find((t) => t.templateKey === PRIVACY_TEMPLATE_KEY);
  const privacyDoc = docByKey(form.intakeDocuments, PRIVACY_TEMPLATE_KEY);
  const privacyOk = isDocComplete(privacyDoc, privacyTemplate);
  checklist.push({
    key: 'privacy',
    label: 'Datenschutz-Einwilligung abgeschlossen',
    complete: privacyOk,
  });
  if (!privacyOk) {
    errors.intakePrivacy = 'Datenschutz-Einwilligung muss gelesen, unterschrieben und abgeschlossen werden.';
  }

  const contractKey = resolveContractTemplateKey(form);
  const contractTemplate = contractKey
    ? templates.find((t) => t.templateKey === contractKey)
    : undefined;
  const contractDoc = contractKey ? docByKey(form.intakeDocuments, contractKey) : undefined;
  const contractOk = isDocComplete(contractDoc, contractTemplate);
  checklist.push({
    key: 'contract',
    label: 'Kundenvertrag abgeschlossen (Klient:in + Mitarbeitende:r)',
    complete: contractOk,
  });
  if (!contractOk) {
    errors.intakeContract = 'Kundenvertrag muss vollständig eingesehen, unterschrieben und abgeschlossen werden.';
  }

  if (form.intakeAssignmentEnabled) {
    const assignmentTemplate = templates.find((t) => t.templateKey === ASSIGNMENT_TEMPLATE_KEY);
    const assignmentDoc = docByKey(form.intakeDocuments, ASSIGNMENT_TEMPLATE_KEY);
    const assignmentOk = isDocComplete(assignmentDoc, assignmentTemplate);
    checklist.push({
      key: 'assignment',
      label: 'Abtretungserklärung abgeschlossen',
      complete: assignmentOk,
    });
    if (!assignmentOk) {
      errors.intakeAssignment = 'Abtretungserklärung ist aktiviert und muss abgeschlossen werden.';
    }
  } else {
    checklist.push({
      key: 'assignment',
      label: 'Abtretungserklärung (optional, deaktiviert)',
      complete: true,
    });
  }

  for (const key of form.intakeOptionalConsents) {
    const template = templates.find((t) => t.templateKey === key);
    const doc = docByKey(form.intakeDocuments, key);
    const ok = isDocComplete(doc, template);
    checklist.push({
      key: `optional-${key}`,
      label: `${template?.title ?? key} abgeschlossen`,
      complete: ok,
    });
    if (!ok) {
      errors[`intakeOptional_${key}`] = `${template?.title ?? 'Zusatz-Einwilligung'} muss abgeschlossen werden.`;
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    checklist,
  };
}

export function canProceedFromIntakeDocuments(
  form: ClientIntakeFormData,
  templates: IntakeDocumentTemplate[],
): boolean {
  return validateIntakeDocumentsStep(form, templates).ok;
}

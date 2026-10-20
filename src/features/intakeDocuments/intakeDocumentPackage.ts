import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { buildIntakePlaceholderContext, listApplicableIntakeTemplates, type IntakeTenantDisplay } from './buildIntakeDocumentContext';
import { applyDocumentSignature, finalizeDocument, openDocumentPreview, updateIntakeDocumentInForm } from './intakeDocumentService';
import type { IntakeDocumentSignature, IntakeDocumentState, IntakeDocumentTemplate, IntakeSignatureRole } from './intakeDocumentTypes';
import { hasIntakeRenderBinding, INTAKE_ORIGINAL_CHANGED_ERROR } from './intakeDocumentRenderBinding';
import { hasCollectedIntakeOriginal } from './restartIntakeDocumentReview';
import { finalizeIntakeDocumentHtml } from './renderIntakeDocumentPreview';

export const INTAKE_SIGNATURE_ROLE_LABELS: Record<IntakeSignatureRole, string> = {
  client: 'Klient:in', employee: 'Mitarbeitende:r', legal_representative: 'Vertretung',
};
export type PackageIssue = { title: string; message: string; templateKey?: string; missingKeys?: string[] };
export type IntakeDocumentPackage = {
  form: ClientIntakeFormData;
  documents: IntakeDocumentState[];
  roles: IntakeSignatureRole[];
  issues: PackageIssue[];
};

export function changeIntakeDocumentSelection(form: ClientIntakeFormData, selection: Partial<Pick<ClientIntakeFormData,
  'intakeContractType' | 'intakeAssignmentEnabled' | 'intakeOptionalConsents'>>): ClientIntakeFormData {
  const next = { ...form, ...selection };
  const keys = new Set(listApplicableIntakeTemplates(next).map(template => template.templateKey));
  const removed = form.intakeDocuments.filter(document => !keys.has(document.templateKey) && hasCollectedIntakeOriginal(document));
  const history = [...(form.intakeDocumentHistory ?? []), ...removed];
  if (history.length > 64) throw new Error('Zu viele frühere Dokumentfassungen. Bitte die Aufnahme zuerst sichern.');
  const documents = form.intakeDocuments.filter(document => keys.has(document.templateKey));
  return { ...next, intakeDocuments: documents, intakeDocumentHistory: history,
    consentDatenschutz: documents.some(document => document.documentType === 'privacy_consent' && document.status === 'finalized'),
    consentVertrag: documents.some(document => document.documentType === 'client_contract' && document.status === 'finalized') };
}

/** Freeze the exact selected originals that the shared preview will display. */
export function prepareIntakeDocumentPackage(
  form: ClientIntakeFormData, templates: IntakeDocumentTemplate[], tenant?: IntakeTenantDisplay,
): IntakeDocumentPackage {
  let next = form;
  const documents: IntakeDocumentState[] = [];
  const roles = new Set<IntakeSignatureRole>();
  const issues: PackageIssue[] = [];
  const selectedTemplates = listApplicableIntakeTemplates(form, templates);
  if (!selectedTemplates.some(template => template.documentType === 'client_contract')) {
    issues.push({ title: 'Vertragsart', message: 'Bitte zuerst eine passende Vertragsart auswählen.' });
  }
  for (const template of selectedTemplates) {
    const document = openDocumentPreview(next, template, tenant);
    next = updateIntakeDocumentInForm(next, document);
    documents.push(document);
    const signatureLabels = new Set(Object.entries(template.placeholderSchema)
      .filter(([key]) => key.startsWith('signature.')).map(([, meta]) => meta.label));
    const missing = document.missingPlaceholders.filter(label => !signatureLabels.has(label) && !label.startsWith('Unterschrift '));
    if (missing.length) issues.push({ title: template.title, message: missing.join(', '), templateKey: template.templateKey,
      missingKeys: Object.entries(template.placeholderSchema)
        .filter(([key, meta]) => !key.startsWith('signature.') && meta.required && missing.includes(meta.label || key))
        .map(([key]) => key) });
    if (document.status === 'finalized') {
      if (hasIntakeRenderBinding(document) && document.finalizedAt && (
        document.version !== template.version || document.source !== template.source
        || (document.tenantTemplateId ?? null) !== (template.tenantTemplateId ?? null)
        || finalizeIntakeDocumentHtml(template, buildIntakePlaceholderContext(form, tenant, { renderedAt: document.renderedAt }),
          document.signatures, document.finalizedAt).html !== document.finalizedHtml
      )) issues.push({ title: template.title, message: INTAKE_ORIGINAL_CHANGED_ERROR });
      continue;
    }
    for (const slot of template.signatureSlots) {
      if (slot.required && !document.signatures[slot.role]?.dataUrl) roles.add(slot.role);
    }
    // A configured field must actually exist; otherwise a capture could be
    // recorded without appearing anywhere in the signed original.
    for (const slot of template.signatureSlots.filter(slot => slot.required)) {
      if (!template.htmlContent.includes(slot.placeholder)) issues.push({ title: template.title,
        message: `Das Unterschriftsfeld für ${INTAKE_SIGNATURE_ROLE_LABELS[slot.role]} fehlt in der Vorlage. Bitte die Vorlage korrigieren.` });
    }
    const declaredRoles: [IntakeSignatureRole, boolean][] = [['client', template.requiresClientSignature],
      ['employee', template.requiresEmployeeSignature], ['legal_representative', template.requiresRepresentativeSignature]];
    for (const [role, required] of declaredRoles) {
      if (required && !template.signatureSlots.some(slot => slot.role === role && slot.required)) {
        issues.push({ title: template.title, message: `Das erforderliche Unterschriftsfeld für ${INTAKE_SIGNATURE_ROLE_LABELS[role]} ist nicht korrekt eingerichtet.` });
      }
    }
  }
  return { form: next, documents, roles: (['client', 'employee', 'legal_representative'] as const).filter(role => roles.has(role)), issues };
}

/** No partial package is committed if a role, field, selection or original changed. */
export function signIntakeDocumentPackage(
  form: ClientIntakeFormData, templates: IntakeDocumentTemplate[], reviewed: IntakeDocumentState[],
  signatures: Partial<Record<IntakeSignatureRole, IntakeDocumentSignature>>, tenant?: IntakeTenantDisplay,
): { ok: true; form: ClientIntakeFormData } | { ok: false; issues: PackageIssue[] } {
  const prepared = prepareIntakeDocumentPackage(form, templates, tenant);
  const fail = (message: string) => ({ ok: false as const, issues: [{ title: 'Dokumentenpaket', message }] });
  if (prepared.issues.length) return { ok: false, issues: prepared.issues };
  if (!reviewed.length || prepared.documents.length !== reviewed.length || prepared.documents.some((document, index) => {
    const prior = reviewed[index];
    return document.templateKey !== prior.templateKey || document.version !== prior.version || document.source !== prior.source
      || document.tenantTemplateId !== prior.tenantTemplateId || document.previewHtml !== prior.previewHtml
      || document.renderedAt !== prior.renderedAt || JSON.stringify(document.signatures) !== JSON.stringify(prior.signatures);
  })) return fail(INTAKE_ORIGINAL_CHANGED_ERROR);
  if (prepared.roles.some(role => !signatures[role]?.dataUrl)) return fail('Bitte alle angezeigten Unterschriften erfassen.');
  let next = prepared.form;
  for (const template of listApplicableIntakeTemplates(form, templates)) {
    let document = next.intakeDocuments.find(item => item.templateKey === template.templateKey)!;
    if (document.status === 'finalized') continue;
    for (const slot of template.signatureSlots) {
      if (document.signatures[slot.role]?.dataUrl || !signatures[slot.role]) continue;
      document = applyDocumentSignature(document, template, next, slot.role, signatures[slot.role]!, tenant);
      next = updateIntakeDocumentInForm(next, document);
    }
    const finalized = finalizeDocument(document, template, next, tenant);
    if (!finalized.ok) return { ok: false, issues: [{ title: template.title, message: finalized.error }] };
    next = updateIntakeDocumentInForm(next, finalized.document);
  }
  return { ok: true, form: next };
}

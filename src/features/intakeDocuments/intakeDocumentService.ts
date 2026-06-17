import type { ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  buildIntakePlaceholderContext,
  listApplicableIntakeTemplates,
  resolveIntakeContractType,
  type IntakeTenantDisplay,
} from './buildIntakeDocumentContext';
import {
  finalizeIntakeDocumentHtml,
  renderIntakeDocumentHtml,
} from './renderIntakeDocumentPreview';
import { getSystemIntakeTemplateByKey } from './intakeDocumentSystemTemplates';
import {
  listTenantIntakeDocumentTemplates,
  persistIntakeDocumentsForClient,
} from './intakeDocumentRepository';
import type {
  IntakeDocumentSignature,
  IntakeDocumentState,
  IntakeDocumentTemplate,
  IntakeSignatureRole,
} from './intakeDocumentTypes';

export function createInitialDocumentState(template: IntakeDocumentTemplate): IntakeDocumentState {
  return {
    templateKey: template.templateKey,
    documentType: template.documentType,
    title: template.title,
    isRequired: template.isRequired,
    status: 'not_started',
    source: template.source,
    tenantTemplateId: template.tenantTemplateId ?? null,
    version: template.version,
    missingPlaceholders: [],
    unresolvedKeys: [],
    previewHtml: null,
    finalizedHtml: null,
    renderedPdfPath: null,
    signatures: {},
    previewOpenedAt: null,
    finalizedAt: null,
  };
}

export function syncIntakeDocumentsWithTemplates(
  form: ClientIntakeFormData,
  templates: IntakeDocumentTemplate[],
): IntakeDocumentState[] {
  const existing = new Map(form.intakeDocuments.map((d) => [d.templateKey, d]));
  return templates.map((template) => {
    const prev = existing.get(template.templateKey);
    if (prev) {
      return {
        ...prev,
        title: template.title,
        isRequired: template.isRequired || template.documentType === 'privacy_consent' || template.documentType === 'client_contract',
        documentType: template.documentType,
        version: template.version,
        source: template.source,
        tenantTemplateId: template.tenantTemplateId ?? null,
      };
    }
    return createInitialDocumentState(template);
  });
}

export function openDocumentPreview(
  form: ClientIntakeFormData,
  template: IntakeDocumentTemplate,
  tenantDisplay?: IntakeTenantDisplay,
): IntakeDocumentState {
  const context = buildIntakePlaceholderContext(form, tenantDisplay);
  const existing = form.intakeDocuments.find((d) => d.templateKey === template.templateKey);
  const signatures = existing?.signatures ?? {};
  const preview = renderIntakeDocumentHtml(template, context, signatures);

  return {
    ...(existing ?? createInitialDocumentState(template)),
    status: 'preview_open',
    previewHtml: preview.html,
    missingPlaceholders: preview.missingPlaceholders,
    unresolvedKeys: preview.unresolvedKeys,
    previewOpenedAt: new Date().toISOString(),
  };
}

export function applyDocumentSignature(
  doc: IntakeDocumentState,
  template: IntakeDocumentTemplate,
  form: ClientIntakeFormData,
  role: IntakeSignatureRole,
  signature: IntakeDocumentSignature,
  tenantDisplay?: IntakeTenantDisplay,
): IntakeDocumentState {
  const signatures = { ...doc.signatures, [role]: signature };
  const context = buildIntakePlaceholderContext(form, tenantDisplay);
  const preview = renderIntakeDocumentHtml(template, context, signatures);
  const allRequiredSigned = template.signatureSlots
    .filter((s) => s.required)
    .every((s) => signatures[s.role]?.dataUrl);

  return {
    ...doc,
    signatures,
    previewHtml: preview.html,
    missingPlaceholders: preview.missingPlaceholders,
    unresolvedKeys: preview.unresolvedKeys,
    status: allRequiredSigned ? 'signed' : 'pending_signature',
  };
}

export function finalizeDocument(
  doc: IntakeDocumentState,
  template: IntakeDocumentTemplate,
  form: ClientIntakeFormData,
  tenantDisplay?: IntakeTenantDisplay,
): { ok: true; document: IntakeDocumentState } | { ok: false; error: string } {
  if (doc.missingPlaceholders.length > 0) {
    return { ok: false, error: 'Pflichtangaben fehlen — bitte vorherige Schritte vervollständigen.' };
  }

  for (const slot of template.signatureSlots) {
    if (slot.required && !doc.signatures[slot.role]?.dataUrl) {
      return { ok: false, error: 'Erforderliche Unterschrift fehlt.' };
    }
  }

  const context = buildIntakePlaceholderContext(form, tenantDisplay);
  const finalized = finalizeIntakeDocumentHtml(template, context, doc.signatures);
  const now = new Date().toISOString();

  return {
    ok: true,
    document: {
      ...doc,
      status: 'finalized',
      finalizedHtml: finalized.html,
      previewHtml: finalized.html,
      finalizedAt: now,
      renderedPdfPath: null,
    },
  };
}

export function skipOptionalDocument(doc: IntakeDocumentState): IntakeDocumentState {
  return { ...doc, status: 'skipped_optional', finalizedAt: new Date().toISOString() };
}

export async function loadIntakeDocumentTemplates(
  tenantId: string,
  form: ClientIntakeFormData,
): Promise<ServiceResult<IntakeDocumentTemplate[]>> {
  if (getServiceMode() === 'supabase') {
    const remote = await listTenantIntakeDocumentTemplates(tenantId);
    if (!remote.ok) return remote;
    return { ok: true, data: listApplicableIntakeTemplates(form, remote.data) };
  }

  return { ok: true, data: listApplicableIntakeTemplates(form) };
}

export async function persistClientIntakeDocuments(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: undefined };
  }
  return persistIntakeDocumentsForClient(tenantId, clientId, form, actorProfileId);
}

export function resolveDefaultContractType(form: ClientIntakeFormData): string | null {
  return resolveIntakeContractType(form);
}

export function getTemplateForDocument(
  templates: IntakeDocumentTemplate[],
  templateKey: string,
): IntakeDocumentTemplate | undefined {
  return templates.find((t) => t.templateKey === templateKey)
    ?? getSystemIntakeTemplateByKey(templateKey);
}

export function updateIntakeDocumentInForm(
  form: ClientIntakeFormData,
  updated: IntakeDocumentState,
): ClientIntakeFormData {
  const docs = form.intakeDocuments.some((d) => d.templateKey === updated.templateKey)
    ? form.intakeDocuments.map((d) => (d.templateKey === updated.templateKey ? updated : d))
    : [...form.intakeDocuments, updated];

  const privacyFinalized = docs.some(
    (d) => d.templateKey === 'privacy_consent_default' && d.status === 'finalized',
  );
  const contractFinalized = docs.some(
    (d) => d.documentType === 'client_contract' && d.status === 'finalized',
  );

  return {
    ...form,
    intakeDocuments: docs,
    consentDatenschutz: privacyFinalized,
    consentVertrag: contractFinalized,
  };
}

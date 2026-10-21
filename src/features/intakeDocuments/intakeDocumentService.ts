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
import { INTAKE_PAPER_CONTRACT_NOTICE } from './intake2027Context';
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
import {
  getIntakeRenderBindingError, hasIntakeRenderBinding, INTAKE_ORIGINAL_CHANGED_ERROR,
  INTAKE_RENDER_VERSION, isIntakeRenderTimestamp, isSafeIntakeSignatureDataUrl,
} from './intakeDocumentRenderBinding';

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
      // A new template may change an unsigned draft. It cannot relabel an
      // existing signature as approval of a different template or version.
      if (hasDocumentOriginal(prev)) return prev;
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

const ORIGINAL_CHANGED_ERROR = INTAKE_ORIGINAL_CHANGED_ERROR;

function hasDocumentSignature(doc: IntakeDocumentState): boolean {
  return Object.values(doc.signatures).some(signature => Boolean(signature?.dataUrl));
}

function hasDocumentOriginal(doc: IntakeDocumentState): boolean {
  return doc.status === 'finalized' || doc.status === 'signed' || Boolean(doc.finalizedHtml) || hasDocumentSignature(doc);
}

function matchesSignedOriginal(
  doc: IntakeDocumentState,
  template: IntakeDocumentTemplate,
  form: ClientIntakeFormData,
  tenantDisplay?: IntakeTenantDisplay,
): boolean {
  return hasIntakeRenderBinding(doc) && doc.templateKey === template.templateKey && doc.version === template.version
    && doc.source === template.source && (doc.tenantTemplateId ?? null) === (template.tenantTemplateId ?? null)
    && Boolean(doc.previewHtml)
    && renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form, tenantDisplay, { renderedAt: doc.renderedAt }), doc.signatures).html === doc.previewHtml;
}

export function openDocumentPreview(
  form: ClientIntakeFormData,
  template: IntakeDocumentTemplate,
  tenantDisplay?: IntakeTenantDisplay,
): IntakeDocumentState {
  const existing = form.intakeDocuments.find((d) => d.templateKey === template.templateKey);

  // Reading a locked document must not reopen it. Previously the "Dokument
  // ansehen" action downgraded finalized documents to `preview_open`: their
  // signatures were still visible, but intake validation marked the contracts
  // step as erroneous and blocked the final client save.
  if (existing?.status === 'finalized') {
    const bindingError = getIntakeRenderBindingError(existing);
    return {
      ...existing,
      previewHtml: existing.finalizedHtml ?? existing.previewHtml,
      ...(bindingError ? { missingPlaceholders: [bindingError] } : {}),
    };
  }

  if (existing && hasDocumentOriginal(existing)) {
    return matchesSignedOriginal(existing, template, form, tenantDisplay)
      ? existing
      : { ...existing, missingPlaceholders: [getIntakeRenderBindingError(existing) ?? ORIGINAL_CHANGED_ERROR] };
  }

  const renderedAt = existing && hasIntakeRenderBinding(existing) ? existing.renderedAt : new Date().toISOString();
  const context = buildIntakePlaceholderContext(form, tenantDisplay, { renderedAt });
  const signatures = existing?.signatures ?? {};
  const preview = renderIntakeDocumentHtml(template, context, signatures);

  return {
    ...(existing ?? createInitialDocumentState(template)),
    title: template.title,
    version: template.version,
    source: template.source,
    tenantTemplateId: template.tenantTemplateId ?? null,
    renderVersion: INTAKE_RENDER_VERSION,
    renderedAt,
    status: 'preview_open',
    previewHtml: preview.html,
    missingPlaceholders: preview.missingPlaceholders,
    unresolvedKeys: preview.unresolvedKeys,
    previewOpenedAt: existing?.previewOpenedAt ?? renderedAt,
  };
}

/**
 * Finishes an unchanged signed preview. An unbound legacy signature or a
 * changed form/template requires renewed review instead of content repair.
 */
export function finalizeReadyIntakeDocuments(
  form: ClientIntakeFormData,
  templates: IntakeDocumentTemplate[],
  tenantDisplay?: IntakeTenantDisplay,
): ClientIntakeFormData {
  let nextForm = form;

  for (const template of templates) {
    const doc = nextForm.intakeDocuments.find(
      (item) => item.templateKey === template.templateKey,
    );
    if (!doc || doc.status === 'finalized' || doc.status === 'skipped_optional') continue;
    const bindingError = getIntakeRenderBindingError(doc);
    if (hasDocumentOriginal(doc) && bindingError) {
      if (!doc.missingPlaceholders.includes(bindingError)) nextForm = updateIntakeDocumentInForm(nextForm, { ...doc, missingPlaceholders: [bindingError] });
      continue;
    }
    if (!matchesSignedOriginal(doc, template, nextForm, tenantDisplay)) continue;

    const allRequiredSigned = template.signatureSlots
      .filter((slot) => slot.required)
      .every((slot) => Boolean(doc.signatures[slot.role]?.dataUrl));
    if (!allRequiredSigned) continue;

    const context = buildIntakePlaceholderContext(nextForm, tenantDisplay, { renderedAt: doc.renderedAt! });
    const preview = renderIntakeDocumentHtml(template, context, doc.signatures);
    if (preview.missingPlaceholders.length > 0) continue;

    const finalizedAt = doc.finalizedAt ?? new Date().toISOString();
    const finalized = finalizeIntakeDocumentHtml(template, context, doc.signatures, finalizedAt);
    nextForm = updateIntakeDocumentInForm(nextForm, {
      ...doc,
      status: 'finalized',
      previewHtml: finalized.html,
      finalizedHtml: finalized.html,
      missingPlaceholders: preview.missingPlaceholders,
      unresolvedKeys: preview.unresolvedKeys,
      finalizedAt,
      renderedPdfPath: null,
    });
  }

  return nextForm;
}

export function applyDocumentSignature(
  doc: IntakeDocumentState,
  template: IntakeDocumentTemplate,
  form: ClientIntakeFormData,
  role: IntakeSignatureRole,
  signature: IntakeDocumentSignature,
  tenantDisplay?: IntakeTenantDisplay,
): IntakeDocumentState {
  if (form.intakeTemplateEdition === '2027' && template.templateKey === 'client_contract_stationary_care') return { ...doc, missingPlaceholders: [INTAKE_PAPER_CONTRACT_NOTICE] };
  if (doc.status === 'finalized') return doc;
  const bindingError = getIntakeRenderBindingError(doc);
  if (bindingError) return { ...doc, missingPlaceholders: [bindingError] };
  if (!matchesSignedOriginal(doc, template, form, tenantDisplay)) {
    return { ...doc, missingPlaceholders: [ORIGINAL_CHANGED_ERROR] };
  }
  if (!template.signatureSlots.some(slot => slot.role === role) || signature.role !== role) {
    return { ...doc, missingPlaceholders: ['Diese Unterschriftsrolle gehört nicht zu diesem Dokument.'] };
  }
  if (!isSafeIntakeSignatureDataUrl(signature.dataUrl) || !isIntakeRenderTimestamp(signature.signedAt)) {
    return { ...doc, missingPlaceholders: ['Die Unterschrift oder ihr Zeitpunkt ist ungültig. Bitte erneut unterschreiben.'] };
  }
  const previousSignature = doc.signatures[role];
  if (previousSignature?.dataUrl) {
    return previousSignature.dataUrl === signature.dataUrl && previousSignature.signedAt === signature.signedAt
      && previousSignature.role === signature.role && (previousSignature.signerName ?? null) === (signature.signerName ?? null)
      ? doc : { ...doc, missingPlaceholders: [ORIGINAL_CHANGED_ERROR] };
  }
  const signatureLabels = new Set(Object.entries(template.placeholderSchema)
    .filter(([key]) => key.startsWith('signature.')).map(([, meta]) => meta.label));
  const context = buildIntakePlaceholderContext(form, tenantDisplay, { renderedAt: doc.renderedAt! });
  const unsignedPreview = renderIntakeDocumentHtml(template, context, doc.signatures);
  const missingData = unsignedPreview.missingPlaceholders.filter(label =>
    !signatureLabels.has(label) && !label.startsWith('Unterschrift '));
  if (missingData.length > 0) return { ...doc, missingPlaceholders: missingData };
  const signatures = { ...doc.signatures, [role]: signature };
  const preview = renderIntakeDocumentHtml(template, context, signatures);
  const allRequiredSigned = template.signatureSlots
    .filter((s) => s.required)
    .every((s) => signatures[s.role]?.dataUrl);

  // Once the last required signature exists, there is no useful intermediate
  // state left. Finalize and lock immediately so validation and persistence see
  // the same state that the UI communicates to the user.
  if (allRequiredSigned && preview.missingPlaceholders.length === 0) {
    const finalizedAt = new Date().toISOString();
    const finalized = finalizeIntakeDocumentHtml(template, context, signatures, finalizedAt);

    return {
      ...doc,
      signatures,
      previewHtml: finalized.html,
      finalizedHtml: finalized.html,
      missingPlaceholders: preview.missingPlaceholders,
      unresolvedKeys: preview.unresolvedKeys,
      status: 'finalized',
      finalizedAt,
      renderedPdfPath: null,
    };
  }

  return {
    ...doc,
    signatures,
    previewHtml: preview.html,
    missingPlaceholders: preview.missingPlaceholders,
    unresolvedKeys: preview.unresolvedKeys,
    status: allRequiredSigned ? 'signed' : 'pending_signature',
  };
}

export type SharedClientSignatureResult = {
  form: ClientIntakeFormData;
  signedTemplateKeys: string[];
  finalizedTemplateKeys: string[];
  pendingTemplateKeys: string[];
  errors: { templateKey: string; title: string; error: string }[];
};

/**
 * Applies one client signature to every selected intake document.
 *
 * The very same signature payload and timestamp are used for every document.
 * Documents that require an additional employee/representative signature stay
 * signed but open until those additional signatures have been supplied.
 */
export function applySharedClientSignatureToDocuments(
  form: ClientIntakeFormData,
  templates: IntakeDocumentTemplate[],
  selectedTemplateKeys: string[],
  dataUrl: string,
  tenantDisplay?: IntakeTenantDisplay,
  signedAt = new Date().toISOString(),
): SharedClientSignatureResult {
  const selectedKeys = new Set(selectedTemplateKeys);
  const signature: IntakeDocumentSignature = {
    role: 'client',
    dataUrl,
    signedAt,
  };
  let nextForm = form;
  const signedTemplateKeys: string[] = [];
  const finalizedTemplateKeys: string[] = [];
  const pendingTemplateKeys: string[] = [];
  const errors: SharedClientSignatureResult['errors'] = [];

  for (const template of templates) {
    if (!selectedKeys.has(template.templateKey)) continue;
    if (!template.signatureSlots.some((slot) => slot.role === 'client')) {
      errors.push({
        templateKey: template.templateKey,
        title: template.title,
        error: 'Dieses Dokument enthält kein Feld für die Klienten-Unterschrift.',
      });
      continue;
    }

    const opened = openDocumentPreview(nextForm, template, tenantDisplay);
    const signatureLabels = new Set(
      Object.entries(template.placeholderSchema)
        .filter(([key]) => key.startsWith('signature.'))
        .map(([, meta]) => meta.label),
    );
    const missingDocumentData = opened.missingPlaceholders.filter(
      (label) => !signatureLabels.has(label) && !label.startsWith('Unterschrift '),
    );
    if (missingDocumentData.length > 0) {
      nextForm = updateIntakeDocumentInForm(nextForm, opened);
      errors.push({
        templateKey: template.templateKey,
        title: template.title,
        error: `Pflichtangaben fehlen: ${missingDocumentData.join(', ')}`,
      });
      continue;
    }

    const signed = applyDocumentSignature(
      opened,
      template,
      nextForm,
      'client',
      signature,
      tenantDisplay,
    );
    if (signed.signatures.client !== signature) {
      if (signed.status === 'finalized') {
        finalizedTemplateKeys.push(template.templateKey);
      } else {
        errors.push({ templateKey: template.templateKey, title: template.title,
          error: signed.missingPlaceholders.join(', ') || ORIGINAL_CHANGED_ERROR });
      }
      nextForm = updateIntakeDocumentInForm(nextForm, signed);
      continue;
    }
    signedTemplateKeys.push(template.templateKey);

    const finalized = finalizeDocument(signed, template, nextForm, tenantDisplay);
    if (finalized.ok) {
      nextForm = updateIntakeDocumentInForm(nextForm, finalized.document);
      finalizedTemplateKeys.push(template.templateKey);
    } else {
      nextForm = updateIntakeDocumentInForm(nextForm, signed);
      pendingTemplateKeys.push(template.templateKey);
    }
  }

  return {
    form: nextForm,
    signedTemplateKeys,
    finalizedTemplateKeys,
    pendingTemplateKeys,
    errors,
  };
}

export function finalizeDocument(
  doc: IntakeDocumentState,
  template: IntakeDocumentTemplate,
  form: ClientIntakeFormData,
  tenantDisplay?: IntakeTenantDisplay,
): { ok: true; document: IntakeDocumentState } | { ok: false; error: string } {
  const bindingError = getIntakeRenderBindingError(doc);
  if (bindingError) return { ok: false, error: bindingError };
  if (doc.status === 'finalized' && doc.finalizedHtml && doc.finalizedAt) {
    return { ok: true, document: doc };
  }
  if (!matchesSignedOriginal(doc, template, form, tenantDisplay)) {
    return { ok: false, error: ORIGINAL_CHANGED_ERROR };
  }
  if (doc.missingPlaceholders.length > 0) {
    return { ok: false, error: 'Pflichtangaben fehlen — bitte vorherige Schritte vervollständigen.' };
  }

  for (const slot of template.signatureSlots) {
    if (slot.required && !doc.signatures[slot.role]?.dataUrl) {
      return { ok: false, error: 'Erforderliche Unterschrift fehlt.' };
    }
  }

  const now = new Date().toISOString();
  const context = buildIntakePlaceholderContext(form, tenantDisplay, { renderedAt: doc.renderedAt! });
  const finalized = finalizeIntakeDocumentHtml(template, context, doc.signatures, now);
  if (finalized.missingPlaceholders.length) return { ok: false, error: 'Pflichtangaben oder gültige Unterschriften fehlen.' };

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
  if (hasDocumentOriginal(doc)) return doc;
  return { ...doc, status: 'skipped_optional', finalizedAt: new Date().toISOString() };
}

export async function loadIntakeDocumentTemplates(
  tenantId: string,
  form: ClientIntakeFormData,
): Promise<ServiceResult<IntakeDocumentTemplate[]>> {
  if (getServiceMode() === 'supabase') {
    const remote = await listTenantIntakeDocumentTemplates(tenantId, form.intakeTemplateEdition);
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

import type { RoleKey } from '@/types';
import type {
  DocumentActionGateContext,
  DocumentActionGateCode,
  DocumentActionGateResult,
  DocumentActionKey,
  DocumentGateDocument,
  DocumentGateTemplate,
} from '@/types/documents/documentActionGate';
import { extractPlaceholders } from '@/features/documents/templateEngine/extractPlaceholders';
import { validateKnownPlaceholders } from '@/features/documents/templateEngine/validateTemplate';
import { isDemoMode } from '@/lib/supabase/config';
import { getServiceMode } from '@/lib/services/mode';
import { validateContractRecord } from './contractValidation';
import { validateDocumentationRecord } from './documentationValidation';
import { calculateInvoiceTax } from './invoiceTaxLogic';
import { validateInvoiceRecord } from './invoiceValidation';
import { validateServiceProofForSignature, validateServiceProofRecord } from './serviceProofValidation';

function deny(
  code: DocumentActionGateCode,
  message: string,
  validation?: DocumentActionGateResult['validation'],
): DocumentActionGateResult {
  return { allowed: false, code, message, validation: validation ?? undefined };
}

function allow(validation?: DocumentActionGateResult['validation']): DocumentActionGateResult {
  return { allowed: true, validation: validation ?? undefined };
}

function isDocumentLocked(document: DocumentGateDocument | null): boolean {
  if (!document) return false;
  return Boolean(document.lockedAt) || document.status === 'finalized' || document.status === 'archived';
}

function isDocumentArchived(document: DocumentGateDocument | null): boolean {
  return document?.status === 'archived';
}

function isTemplateArchived(template: DocumentGateTemplate | null): boolean {
  return template?.versionStatus === 'archived' || template?.templateStatus === 'archived';
}

function assertAuth(context: DocumentActionGateContext): DocumentActionGateResult | null {
  if (!context.userId?.trim()) {
    return deny('missing_user', 'Anmeldung erforderlich — Dokumentaktion blockiert.');
  }
  if (!context.tenantId?.trim()) {
    return deny('missing_tenant', 'Mandant fehlt — Dokumentaktion blockiert.');
  }
  if (!context.role) {
    return deny('missing_role', 'Rolle fehlt — Dokumentaktion blockiert.');
  }
  return null;
}

function assertTenantScope(context: DocumentActionGateContext): DocumentActionGateResult | null {
  if (context.documentTenantId && context.documentTenantId !== context.tenantId) {
    return deny('tenant_mismatch', 'Dokument gehört zu einem anderen Mandanten.');
  }
  if (context.templateTenantId && context.templateTenantId !== context.tenantId) {
    return deny('tenant_mismatch', 'Vorlage gehört zu einem anderen Mandanten.');
  }
  return null;
}

function assertProductionSafety(context: DocumentActionGateContext): DocumentActionGateResult | null {
  if (context.environment === 'production' && context.demoMode) {
    return deny('production_demo_blocked', 'Demo-Modus in Produktion blockiert.');
  }
  if (context.environment === 'production' && context.usesDemoContext) {
    return deny('production_demo_blocked', 'Demo-Daten im Production Mode blockiert.');
  }
  return null;
}

function assertUnknownPlaceholders(template: DocumentGateTemplate | null): DocumentActionGateResult | null {
  if (!template?.htmlTemplate) return null;
  const placeholders = extractPlaceholders(template.htmlTemplate);
  const validation = validateKnownPlaceholders(placeholders);
  if (validation.status === 'error') {
    return deny(
      'unknown_placeholders',
      validation.issues[0]?.message ?? 'Unbekannte Platzhalter — Aktivierung blockiert.',
      validation,
    );
  }
  return null;
}

function assertRequiredFields(context: DocumentActionGateContext): DocumentActionGateResult | null {
  if (context.validation?.status === 'error') {
    return deny(
      'required_fields_missing',
      context.validation.issues.find((i) => i.severity === 'error')?.message ??
        'Pflichtfelder fehlen — Finalisierung blockiert.',
      context.validation,
    );
  }
  return null;
}

function assertTypeSpecificFinalization(context: DocumentActionGateContext): DocumentActionGateResult | null {
  if (context.invoiceRecord) {
    const tax = calculateInvoiceTax({
      taxMode: context.invoiceRecord.taxMode,
      lineItems: context.invoiceRecord.lineItems,
    });
    const validation = validateInvoiceRecord(context.invoiceRecord, tax);
    if (validation.status === 'error') {
      return deny(
        'invoice_validation_failed',
        validation.issues[0]?.message ?? 'Rechnungspflichtfelder fehlen.',
        validation,
      );
    }
    return allow(validation);
  }

  if (context.contractRecord) {
    const validation = validateContractRecord(context.contractRecord);
    if (validation.status === 'error') {
      return deny(
        'contract_validation_failed',
        validation.issues[0]?.message ?? 'Vertragspflichtfelder fehlen.',
        validation,
      );
    }
    return allow(validation);
  }

  if (context.serviceProofRecord) {
    const validation = validateServiceProofRecord(context.serviceProofRecord);
    if (validation.status === 'error') {
      return deny(
        'service_proof_validation_failed',
        validation.issues[0]?.message ?? 'Leistungsnachweis unvollständig.',
        validation,
      );
    }
    return allow(validation);
  }

  if (context.documentationRecord) {
    const validation = validateDocumentationRecord(context.documentationRecord);
    if (validation.status === 'error') {
      return deny(
        'documentation_validation_failed',
        validation.issues[0]?.message ?? 'Dokumentationspflichtfelder fehlen.',
        validation,
      );
    }
    return allow(validation);
  }

  return null;
}

export function buildDocumentActionGateContext(
  input: Partial<DocumentActionGateContext> & { tenantId?: string | null } = {},
): DocumentActionGateContext {
  const serviceMode = getServiceMode();
  return {
    userId: input.userId !== undefined ? input.userId : 'demo-user',
    tenantId: input.tenantId !== undefined ? input.tenantId : null,
    role: input.role !== undefined ? input.role : null,
    documentTenantId: input.documentTenantId ?? input.tenantId ?? null,
    templateTenantId: input.templateTenantId ?? input.tenantId ?? null,
    environment: input.environment ?? (serviceMode === 'supabase' ? 'production' : 'demo'),
    demoMode: input.demoMode ?? isDemoMode(),
    usesDemoContext: input.usesDemoContext ?? false,
    hasLivePreview: input.hasLivePreview,
    pdfRenderFailed: input.pdfRenderFailed,
    unknownPlaceholders: input.unknownPlaceholders,
    validation: input.validation ?? null,
    invoiceRecord: input.invoiceRecord ?? null,
    contractRecord: input.contractRecord ?? null,
    serviceProofRecord: input.serviceProofRecord ?? null,
    documentationRecord: input.documentationRecord ?? null,
    isSystemTemplate: input.isSystemTemplate,
    isSystemTemplateCopy: input.isSystemTemplateCopy,
  };
}

export function assertDocumentActionAllowed(
  action: DocumentActionKey,
  document: DocumentGateDocument | null,
  template: DocumentGateTemplate | null,
  context: DocumentActionGateContext,
): DocumentActionGateResult {
  const passiveActions = new Set<DocumentActionKey>(['view', 'live_preview']);
  if (!passiveActions.has(action)) {
    const auth = assertAuth(context);
    if (auth) return auth;
  } else if (!context.tenantId?.trim()) {
    return deny('missing_tenant', 'Mandant fehlt — Dokumentaktion blockiert.');
  }

  const tenantScope = assertTenantScope(context);
  if (tenantScope) return tenantScope;

  const production = assertProductionSafety(context);
  if (production) return production;

  if (context.serviceProofRecord) {
    const proof = context.serviceProofRecord;
    const signed =
      proof.status === 'signed' ||
      proof.status === 'finalized' ||
      Boolean(proof.lockedAt) ||
      proof.signatures.clientSigned;
    if (signed && (action === 'edit_document' || action === 'edit_template')) {
      return deny('service_proof_locked', 'Leistungsnachweis nach Signatur gesperrt.');
    }
  }

  if (isTemplateArchived(template) && ['edit_template', 'activate_template', 'version_template'].includes(action)) {
    return deny('template_archived', 'Archivierte Vorlage kann nicht bearbeitet oder aktiviert werden.');
  }

  if (
    context.isSystemTemplate &&
    !context.isSystemTemplateCopy &&
    ['edit_template', 'activate_template'].includes(action)
  ) {
    return deny('system_template_protected', 'Systemvorlage geschützt — nur Kopie für Mandant bearbeitbar.');
  }

  if (action === 'edit_document') {
    if (document?.lockedAt || document?.status === 'finalized') {
      return deny('document_finalized', 'Finalisiertes Dokument ist gesperrt — Korrektur oder Storno erforderlich.');
    }
    if (isDocumentArchived(document)) {
      return deny('document_archived', 'Archiviertes Dokument kann nicht direkt bearbeitet werden.');
    }
  }

  if (action === 'activate_template') {
    const unknown = assertUnknownPlaceholders(template);
    if (unknown) return unknown;
    if (context.unknownPlaceholders && context.unknownPlaceholders.length > 0) {
      return deny('unknown_placeholders', `Unbekannte Platzhalter: ${context.unknownPlaceholders.join(', ')}`);
    }
    const required = assertRequiredFields(context);
    if (required) return required;
    if (!context.hasLivePreview) {
      return deny('preview_required', 'Live-Vorschau erforderlich vor Aktivierung.');
    }
  }

  if (action === 'finalize') {
    if (!document?.previewConfirmed && context.hasLivePreview !== true) {
      return deny('preview_required', 'Live-Vorschau muss vor Finalisierung bestätigt sein.');
    }

    const unknown = assertUnknownPlaceholders(template);
    if (unknown) return unknown;

    const required = assertRequiredFields(context);
    if (required) return required;

    const typeCheck = assertTypeSpecificFinalization(context);
    if (typeCheck && !typeCheck.allowed) return typeCheck;

    if (context.pdfRenderFailed) {
      return deny('pdf_failed', 'PDF-Erzeugung fehlgeschlagen — Finalisierung blockiert.');
    }

    return typeCheck?.allowed ? allow(typeCheck.validation) : allow(context.validation ?? undefined);
  }

  if (action === 'edit_template' && isTemplateArchived(template)) {
    return deny('template_archived', 'Archivierte Vorlage kann nicht bearbeitet werden.');
  }

  return allow(context.validation ?? undefined);
}

export function isServiceProofLocked(proof: {
  status?: string;
  lockedAt?: string | null;
  signatures?: { clientSigned?: boolean };
}): boolean {
  return (
    proof.status === 'signed' ||
    proof.status === 'finalized' ||
    Boolean(proof.lockedAt) ||
    Boolean(proof.signatures?.clientSigned)
  );
}

export function buildDocumentActionGateContextForRole(
  tenantId: string,
  role: RoleKey | null,
  userId: string | null = 'demo-user',
): DocumentActionGateContext {
  return buildDocumentActionGateContext({ tenantId, role, userId });
}

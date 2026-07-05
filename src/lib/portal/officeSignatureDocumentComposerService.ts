import type { RoleKey, ServiceResult } from '@/types';
import type {
  OfficeCreateSignatureDocumentInput,
  PortalSignatureDocument,
  PortalSignatureDocumentType,
} from '@/types/portal/documentSignatures';
import type { DocumentEngineTemplateListItem } from '@/types/documents/documentEngine';
import type { DocumentEntityType } from '@/features/documents/templateEngine/types';
import { SYSTEM_DOCUMENT_CATALOG_TEMPLATES } from '@/data/seeds/documentCatalog';
import { buildDocumentPreview } from '@/features/documents/templateEngine';
import { buildDocumentContext } from '@/features/documents/templateEngine/documentContext';
import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';
import {
  createGeneratedDocument,
} from '@/lib/documents/documentEngineService';
import { runLivePreview } from '@/lib/documents/documentTemplateService';
import { fetchTenantDocumentSettings, mergeTenantSettingsIntoContext } from '@/lib/documents/tenantDocumentSettingsService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { buildTenantStoragePath, toStorageUploadError } from '@/lib/storage/storagePaths';
import { createLiveOfficeSignatureDocument } from '@/lib/portal/portalDocumentSignatureLiveService';
import {
  inferSignatureRequirementFromFields,
  parseSignatureFieldsFromHtml,
  type PortalSignatureFieldMarker,
} from '@/lib/portal/portalSignatureFieldParser';
import { PORTAL_SIGNATURE_STORAGE_BUCKET } from '@/lib/portal/portalDocumentSignatureHelpers';

export type OfficeSignatureDocumentSourceType = 'template' | 'pdf_upload' | 'office_write';

export type ComposeOfficeSignatureDocumentInput = {
  tenantId: string;
  title: string;
  documentType: PortalSignatureDocumentType;
  sourceType: OfficeSignatureDocumentSourceType;
  htmlContent?: string | null;
  pdfBase64?: string | null;
  pdfFileName?: string | null;
  template?: DocumentEngineTemplateListItem | null;
  templateEntityType?: DocumentEntityType;
  templateEntityId?: string;
  employeeId: string;
  clientId?: string | null;
  clientName?: string | null;
  recipientType: 'employee' | 'client';
  signatureRequirement?: OfficeCreateSignatureDocumentInput['signatureRequirement'];
  dueDate?: string | null;
  priority?: OfficeCreateSignatureDocumentInput['priority'];
  requiredBeforeAssignment?: boolean;
  allowDownload?: boolean;
  creatorName: string;
  creatorProfileId?: string | null;
};

async function buildHtmlFromTemplate(
  tenantId: string,
  template: DocumentEngineTemplateListItem,
  actorRoleKey: RoleKey | null,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<ServiceResult<string>> {
  if (!template.id.startsWith('catalog-')) {
    const live = await runLivePreview(
      { tenantId, templateId: template.id, sampleId: 'sample-demo' },
      actorRoleKey,
    );
    if (live.ok) return { ok: true, data: live.data.html };
    return live;
  }

  const catalogEntry = SYSTEM_DOCUMENT_CATALOG_TEMPLATES.find((t) => t.templateKey === template.templateKey);
  if (!catalogEntry) {
    return { ok: false, error: 'Katalogvorlage nicht gefunden.' };
  }

  const contextResult = await buildDocumentContext(entityType, entityId, tenantId);
  if (!contextResult.ok) return contextResult;

  const settingsResult = await fetchTenantDocumentSettings(tenantId, actorRoleKey);
  const settings = settingsResult.ok ? settingsResult.data : null;
  const context = settings
    ? mergeTenantSettingsIntoContext(contextResult.context, settings)
    : contextResult.context;

  const preview = buildDocumentPreview({
    templateVersion: {
      htmlTemplate: catalogEntry.htmlTemplate,
      cssTemplate: catalogEntry.cssTemplate,
      requiredFields: (catalogEntry.manualFields ?? []).map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        dataPath: `manual.${f.fieldKey}`,
        isRequired: false,
      })),
    },
    context,
    documentType: (catalogEntry.templateType as DocumentTemplateTypeKey) ?? 'generic',
    tenantDocumentSettings: settings,
    showDraftWatermark: true,
  });

  return { ok: true, data: preview.html };
}

async function uploadSourcePdf(
  tenantId: string,
  documentId: string,
  fileName: string,
  base64: string,
): Promise<ServiceResult<string>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const storagePath = buildTenantStoragePath(
    tenantId,
    'portal',
    'signatures',
    'sources',
    documentId,
    fileName.replace(/[^\w.\-äöüÄÖÜß ]/g, '_') || 'document.pdf',
  );
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage.from(PORTAL_SIGNATURE_STORAGE_BUCKET).upload(storagePath, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) return { ok: false, error: toStorageUploadError(error.message) };
  return { ok: true, data: storagePath };
}

function wrapPdfPreviewHtml(title: string, signatureFields: PortalSignatureFieldMarker[]): string {
  const fieldHtml = signatureFields
    .map(
      (field) =>
        `<div class="portal-signature-field" data-signer-role="${field.role}" data-signature-field-id="${field.id}"><p><strong>${field.label}</strong> — Unterschrift erforderlich</p></div>`,
    )
    .join('\n');
  return `<h1>${title}</h1><p>PDF-Dokument — bitte vollständig lesen und an den markierten Stellen unterschreiben.</p>${fieldHtml}`;
}

/** Compose document from template/PDF/write, persist source, send to employee portal. */
export async function composeOfficeSignatureDocument(
  input: ComposeOfficeSignatureDocumentInput,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDocument>> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  let htmlContent = input.htmlContent?.trim() ?? '';
  let sourceDocumentId: string | null = null;
  let storagePath: string | null = null;
  const documentId = crypto.randomUUID?.() ?? `psd-src-${Date.now()}`;

  if (input.sourceType === 'template' && input.template) {
    const built = await buildHtmlFromTemplate(
      input.tenantId,
      input.template,
      actorRoleKey,
      input.templateEntityType ?? 'client',
      input.templateEntityId ?? input.clientId ?? 'client-001',
    );
    if (!built.ok) return built;
    htmlContent = built.data;

    const generated = await createGeneratedDocument(
      {
        tenantId: input.tenantId,
        templateId: input.template.id,
        title: input.title.trim(),
        htmlOutput: htmlContent,
        employeeId: input.employeeId,
        clientId: input.clientId ?? null,
      },
      actorRoleKey,
    );
    if (generated.ok) sourceDocumentId = generated.data.id;
  }

  if (input.sourceType === 'pdf_upload') {
    if (!input.pdfBase64?.trim()) {
      return { ok: false, error: 'PDF-Datei fehlt.' };
    }
    const uploaded = await uploadSourcePdf(
      input.tenantId,
      documentId,
      input.pdfFileName ?? `${input.title}.pdf`,
      input.pdfBase64,
    );
    if (!uploaded.ok) return uploaded;
    storagePath = uploaded.data;
  }

  const signatureFields = parseSignatureFieldsFromHtml(htmlContent);
  const signatureRequirement =
    input.signatureRequirement ?? inferSignatureRequirementFromFields(signatureFields);

  if (input.sourceType === 'pdf_upload' && signatureFields.length === 0) {
    htmlContent = wrapPdfPreviewHtml(input.title, [
      {
        id: 'employee_signature',
        role: 'employee',
        label: 'Mitarbeiter-Unterschrift',
        order: 1,
        required: true,
      },
    ]);
  }

  if (!htmlContent && !storagePath) {
    return { ok: false, error: 'Dokumentinhalt fehlt.' };
  }

  return createLiveOfficeSignatureDocument({
    documentId,
    tenantId: input.tenantId,
    title: input.title.trim(),
    documentType: input.documentType,
    recipientType: input.recipientType,
    employeeId: input.employeeId,
    clientId: input.clientId ?? null,
    clientName: input.clientName ?? null,
    signatureRequirement,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 'normal',
    requiredBeforeAssignment: input.requiredBeforeAssignment ?? false,
    allowDownload: input.allowDownload ?? true,
    previewHtml: htmlContent || null,
    storagePath,
    sourceDocumentId,
    documentSourceType: input.sourceType,
    signatureFields,
    creatorName: input.creatorName,
    creatorProfileId: input.creatorProfileId ?? null,
  });
}

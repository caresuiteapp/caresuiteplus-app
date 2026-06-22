import type { RoleKey, ServiceResult } from '@/types';
import type {
  DocumentTemplateDetail,
  DocumentTemplateRecord,
  DocumentTemplateVersionInput,
  DocumentTemplateVersionRecord,
  LivePreviewRequest,
  LivePreviewResult,
  PreviewSampleOption,
} from '@/types/documents/documentTemplate';
import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { buildDocumentPreview } from '@/features/documents/templateEngine/documentPreviewRenderer';
import { buildDocumentContext } from '@/features/documents/templateEngine/documentContext';
import {
  assertCanActivateTemplateVersion,
  getPdfEngineStatus,
  isPdfEngineAvailable,
} from '@/features/documents/templateEngine/validateTemplateActivation';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fetchTenantDocumentSettings, mergeTenantSettingsIntoContext } from './tenantDocumentSettingsService';
import type { SystemDocumentTemplate } from '@/types/documents/systemDocumentTemplate';
import { SYSTEM_TEMPLATE_COPY_NOTICE } from './systemTemplateLegal';
import {
  assertDocumentActionAllowed,
  buildDocumentActionGateContextForRole,
} from './documentActionGate';

const TEMPLATES = new Map<string, DocumentTemplateRecord>();
const VERSIONS = new Map<string, DocumentTemplateVersionRecord>();

const DEFAULT_INVOICE_HTML = `<h1>Rechnung {{invoice.number}}</h1>
<div class="cs-block-info"><p>Datum: {{invoice.date}}</p><p>Empfänger: {{recipient.full_name}}</p></div>
<p>Leistungszeitraum: {{invoice.service_period}}</p>
<table class="cs-block-table"><tr><td>Leistung</td><td>{{invoice.gross_total}}</td></tr></table>
<p>{{invoice.tax_notice}}</p>`;

function seedDemoTemplates(): void {
  if (TEMPLATES.size > 0) return;

  const tenantId = DEMO_TENANT_ID;
  const templateId = 'dtpl-invoice-001';
  const versionId = 'dtplv-invoice-001-v1';

  TEMPLATES.set(templateId, {
    id: templateId,
    tenantId,
    title: 'Standard-Rechnung',
    description: 'HTML-Rechnungsvorlage mit CI-Layout',
    templateType: 'invoice',
    templateStatus: 'draft',
    currentVersionId: versionId,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  });

  VERSIONS.set(versionId, {
    id: versionId,
    tenantId,
    templateId,
    versionNumber: 1,
    htmlTemplate: DEFAULT_INVOICE_HTML,
    cssTemplate: '',
    requiredFields: [
      { fieldKey: 'invoice.number', label: 'Rechnungsnummer', dataPath: 'invoice.number', isRequired: true },
    ],
    versionStatus: 'draft',
    lastPreviewAt: null,
    lastPreviewValid: false,
    activatedAt: null,
    archivedAt: null,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  });

  const tenantB = '00000000-0000-4000-8000-000000000099';
  const tplB = 'dtpl-b-invoice';
  const verB = 'dtplv-b-invoice-v1';
  TEMPLATES.set(tplB, {
    id: tplB,
    tenantId: tenantB,
    title: 'Mandant B Rechnung',
    description: 'Isolierte Vorlage Mandant B',
    templateType: 'invoice',
    templateStatus: 'draft',
    currentVersionId: verB,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  });
  VERSIONS.set(verB, {
    id: verB,
    tenantId: tenantB,
    templateId: tplB,
    versionNumber: 1,
    htmlTemplate: '<p>Mandant B: {{invoice.number}}</p>',
    cssTemplate: '',
    requiredFields: [],
    versionStatus: 'draft',
    lastPreviewAt: null,
    lastPreviewValid: false,
    activatedAt: null,
    archivedAt: null,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  });
}

export const PREVIEW_SAMPLE_OPTIONS: PreviewSampleOption[] = [
  { id: 'sample-demo', kind: 'demo_full', label: 'Beispieldatensatz (vollständig)', entityType: 'invoice', entityId: 'inv-demo-1' },
  { id: 'sample-client', kind: 'client', label: 'Klient:in Helga Schneider', entityType: 'client', entityId: 'client-001' },
  { id: 'sample-invoice', kind: 'invoice', label: 'Rechnung RE-2026-0341', entityType: 'invoice', entityId: 'inv-001' },
  { id: 'sample-visit', kind: 'visit', label: 'Einsatz 15.06.2026', entityType: 'service_record', entityId: 'visit-demo-1' },
  { id: 'sample-contract', kind: 'contract', label: 'Vertrag V-DEMO-001', entityType: 'contract', entityId: 'contract-demo-1' },
];

async function demoDelay(ms = 120): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function versionsForTemplate(templateId: string, tenantId: string): DocumentTemplateVersionRecord[] {
  return [...VERSIONS.values()]
    .filter((v) => v.templateId === templateId && v.tenantId === tenantId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

function buildDetail(template: DocumentTemplateRecord): DocumentTemplateDetail {
  const versions = versionsForTemplate(template.id, template.tenantId);
  return {
    ...template,
    versions,
    activeVersion: versions.find((v) => v.versionStatus === 'active') ?? null,
    draftVersion: versions.find((v) => v.versionStatus === 'draft') ?? versions[0] ?? null,
  };
}

export async function listDocumentTemplates(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentTemplateRecord[]>> {
  const denied = enforcePermission<DocumentTemplateRecord[]>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  seedDemoTemplates();
  await demoDelay();

  const items = [...TEMPLATES.values()].filter((t) => t.tenantId === tenantId);
  return { ok: true, data: items };
}

export async function getDocumentTemplateDetail(
  tenantId: string,
  templateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentTemplateDetail>> {
  const denied = enforcePermission<DocumentTemplateDetail>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  seedDemoTemplates();
  await demoDelay();

  const template = TEMPLATES.get(templateId);
  if (!template || template.tenantId !== tenantId) {
    return { ok: false, error: 'Dokumentvorlage nicht gefunden.' };
  }
  return { ok: true, data: buildDetail(template) };
}

export function isTenantOwnedTemplate(tenantId: string, templateId: string): boolean {
  seedDemoTemplates();
  const template = TEMPLATES.get(templateId);
  return Boolean(template && template.tenantId === tenantId);
}

export function createTenantTemplateFromSystem(
  tenantId: string,
  system: SystemDocumentTemplate,
  ids?: { templateId?: string; versionId?: string },
): { template: DocumentTemplateRecord; version: DocumentTemplateVersionRecord } {
  seedDemoTemplates();

  const templateId = ids?.templateId ?? `dtpl-copy-${system.id}`;
  const versionId = ids?.versionId ?? `dtplv-copy-${system.id}`;
  const now = new Date().toISOString();

  const template: DocumentTemplateRecord = {
    id: templateId,
    tenantId,
    title: `${system.templateName} (Kopie)`,
    description: SYSTEM_TEMPLATE_COPY_NOTICE,
    templateType: system.templateType,
    templateStatus: 'draft',
    currentVersionId: versionId,
    createdAt: now,
    updatedAt: now,
  };

  const version: DocumentTemplateVersionRecord = {
    id: versionId,
    tenantId,
    templateId,
    versionNumber: 1,
    htmlTemplate: system.htmlTemplate,
    cssTemplate: system.cssTemplate,
    requiredFields: system.requiredFields,
    versionStatus: 'draft',
    lastPreviewAt: null,
    lastPreviewValid: false,
    activatedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  TEMPLATES.set(templateId, template);
  VERSIONS.set(versionId, version);
  return { template, version };
}

export async function updateDocumentTemplateVersion(
  tenantId: string,
  versionId: string,
  input: DocumentTemplateVersionInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentTemplateVersionRecord>> {
  const denied = enforcePermission<DocumentTemplateVersionRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  seedDemoTemplates();
  const version = VERSIONS.get(versionId);
  if (!version || version.tenantId !== tenantId) {
    return { ok: false, error: 'Version nicht gefunden.' };
  }
  if (version.versionStatus === 'archived') {
    return { ok: false, error: 'Archivierte Vorlage kann nicht bearbeitet werden — bitte kopieren/versionieren.' };
  }

  const parentTemplate = TEMPLATES.get(version.templateId);

  const editGate = assertDocumentActionAllowed(
    'edit_template',
    null,
    { versionStatus: version.versionStatus, templateStatus: parentTemplate?.templateStatus },
    buildDocumentActionGateContextForRole(tenantId, actorRoleKey ?? null),
  );
  if (!editGate.allowed) {
    return { ok: false, error: editGate.message };
  }

  const updated: DocumentTemplateVersionRecord = {
    ...version,
    htmlTemplate: input.htmlTemplate,
    cssTemplate: input.cssTemplate ?? '',
    requiredFields: input.requiredFields ?? version.requiredFields,
    lastPreviewAt: null,
    lastPreviewValid: false,
    updatedAt: new Date().toISOString(),
  };
  VERSIONS.set(versionId, updated);
  return { ok: true, data: updated };
}

export async function createDocumentTemplateVersion(
  tenantId: string,
  templateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentTemplateVersionRecord>> {
  const denied = enforcePermission<DocumentTemplateVersionRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  seedDemoTemplates();
  const template = TEMPLATES.get(templateId);
  if (!template || template.tenantId !== tenantId) {
    return { ok: false, error: 'Vorlage nicht gefunden.' };
  }

  const existing = versionsForTemplate(templateId, tenantId);
  const base = existing[0];
  const nextNum = (existing[0]?.versionNumber ?? 0) + 1;
  const id = `dtplv-${templateId}-v${nextNum}`;

  const version: DocumentTemplateVersionRecord = {
    id,
    tenantId,
    templateId,
    versionNumber: nextNum,
    htmlTemplate: base?.htmlTemplate ?? DEFAULT_INVOICE_HTML,
    cssTemplate: base?.cssTemplate ?? '',
    requiredFields: base?.requiredFields ?? [],
    versionStatus: 'draft',
    lastPreviewAt: null,
    lastPreviewValid: false,
    activatedAt: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  VERSIONS.set(id, version);

  TEMPLATES.set(templateId, { ...template, currentVersionId: id, updatedAt: new Date().toISOString() });
  return { ok: true, data: version };
}

export async function runLivePreview(
  request: LivePreviewRequest,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LivePreviewResult>> {
  const denied = enforcePermission<LivePreviewResult>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(request.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Live-Vorschau im Supabase-Modus: Repository erweitern — kein Demo-Fallback.' };
  }

  seedDemoTemplates();
  const template = TEMPLATES.get(request.templateId);
  if (!template || template.tenantId !== request.tenantId) {
    return { ok: false, error: 'Vorlage nicht gefunden.' };
  }

  const versionId = request.versionId ?? template.currentVersionId;
  const version = versionId ? VERSIONS.get(versionId) : null;
  if (!version || version.tenantId !== request.tenantId) {
    return { ok: false, error: 'Vorlagenversion nicht gefunden.' };
  }

  const sample = PREVIEW_SAMPLE_OPTIONS.find((s) => s.id === request.sampleId) ?? PREVIEW_SAMPLE_OPTIONS[0]!;

  const contextResult = await buildDocumentContext(sample.entityType, sample.entityId, request.tenantId);
  if (!contextResult.ok) {
    return { ok: false, error: contextResult.error };
  }

  const settingsResult = await fetchTenantDocumentSettings(request.tenantId, actorRoleKey);
  const settings = settingsResult.ok ? settingsResult.data : null;
  const context = settings
    ? mergeTenantSettingsIntoContext(contextResult.context, settings)
    : contextResult.context;

  const preview = buildDocumentPreview({
    templateVersion: {
      htmlTemplate: version.htmlTemplate,
      cssTemplate: version.cssTemplate,
      requiredFields: version.requiredFields,
    },
    context,
    documentType: template.templateType,
    tenantDocumentSettings: settings,
    viewMode: request.viewMode ?? 'desktop',
    showDraftWatermark: request.showDraftWatermark ?? version.versionStatus === 'draft',
  });

  const previewValid = preview.renderResult.validation.status !== 'error';

  VERSIONS.set(version.id, {
    ...version,
    lastPreviewAt: new Date().toISOString(),
    lastPreviewValid: previewValid,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    data: {
      html: preview.html,
      renderResult: preview.renderResult,
      viewMode: preview.viewMode,
      sampleLabel: sample.label,
      pdfPrepared: true,
      pdfEngineAvailable: isPdfEngineAvailable(),
      source: contextResult.source,
    },
  };
}

export async function activateDocumentTemplateVersion(
  tenantId: string,
  versionId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentTemplateVersionRecord>> {
  const denied = enforcePermission<DocumentTemplateVersionRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  seedDemoTemplates();
  const version = VERSIONS.get(versionId);
  if (!version || version.tenantId !== tenantId) {
    return { ok: false, error: 'Version nicht gefunden.' };
  }

  const template = TEMPLATES.get(version.templateId);
  if (!template) return { ok: false, error: 'Vorlage nicht gefunden.' };

  const sample = PREVIEW_SAMPLE_OPTIONS[0]!;
  const contextResult = await buildDocumentContext(sample.entityType, sample.entityId, tenantId);
  if (!contextResult.ok) return { ok: false, error: contextResult.error };

  const settingsResult = await fetchTenantDocumentSettings(tenantId, actorRoleKey);
  const settings = settingsResult.ok ? settingsResult.data : null;

  const check = assertCanActivateTemplateVersion({
    documentType: template.templateType,
    context: contextResult.context,
    templateVersion: {
      htmlTemplate: version.htmlTemplate,
      cssTemplate: version.cssTemplate,
      requiredFields: version.requiredFields,
    },
    tenantDocumentSettings: settings,
    hasLivePreview: version.lastPreviewValid,
    versionStatus: version.versionStatus,
  });

  const activateGate = assertDocumentActionAllowed(
    'activate_template',
    null,
    { htmlTemplate: version.htmlTemplate, versionStatus: version.versionStatus, templateStatus: template.templateStatus },
    {
      ...buildDocumentActionGateContextForRole(tenantId, actorRoleKey ?? null),
      hasLivePreview: version.lastPreviewValid,
      validation: check.validation,
    },
  );
  if (!activateGate.allowed) {
    return { ok: false, error: activateGate.message };
  }

  if (!check.allowed) {
    return { ok: false, error: check.reason ?? 'Aktivierung blockiert.' };
  }

  for (const v of versionsForTemplate(version.templateId, tenantId)) {
    if (v.versionStatus === 'active') {
      VERSIONS.set(v.id, { ...v, versionStatus: 'inactive', updatedAt: new Date().toISOString() });
    }
  }

  const activated: DocumentTemplateVersionRecord = {
    ...version,
    versionStatus: 'active',
    activatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  VERSIONS.set(versionId, activated);
  TEMPLATES.set(template.id, {
    ...template,
    templateStatus: 'active',
    currentVersionId: versionId,
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, data: activated };
}

export async function archiveDocumentTemplate(
  tenantId: string,
  templateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentTemplateRecord>> {
  const denied = enforcePermission<DocumentTemplateRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  seedDemoTemplates();
  const template = TEMPLATES.get(templateId);
  if (!template || template.tenantId !== tenantId) {
    return { ok: false, error: 'Vorlage nicht gefunden.' };
  }

  for (const v of versionsForTemplate(templateId, tenantId)) {
    VERSIONS.set(v.id, {
      ...v,
      versionStatus: 'archived',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const archived: DocumentTemplateRecord = {
    ...template,
    templateStatus: 'archived',
    updatedAt: new Date().toISOString(),
  };
  TEMPLATES.set(templateId, archived);
  return { ok: true, data: archived };
}

export function resetDocumentTemplateStore(): void {
  TEMPLATES.clear();
  VERSIONS.clear();
}

export function seedDocumentTemplateForTest(
  tenantId: string,
  overrides?: Partial<DocumentTemplateRecord> & { htmlTemplate?: string; unsafeHtml?: string },
): { template: DocumentTemplateRecord; version: DocumentTemplateVersionRecord } {
  seedDemoTemplates();
  const id = overrides?.id ?? `dtpl-test-${tenantId.slice(0, 6)}`;
  const versionId = `dtplv-test-${tenantId.slice(0, 6)}`;
  const html = overrides?.unsafeHtml ?? overrides?.htmlTemplate ?? DEFAULT_INVOICE_HTML;

  const template: DocumentTemplateRecord = {
    id,
    tenantId,
    title: overrides?.title ?? 'Test-Vorlage',
    description: null,
    templateType: overrides?.templateType ?? 'invoice',
    templateStatus: overrides?.templateStatus ?? 'draft',
    currentVersionId: versionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const version: DocumentTemplateVersionRecord = {
    id: versionId,
    tenantId,
    templateId: id,
    versionNumber: 1,
    htmlTemplate: html,
    cssTemplate: '',
    requiredFields: [],
    versionStatus: 'draft',
    lastPreviewAt: null,
    lastPreviewValid: false,
    activatedAt: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  TEMPLATES.set(id, template);
  VERSIONS.set(versionId, version);
  return { template, version };
}

export { getPdfEngineStatus, isPdfEngineAvailable };

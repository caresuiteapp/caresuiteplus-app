import type { RoleKey, ServiceResult } from '@/types';
import type {
  SystemDocumentTemplate,
  SystemTemplateCopyResult,
} from '@/types/documents/systemDocumentTemplate';
import type { DocumentTemplateDetail, DocumentTemplateRecord, DocumentTemplateVersionRecord } from '@/types/documents/documentTemplate';
import { createEmptyDocumentContext } from '@/features/documents/templateEngine/documentContext';
import { extractPlaceholders } from '@/features/documents/templateEngine/extractPlaceholders';
import { renderTemplate } from '@/features/documents/templateEngine/renderTemplate';
import { validateKnownPlaceholders } from '@/features/documents/templateEngine/validateTemplate';
import { validateRequiredFields } from '@/features/documents/templateEngine/validateRequiredFields';
import type { RenderTemplateResult } from '@/features/documents/templateEngine/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { SYSTEM_TEMPLATE_SEEDS } from './systemTemplateSeeds';
import { SYSTEM_DOCUMENT_CATALOG_TEMPLATES } from '@/data/seeds/documentCatalog';
import { buildStandardExampleContext } from './systemTemplateSeeds';
import { SYSTEM_TEMPLATE_LEGAL_DISCLAIMER } from './systemTemplateLegal';
import {
  createTenantTemplateFromSystem,
  isTenantOwnedTemplate,
  resetDocumentTemplateStore,
} from './documentTemplateService';

const SYSTEM_TEMPLATES = new Map<string, SystemDocumentTemplate>();

let copyCounter = 0;

function nextCopyId(prefix: string): string {
  copyCounter += 1;
  return `${prefix}-${Date.now()}-${copyCounter}`;
}

function catalogEntryToSystemTemplate(
  entry: (typeof SYSTEM_DOCUMENT_CATALOG_TEMPLATES)[number],
): SystemDocumentTemplate {
  return {
    id: `sys-catalog-${entry.templateKey}`,
    templateName: entry.name,
    templateType: (entry.templateType as SystemDocumentTemplate['templateType']) ?? 'generic',
    documentCategory: 'care',
    templateStatus: 'active',
    htmlTemplate: entry.htmlTemplate,
    cssTemplate: entry.cssTemplate,
    placeholderSchema: {},
    requiredFields: (entry.manualFields ?? []).map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      dataPath: `manual.${f.fieldKey}`,
      isRequired: false,
    })),
    layoutSettings: { layoutKind: entry.layoutKind },
    headerSettings: {},
    footerSettings: {},
    signatureSettings: {},
    exampleContext: buildStandardExampleContext(),
    validationRules: {},
    isSystemTemplate: true,
  };
}

/** Idempotentes Seeden — keine Duplikate bei erneutem Aufruf. */
export function seedSystemTemplates(): void {
  for (const seed of SYSTEM_TEMPLATE_SEEDS) {
    if (!SYSTEM_TEMPLATES.has(seed.id)) {
      SYSTEM_TEMPLATES.set(seed.id, seed);
    }
  }
  for (const catalogEntry of SYSTEM_DOCUMENT_CATALOG_TEMPLATES) {
    const mapped = catalogEntryToSystemTemplate(catalogEntry);
    if (!SYSTEM_TEMPLATES.has(mapped.id)) {
      SYSTEM_TEMPLATES.set(mapped.id, mapped);
    }
  }
}

export function resetSystemTemplateStore(): void {
  SYSTEM_TEMPLATES.clear();
  copyCounter = 0;
}

export function getSystemTemplateLegalDisclaimer(): string {
  return SYSTEM_TEMPLATE_LEGAL_DISCLAIMER;
}

export function isSystemTemplateProtected(templateId: string): boolean {
  seedSystemTemplates();
  return SYSTEM_TEMPLATES.has(templateId);
}

export async function listSystemTemplates(
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SystemDocumentTemplate[]>> {
  const denied = enforcePermission<SystemDocumentTemplate[]>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  seedSystemTemplates();
  const items = [...SYSTEM_TEMPLATES.values()].sort((a, b) =>
    a.templateName.localeCompare(b.templateName, 'de'),
  );
  return { ok: true, data: items };
}

export async function getSystemTemplate(
  templateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SystemDocumentTemplate>> {
  const denied = enforcePermission<SystemDocumentTemplate>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  seedSystemTemplates();
  const template = SYSTEM_TEMPLATES.get(templateId);
  if (!template) {
    return { ok: false, error: 'Systemvorlage nicht gefunden.' };
  }
  return { ok: true, data: template };
}

export function buildSystemTemplateRenderContext(
  template: SystemDocumentTemplate,
  tenantId: string,
): ReturnType<typeof createEmptyDocumentContext> {
  const context = createEmptyDocumentContext({
    tenantId,
    entityType: 'invoice',
    entityId: 'system-template-preview',
  });

  for (const section of [
    'company',
    'client',
    'representative',
    'cost_carrier',
    'recipient',
    'invoice',
    'visit',
    'contract',
    'signature',
    'document',
    'page',
  ] as const) {
    context[section] = { ...context[section], ...template.exampleContext[section] };
  }

  return context;
}

export function validateSystemTemplateRender(template: SystemDocumentTemplate): RenderTemplateResult {
  const context = buildSystemTemplateRenderContext(template, '00000000-0000-4000-8000-000000000001');
  return renderTemplate(
    {
      htmlTemplate: template.htmlTemplate,
      cssTemplate: template.cssTemplate,
      requiredFields: template.requiredFields,
      layoutSettings: template.layoutSettings,
      headerSettings: template.headerSettings,
      footerSettings: template.footerSettings,
      validationRules: template.validationRules,
    },
    {
      context,
      documentType: template.templateType,
      applyLayoutShell: false,
    },
  );
}

export function validateSystemTemplatePlaceholders(template: SystemDocumentTemplate) {
  const placeholders = extractPlaceholders(template.htmlTemplate);
  return validateKnownPlaceholders(placeholders);
}

export function validateSystemTemplateRequiredFields(
  template: SystemDocumentTemplate,
  tenantId: string,
) {
  const context = buildSystemTemplateRenderContext(template, tenantId);
  return validateRequiredFields({ requiredFields: template.requiredFields }, context);
}

export async function copySystemTemplateForTenant(
  tenantId: string,
  systemTemplateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SystemTemplateCopyResult & { detail: DocumentTemplateDetail }>> {
  const denied = enforcePermission<SystemTemplateCopyResult & { detail: DocumentTemplateDetail }>(
    actorRoleKey,
    'office.catalogs.edit',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  seedSystemTemplates();
  const system = SYSTEM_TEMPLATES.get(systemTemplateId);
  if (!system) {
    return { ok: false, error: 'Systemvorlage nicht gefunden.' };
  }

  const tenantTemplateId = nextCopyId(`dtpl-copy-${systemTemplateId}`);
  const tenantVersionId = nextCopyId(`dtplv-copy-${systemTemplateId}`);

  const { template, version } = createTenantTemplateFromSystem(tenantId, system, {
    templateId: tenantTemplateId,
    versionId: tenantVersionId,
  });

  return {
    ok: true,
    data: {
      systemTemplateId,
      tenantTemplateId: template.id,
      tenantVersionId: version.id,
      detail: {
        ...template,
        versions: [version],
        activeVersion: null,
        draftVersion: version,
      },
    },
  };
}

export async function assertSystemTemplateNotEditable(
  tenantId: string,
  templateId: string,
): Promise<ServiceResult<null>> {
  if (isSystemTemplateProtected(templateId)) {
    return { ok: false, error: 'Systemvorlagen sind geschützt und können nicht bearbeitet werden.' };
  }
  if (!isTenantOwnedTemplate(tenantId, templateId)) {
    return { ok: false, error: 'Vorlage gehört nicht zum Mandanten.' };
  }
  return { ok: true, data: null };
}

export function getSystemTemplateSeedCount(): number {
  seedSystemTemplates();
  return SYSTEM_TEMPLATES.size;
}

export function resetAllDocumentTemplateStores(): void {
  resetSystemTemplateStore();
  resetDocumentTemplateStore();
}

export type { SystemDocumentTemplate };

import type { ServiceResult } from '@/types';
import type {
  AssistAssignmentTemplateDraft,
  AssistServiceCatalogItem,
  CreateAssistServiceInput,
  UpdateAssistServiceInput,
} from '@/types/assistServiceCatalog';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  getAssistService,
  getAssistServiceByKey,
  listAssistServices,
  listServiceTaskTemplates,
  saveAssistService,
} from './assistServiceCatalogStore';
import { validateAssistServiceCategory } from './categoryValidationService';
import { recordAssistServiceCatalogAudit } from './auditService';
import { seedDemoAssistServiceCatalog } from '@/data/demo/assistServiceCatalogDemo';

function blockLiveWithoutRepository(): ServiceResult<never> | null {
  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error:
        'Assist-Leistungskatalog im Live-Modus noch nicht vollständig angebunden — Migration 0053 erforderlich.',
    };
  }
  return null;
}

function ensureDemoSeed(tenantId: string): void {
  if (listAssistServices(tenantId).length === 0) {
    seedDemoAssistServiceCatalog(tenantId);
  }
}

export function createAssistService(input: CreateAssistServiceInput): ServiceResult<AssistServiceCatalogItem> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = blockLiveWithoutRepository();
  if (liveBlock) return liveBlock;

  ensureDemoSeed(input.tenantId);

  const categoryCheck = validateAssistServiceCategory(
    input.category,
    input.title,
    input.description ?? '',
  );
  if (!categoryCheck.ok) return categoryCheck;

  if (getAssistServiceByKey(input.tenantId, input.serviceKey)) {
    return { ok: false, error: `Leistungsschlüssel „${input.serviceKey}" existiert bereits.` };
  }

  const now = new Date().toISOString();
  const service: AssistServiceCatalogItem = {
    id: `asc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    serviceKey: input.serviceKey.trim(),
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    category: input.category,
    billable: input.billable ?? true,
    requiresSignature: input.requiresSignature ?? false,
    requiresDocumentation: input.requiresDocumentation ?? true,
    defaultDurationMinutes: input.defaultDurationMinutes ?? 60,
    defaultTaskTemplateIds: [],
    allowedModules: input.allowedModules ?? ['assist'],
    taxMode: input.taxMode ?? 'ustg_4_16_exempt',
    budgetEligible: input.budgetEligible ?? true,
    status: input.status ?? 'draft',
    createdAt: now,
    updatedAt: now,
  };

  saveAssistService(input.tenantId, service);
  recordAssistServiceCatalogAudit(input.tenantId, {
    serviceCatalogItemId: service.id,
    action: 'service_created',
    summary: `Leistung angelegt: ${service.title}`,
    payload: { serviceKey: service.serviceKey, category: service.category },
    actorUserId: input.actorUserId ?? null,
  });

  return { ok: true, data: service };
}

export function updateAssistService(input: UpdateAssistServiceInput): ServiceResult<AssistServiceCatalogItem> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = blockLiveWithoutRepository();
  if (liveBlock) return liveBlock;

  const existing = getAssistService(input.tenantId, input.serviceId);
  if (!existing) return { ok: false, error: 'Leistung nicht gefunden.' };

  const next: AssistServiceCatalogItem = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    description: input.description ?? existing.description,
    category: input.category ?? existing.category,
    billable: input.billable ?? existing.billable,
    requiresSignature: input.requiresSignature ?? existing.requiresSignature,
    requiresDocumentation: input.requiresDocumentation ?? existing.requiresDocumentation,
    defaultDurationMinutes: input.defaultDurationMinutes ?? existing.defaultDurationMinutes,
    allowedModules: input.allowedModules ?? existing.allowedModules,
    taxMode: input.taxMode ?? existing.taxMode,
    budgetEligible: input.budgetEligible ?? existing.budgetEligible,
    status: input.status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };

  const categoryCheck = validateAssistServiceCategory(next.category, next.title, next.description);
  if (!categoryCheck.ok) return categoryCheck;

  saveAssistService(input.tenantId, next);
  recordAssistServiceCatalogAudit(input.tenantId, {
    serviceCatalogItemId: next.id,
    action: 'service_updated',
    summary: `Leistung aktualisiert: ${next.title}`,
    payload: { serviceKey: next.serviceKey },
    actorUserId: input.actorUserId ?? null,
  });

  return { ok: true, data: next };
}

export function fetchAssistServices(tenantId: string): ServiceResult<AssistServiceCatalogItem[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = blockLiveWithoutRepository();
  if (liveBlock) return liveBlock;

  ensureDemoSeed(tenantId);
  return { ok: true, data: listAssistServices(tenantId) };
}

export function generateAssignmentTemplateFromService(
  tenantId: string,
  serviceId: string,
): ServiceResult<AssistAssignmentTemplateDraft> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = blockLiveWithoutRepository();
  if (liveBlock) return liveBlock;

  ensureDemoSeed(tenantId);

  const service = getAssistService(tenantId, serviceId);
  if (!service) return { ok: false, error: 'Leistung nicht gefunden.' };
  if (service.status !== 'active') {
    return { ok: false, error: 'Nur aktive Leistungen können Einsatzvorlagen erzeugen.' };
  }

  const templates = listServiceTaskTemplates(tenantId, serviceId).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const draft: AssistAssignmentTemplateDraft = {
    serviceCatalogItemId: service.id,
    serviceKey: service.serviceKey,
    title: service.title,
    serviceType: service.category,
    billingRelevant: service.billable,
    requiresSignature: service.requiresSignature,
    requiresDocumentation: service.requiresDocumentation,
    defaultDurationMinutes: service.defaultDurationMinutes,
    taxMode: service.taxMode,
    budgetEligible: service.budgetEligible,
    tasks: templates.map((template) => ({
      title: template.title,
      description: template.description,
      category: service.category,
      required: template.isRequired,
    })),
  };

  recordAssistServiceCatalogAudit(tenantId, {
    serviceCatalogItemId: service.id,
    action: 'assignment_template_generated',
    summary: `Einsatzvorlage aus Leistung ${service.title} erzeugt`,
    payload: { taskCount: draft.tasks.length },
    actorUserId: null,
  });

  return { ok: true, data: draft };
}

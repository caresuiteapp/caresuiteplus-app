import type { ServiceResult } from '@/types';
import type {
  AssistServiceTaskTemplate,
  CreateServiceTaskTemplateInput,
} from '@/types/assistServiceCatalog';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  getAssistService,
  listServiceTaskTemplates,
  saveAssistService,
  saveServiceTaskTemplate,
} from './assistServiceCatalogStore';
import { recordAssistServiceCatalogAudit } from './auditService';

export function defineServiceTaskPackage(
  input: CreateServiceTaskTemplateInput,
): ServiceResult<AssistServiceTaskTemplate> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Aufgabenpakete im Live-Modus noch nicht angebunden.' };
  }

  const service = getAssistService(input.tenantId, input.serviceCatalogItemId);
  if (!service) return { ok: false, error: 'Leistung nicht gefunden.' };

  const now = new Date().toISOString();
  const template: AssistServiceTaskTemplate = {
    id: `asc-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    serviceCatalogItemId: input.serviceCatalogItemId,
    taskKey: input.taskKey.trim(),
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    sortOrder: input.sortOrder ?? listServiceTaskTemplates(input.tenantId, input.serviceCatalogItemId).length,
    isRequired: input.isRequired ?? true,
    estimatedMinutes: input.estimatedMinutes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  saveServiceTaskTemplate(input.tenantId, template);
  saveAssistService(input.tenantId, {
    ...service,
    defaultTaskTemplateIds: [...service.defaultTaskTemplateIds, template.id],
    updatedAt: now,
  });

  recordAssistServiceCatalogAudit(input.tenantId, {
    serviceCatalogItemId: service.id,
    action: 'task_template_added',
    summary: `Aufgabe „${template.title}" zum Paket hinzugefügt`,
    payload: { taskKey: template.taskKey },
    actorUserId: input.actorUserId ?? null,
  });

  return { ok: true, data: template };
}

export function listTaskPackagesForService(
  tenantId: string,
  serviceCatalogItemId: string,
): ServiceResult<AssistServiceTaskTemplate[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Aufgabenpakete im Live-Modus noch nicht angebunden.' };
  }

  return {
    ok: true,
    data: listServiceTaskTemplates(tenantId, serviceCatalogItemId).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

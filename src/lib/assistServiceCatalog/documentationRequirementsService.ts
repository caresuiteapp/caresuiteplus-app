import type { ServiceResult } from '@/types';
import type {
  AssistServiceDocumentationRequirement,
  SetDocumentationRequirementInput,
} from '@/types/assistServiceCatalog';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  getAssistService,
  listDocumentationRequirements,
  saveAssistService,
  saveDocumentationRequirement,
} from './assistServiceCatalogStore';
import { recordAssistServiceCatalogAudit } from './auditService';

export function setServiceDocumentationRequirement(
  input: SetDocumentationRequirementInput,
): ServiceResult<AssistServiceDocumentationRequirement> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Dokumentationspflichten im Live-Modus noch nicht angebunden.' };
  }

  const service = getAssistService(input.tenantId, input.serviceCatalogItemId);
  if (!service) return { ok: false, error: 'Leistung nicht gefunden.' };

  const now = new Date().toISOString();
  const requirement: AssistServiceDocumentationRequirement = {
    id: `asc-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    serviceCatalogItemId: input.serviceCatalogItemId,
    requirementKey: input.requirementKey.trim(),
    kind: input.kind,
    label: input.label.trim(),
    isMandatory: input.isMandatory ?? true,
    sortOrder:
      input.sortOrder ??
      listDocumentationRequirements(input.tenantId, input.serviceCatalogItemId).length,
    createdAt: now,
    updatedAt: now,
  };

  saveDocumentationRequirement(input.tenantId, requirement);

  const requiresSignature = input.kind === 'signature' || service.requiresSignature;
  const requiresDocumentation = true;
  saveAssistService(input.tenantId, {
    ...service,
    requiresSignature,
    requiresDocumentation,
    updatedAt: now,
  });

  recordAssistServiceCatalogAudit(input.tenantId, {
    serviceCatalogItemId: service.id,
    action: 'documentation_requirement_set',
    summary: `Dokumentationspflicht „${requirement.label}" gesetzt`,
    payload: { kind: requirement.kind, isMandatory: requirement.isMandatory },
    actorUserId: input.actorUserId ?? null,
  });

  return { ok: true, data: requirement };
}

export function listServiceDocumentationRequirements(
  tenantId: string,
  serviceCatalogItemId: string,
): ServiceResult<AssistServiceDocumentationRequirement[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Dokumentationspflichten im Live-Modus noch nicht angebunden.' };
  }

  return {
    ok: true,
    data: listDocumentationRequirements(tenantId, serviceCatalogItemId).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    ),
  };
}

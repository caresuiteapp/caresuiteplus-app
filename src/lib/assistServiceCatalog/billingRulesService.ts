import type { ServiceResult } from '@/types';
import type {
  AssistServiceBillingRule,
  SetServiceBillingRuleInput,
} from '@/types/assistServiceCatalog';
import { resolveTaxModeForService } from '@/lib/careBilling/serviceRateService';
import type { CareServiceAreaKey } from '@/types/careBilling';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  getAssistService,
  getServiceBillingRule,
  saveAssistService,
  saveServiceBillingRule,
} from './assistServiceCatalogStore';
import { mapAssistCategoryToCareServiceArea } from './categoryValidationService';
import { recordAssistServiceCatalogAudit } from './auditService';

export function setServiceBillingRule(
  input: SetServiceBillingRuleInput,
): ServiceResult<AssistServiceBillingRule> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Abrechnungsregeln im Live-Modus noch nicht angebunden.' };
  }

  const service = getAssistService(input.tenantId, input.serviceCatalogItemId);
  if (!service) return { ok: false, error: 'Leistung nicht gefunden.' };

  const now = new Date().toISOString();
  const existing = getServiceBillingRule(input.tenantId, input.serviceCatalogItemId);
  const rule: AssistServiceBillingRule = {
    id: existing?.id ?? `asc-bill-${Date.now()}`,
    tenantId: input.tenantId,
    serviceCatalogItemId: input.serviceCatalogItemId,
    budgetType: input.budgetType ?? (service.budgetEligible ? 'paragraph_45b' : null),
    maxMinutesPerVisit: input.maxMinutesPerVisit ?? null,
    minBillableMinutes: input.minBillableMinutes ?? 30,
    roundingMinutes: input.roundingMinutes ?? 15,
    requiresServiceProof: input.requiresServiceProof ?? true,
    notes: input.notes ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  saveServiceBillingRule(input.tenantId, rule);
  recordAssistServiceCatalogAudit(input.tenantId, {
    serviceCatalogItemId: service.id,
    action: 'billing_rule_set',
    summary: `Abrechnungsregel für ${service.title} gesetzt`,
    payload: { budgetType: rule.budgetType, requiresServiceProof: rule.requiresServiceProof },
    actorUserId: input.actorUserId ?? null,
  });

  return { ok: true, data: rule };
}

export function resolveServiceTaxMode(
  tenantId: string,
  serviceCatalogItemId: string,
  isSelfPayer: boolean,
): ServiceResult<string> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const service = getAssistService(tenantId, serviceCatalogItemId);
  if (!service) return { ok: false, error: 'Leistung nicht gefunden.' };

  const careArea = mapAssistCategoryToCareServiceArea(service.category);
  if (!careArea) {
    return { ok: true, data: service.taxMode };
  }

  const taxMode = resolveTaxModeForService(tenantId, careArea as CareServiceAreaKey, isSelfPayer);
  return { ok: true, data: taxMode };
}

export function setServiceBudgetEligibility(
  tenantId: string,
  serviceCatalogItemId: string,
  budgetEligible: boolean,
  actorUserId?: string | null,
): ServiceResult<{ budgetEligible: boolean }> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Budget-Einstellungen im Live-Modus noch nicht angebunden.' };
  }

  const service = getAssistService(tenantId, serviceCatalogItemId);
  if (!service) return { ok: false, error: 'Leistung nicht gefunden.' };

  const now = new Date().toISOString();
  const updated = { ...service, budgetEligible, updatedAt: now };
  saveAssistService(tenantId, updated);

  recordAssistServiceCatalogAudit(tenantId, {
    serviceCatalogItemId: service.id,
    action: 'service_updated',
    summary: `Budgetfähigkeit ${budgetEligible ? 'aktiviert' : 'deaktiviert'}: ${service.title}`,
    payload: { budgetEligible },
    actorUserId: actorUserId ?? null,
  });

  return { ok: true, data: { budgetEligible } };
}

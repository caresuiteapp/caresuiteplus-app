import type {
  AssistServiceBillingRule,
  AssistServiceCatalogAuditEvent,
  AssistServiceCatalogItem,
  AssistServiceDocumentationRequirement,
  AssistServiceRateVersion,
  AssistServiceTaskTemplate,
} from '@/types/assistServiceCatalog';

type TenantAssistServiceCatalogStore = {
  services: AssistServiceCatalogItem[];
  taskTemplates: AssistServiceTaskTemplate[];
  rateVersions: AssistServiceRateVersion[];
  billingRules: AssistServiceBillingRule[];
  documentationRequirements: AssistServiceDocumentationRequirement[];
  auditEvents: AssistServiceCatalogAuditEvent[];
};

const stores = new Map<string, TenantAssistServiceCatalogStore>();

function emptyStore(): TenantAssistServiceCatalogStore {
  return {
    services: [],
    taskTemplates: [],
    rateVersions: [],
    billingRules: [],
    documentationRequirements: [],
    auditEvents: [],
  };
}

function getStore(tenantId: string): TenantAssistServiceCatalogStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore();
    stores.set(tenantId, store);
  }
  return store;
}

export function resetAssistServiceCatalogStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

export function listAssistServices(tenantId: string): AssistServiceCatalogItem[] {
  return [...getStore(tenantId).services];
}

export function getAssistService(tenantId: string, serviceId: string): AssistServiceCatalogItem | null {
  return getStore(tenantId).services.find((service) => service.id === serviceId) ?? null;
}

export function getAssistServiceByKey(tenantId: string, serviceKey: string): AssistServiceCatalogItem | null {
  return getStore(tenantId).services.find((service) => service.serviceKey === serviceKey) ?? null;
}

export function saveAssistService(tenantId: string, service: AssistServiceCatalogItem): AssistServiceCatalogItem {
  const store = getStore(tenantId);
  const idx = store.services.findIndex((entry) => entry.id === service.id);
  if (idx >= 0) {
    store.services[idx] = service;
  } else {
    store.services.push(service);
  }
  return service;
}

export function listServiceTaskTemplates(
  tenantId: string,
  serviceCatalogItemId?: string,
): AssistServiceTaskTemplate[] {
  const templates = getStore(tenantId).taskTemplates;
  return serviceCatalogItemId
    ? templates.filter((template) => template.serviceCatalogItemId === serviceCatalogItemId)
    : [...templates];
}

export function saveServiceTaskTemplate(
  tenantId: string,
  template: AssistServiceTaskTemplate,
): AssistServiceTaskTemplate {
  const store = getStore(tenantId);
  const idx = store.taskTemplates.findIndex((entry) => entry.id === template.id);
  if (idx >= 0) {
    store.taskTemplates[idx] = template;
  } else {
    store.taskTemplates.push(template);
  }
  return template;
}

export function listServiceRateVersions(
  tenantId: string,
  serviceCatalogItemId?: string,
): AssistServiceRateVersion[] {
  const versions = getStore(tenantId).rateVersions;
  return serviceCatalogItemId
    ? versions.filter((version) => version.serviceCatalogItemId === serviceCatalogItemId)
    : [...versions];
}

export function saveServiceRateVersion(
  tenantId: string,
  version: AssistServiceRateVersion,
): AssistServiceRateVersion {
  const store = getStore(tenantId);
  const idx = store.rateVersions.findIndex((entry) => entry.id === version.id);
  if (idx >= 0) {
    store.rateVersions[idx] = version;
  } else {
    store.rateVersions.push(version);
  }
  return version;
}

export function getServiceBillingRule(
  tenantId: string,
  serviceCatalogItemId: string,
): AssistServiceBillingRule | null {
  return (
    getStore(tenantId).billingRules.find((rule) => rule.serviceCatalogItemId === serviceCatalogItemId) ??
    null
  );
}

export function saveServiceBillingRule(
  tenantId: string,
  rule: AssistServiceBillingRule,
): AssistServiceBillingRule {
  const store = getStore(tenantId);
  const idx = store.billingRules.findIndex((entry) => entry.serviceCatalogItemId === rule.serviceCatalogItemId);
  if (idx >= 0) {
    store.billingRules[idx] = rule;
  } else {
    store.billingRules.push(rule);
  }
  return rule;
}

export function listDocumentationRequirements(
  tenantId: string,
  serviceCatalogItemId?: string,
): AssistServiceDocumentationRequirement[] {
  const requirements = getStore(tenantId).documentationRequirements;
  return serviceCatalogItemId
    ? requirements.filter((entry) => entry.serviceCatalogItemId === serviceCatalogItemId)
    : [...requirements];
}

export function saveDocumentationRequirement(
  tenantId: string,
  requirement: AssistServiceDocumentationRequirement,
): AssistServiceDocumentationRequirement {
  const store = getStore(tenantId);
  const idx = store.documentationRequirements.findIndex((entry) => entry.id === requirement.id);
  if (idx >= 0) {
    store.documentationRequirements[idx] = requirement;
  } else {
    store.documentationRequirements.push(requirement);
  }
  return requirement;
}

export function appendAssistServiceCatalogAuditEvent(
  tenantId: string,
  event: AssistServiceCatalogAuditEvent,
): AssistServiceCatalogAuditEvent {
  getStore(tenantId).auditEvents.push(event);
  return event;
}

export function listAssistServiceCatalogAuditEvents(
  tenantId: string,
  serviceCatalogItemId?: string,
): AssistServiceCatalogAuditEvent[] {
  const events = getStore(tenantId).auditEvents;
  return serviceCatalogItemId
    ? events.filter((event) => event.serviceCatalogItemId === serviceCatalogItemId)
    : [...events];
}

export function getAssistServiceCatalogStoreSnapshot(
  tenantId: string,
): Readonly<TenantAssistServiceCatalogStore> {
  return getStore(tenantId);
}

import { getCommunicationCareSuiteTemplates } from '@/lib/communication/communicationTemplates';
import type { CareSuiteTemplate, TemplateListFilters } from '@/types/templates';

export function getCommunicationMessageTemplateDefaults(): CareSuiteTemplate[] {
  return getCommunicationCareSuiteTemplates();
}

function matchesCommunicationMessageFilters(
  template: CareSuiteTemplate,
  filters: TemplateListFilters,
): boolean {
  if (filters.scope === 'tenant') return false;
  if (filters.scope === 'system' && template.scope !== 'system') return false;
  if (filters.moduleKey && template.moduleKey !== filters.moduleKey) return false;
  if (filters.templateType && template.templateType !== filters.templateType) return false;
  if (filters.status && template.status !== filters.status) return false;
  if (filters.categoryKey && template.categoryKey !== filters.categoryKey) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = `${template.title} ${template.description ?? ''} ${template.content}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function isCommunicationMessageListQuery(filters: TemplateListFilters): boolean {
  const moduleOk = !filters.moduleKey || filters.moduleKey === 'communication';
  const typeOk = !filters.templateType || filters.templateType === 'message';
  return moduleOk && typeOk;
}

/** Merges in-app communication message templates when Supabase has none or only partial seeds. */
export function mergeCommunicationMessageTemplates(
  dbTemplates: CareSuiteTemplate[],
  filters: TemplateListFilters = {},
): CareSuiteTemplate[] {
  if (!isCommunicationMessageListQuery(filters)) return dbTemplates;

  const defaults = getCommunicationMessageTemplateDefaults().filter((template) =>
    matchesCommunicationMessageFilters(template, filters),
  );

  const byId = new Map<string, CareSuiteTemplate>();
  for (const template of defaults) {
    byId.set(template.id, template);
  }
  for (const template of dbTemplates) {
    if (template.moduleKey === 'communication' && template.templateType === 'message') {
      byId.set(template.id, template);
    }
  }

  const merged = [...byId.values()];
  merged.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'));
  return merged;
}

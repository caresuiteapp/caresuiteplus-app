import { DEFAULT_TRAVEL_COMPENSATION_POLICY } from '@/lib/travel/travelCompensationPolicy';
import type { TenantServiceCatalogItem } from '@/types/tenant/tenantCenter';

export type CatalogStandardTemplate = Readonly<Pick<TenantServiceCatalogItem,
  'serviceKey' | 'moduleKey' | 'name' | 'description' | 'unit' | 'category' | 'sortOrder'
>>;

/** Existing Assist seeds, without a suggested price or assumed tax exemption. */
const ASSIST_STANDARD_TEMPLATES: readonly CatalogStandardTemplate[] = Object.freeze(([
  {
    moduleKey: 'assist',
    serviceKey: 'assist.alltagsbegleitung',
    name: 'Alltagsbegleitung',
    description: 'Individuelle Alltagsbegleitung und Betreuung',
    unit: 'hour',
    category: 'service',
    sortOrder: 10,
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.entlastung_45b',
    name: 'Entlastungsleistung § 45b SGB XI',
    description: 'Entlastungsleistung nach § 45b SGB XI',
    unit: 'hour',
    category: 'service',
    sortOrder: 20,
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.verhinderungspflege_39',
    name: 'Verhinderungspflege § 39 SGB XI',
    description: 'Verhinderungspflege nach § 39 SGB XI',
    unit: 'hour',
    category: 'service',
    sortOrder: 30,
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.haushaltshilfe_38',
    name: 'Haushaltshilfe § 38 SGB V',
    description: 'Haushaltshilfe nach § 38 SGB V',
    unit: 'hour',
    category: 'service',
    sortOrder: 40,
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.travel.km',
    name: 'Fahrtkosten (Kilometer)',
    description: 'Kilometerpauschale für Assist-Fahrten',
    unit: 'km',
    category: 'travel',
    sortOrder: 100,
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.surcharge.weekend',
    name: 'Wochenend-Zuschlag',
    description: 'Zuschlag für Leistungen am Wochenende',
    unit: 'percent',
    category: 'surcharge',
    sortOrder: 110,
  },
] satisfies CatalogStandardTemplate[]).map((template) => Object.freeze(template)));

const NO_STANDARD_TEMPLATES: readonly CatalogStandardTemplate[] = Object.freeze([]);

export function getCatalogStandardTemplates(moduleKey: string): readonly CatalogStandardTemplate[] {
  return moduleKey === 'assist' ? ASSIST_STANDARD_TEMPLATES : NO_STANDARD_TEMPLATES;
}

function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

/** Return the saved item itself so opening a template preserves all custom values. */
export function findCatalogTemplateItem(
  items: readonly TenantServiceCatalogItem[],
  template: CatalogStandardTemplate,
): TenantServiceCatalogItem | undefined {
  const matchingModule = items.filter((item) => item.moduleKey === template.moduleKey);
  const templatePrefix = `${template.serviceKey}.template_`;
  return matchingModule.find((item) => item.serviceKey === template.serviceKey)
    ?? matchingModule.find((item) => item.serviceKey.startsWith(templatePrefix) && item.serviceKey.length > templatePrefix.length)
    ?? matchingModule.find((item) => normalizeName(item.name) === normalizeName(template.name)
      && item.category === template.category && item.unit === template.unit);
}

/** Create an unsaved draft. Reusing its key makes a retry safe after a partial save. */
export function createCatalogTemplateItem(
  template: CatalogStandardTemplate,
  items: readonly TenantServiceCatalogItem[],
  uniqueId: string,
): TenantServiceCatalogItem {
  if (!uniqueId.trim()) throw new Error('Die Vorlagenposition benötigt eine eindeutige Kennung.');
  const serviceKey = `${template.serviceKey}.template_${uniqueId}`;
  if (items.some((item) => item.serviceKey === serviceKey)) {
    throw new Error('Diese Vorlagenposition besteht bereits. Bitte die vorhandene Position öffnen.');
  }
  const lastSortOrder = items.reduce((highest, item) => item.moduleKey === template.moduleKey && Number.isFinite(item.sortOrder)
    ? Math.max(highest, item.sortOrder) : highest, 0);
  const policy = DEFAULT_TRAVEL_COMPENSATION_POLICY;
  return {
    ...template,
    id: '',
    serviceKey,
    isActive: true,
    sortOrder: Math.max(template.sortOrder, lastSortOrder + 10),
    defaultPriceNet: null,
    defaultTaxMode: null,
    travelPolicy: template.category === 'travel' ? {
      preset: policy.preset,
      logbookRouteTypes: [...policy.logbookRouteTypes],
      payrollRouteTypes: [...policy.payrollRouteTypes],
      workTimeRouteTypes: [...policy.workTimeRouteTypes],
      clientBillingRouteTypes: [...policy.clientBillingRouteTypes],
    } : null,
  };
}

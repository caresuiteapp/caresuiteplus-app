import { describe, expect, it } from 'vitest';
import {
  createCatalogTemplateItem,
  findCatalogTemplateItem,
  getCatalogStandardTemplates,
} from '@/lib/tenant/tenantServiceCatalogTemplates.web';
import { DEFAULT_TRAVEL_COMPENSATION_POLICY } from '@/lib/travel/travelCompensationPolicy';
import type { TenantServiceCatalogItem } from '@/types/tenant/tenantCenter';

const templates = getCatalogStandardTemplates('assist');
const support = templates[0]!;
const savedItem = (changes: Partial<TenantServiceCatalogItem> = {}): TenantServiceCatalogItem => ({
  ...support,
  id: 'saved-support',
  isActive: true,
  defaultPriceNet: 32.75,
  defaultTaxMode: 'standard_19',
  ...changes,
});

describe('Assist standard catalog templates', () => {
  it('offers the six existing Assist positions with their actual units and categories', () => {
    expect(templates.map(({ serviceKey, unit, category }) => [serviceKey, unit, category])).toEqual([
      ['assist.alltagsbegleitung', 'hour', 'service'],
      ['assist.entlastung_45b', 'hour', 'service'],
      ['assist.verhinderungspflege_39', 'hour', 'service'],
      ['assist.haushaltshilfe_38', 'hour', 'service'],
      ['assist.travel.km', 'km', 'travel'],
      ['assist.surcharge.weekend', 'percent', 'surcharge'],
    ]);
  });

  it.each(['pflege', 'stationaer', 'beratung', 'akademie', 'office', '', 'unknown'])('does not offer templates for %s', (moduleKey) => {
    expect(getCatalogStandardTemplates(moduleKey)).toEqual([]);
  });

  it('opens the exact legacy position before duplicate names or newer template drafts without changing it', () => {
    const legacy = savedItem({ name: 'Meine Begleitung', isActive: false, description: 'Eigene Beschreibung' });
    const sameName = savedItem({ id: 'custom', serviceKey: 'assist.custom' });
    const fromTemplate = savedItem({ id: 'from-template', serviceKey: `${support.serviceKey}.template_earlier` });
    const before = structuredClone(legacy);
    expect(findCatalogTemplateItem([sameName, fromTemplate, legacy], support)).toBe(legacy);
    expect(legacy).toEqual(before);
  });

  it('recognizes a renamed saved template before falling back to the normalized name', () => {
    const custom = savedItem({ id: 'custom', serviceKey: 'assist.custom', name: '  ALLTAGSBEGLEITUNG  ' });
    const fromTemplate = savedItem({ id: 'from-template', serviceKey: `${support.serviceKey}.template_saved`, name: 'Eigener Titel' });
    expect(findCatalogTemplateItem([custom, fromTemplate], support)).toBe(fromTemplate);
    expect(findCatalogTemplateItem([custom], support)).toBe(custom);
    expect(findCatalogTemplateItem([savedItem({ ...custom, unit: 'visit' })], support)).toBeUndefined();
    expect(findCatalogTemplateItem([savedItem({ ...custom, category: 'surcharge' })], support)).toBeUndefined();
  });

  it('matches neither keys nor names in another module', () => {
    expect(findCatalogTemplateItem([
      savedItem({ moduleKey: 'pflege' }),
      savedItem({ moduleKey: 'pflege', serviceKey: `${support.serviceKey}.template_other` }),
      savedItem({ moduleKey: 'pflege', serviceKey: 'pflege.custom' }),
    ], support)).toBeUndefined();
  });

  it('creates distinct unsaved drafts with the price and tax choice open and leaves existing items unchanged', () => {
    const items = [savedItem({ sortOrder: 130 }), savedItem({ moduleKey: 'pflege', sortOrder: 900 })];
    const before = structuredClone(items);
    const draft = createCatalogTemplateItem(support, items, 'draft-a');
    const another = createCatalogTemplateItem(support, items, 'draft-b');
    expect(draft).toMatchObject({
      id: '', serviceKey: `${support.serviceKey}.template_draft-a`, sortOrder: 140,
      isActive: true, defaultPriceNet: null, defaultTaxMode: null, travelPolicy: null,
    });
    expect(another.serviceKey).not.toBe(draft.serviceKey);
    expect(items).toEqual(before);
    expect(findCatalogTemplateItem([{ ...draft, id: 'saved-draft' }], support)?.id).toBe('saved-draft');
  });

  it('rejects missing or already-used draft identities instead of overwriting a position', () => {
    expect(() => createCatalogTemplateItem(support, [], ' ')).toThrow();
    const existing = savedItem({ serviceKey: `${support.serviceKey}.template_existing` });
    expect(() => createCatalogTemplateItem(support, [existing], 'existing')).toThrow();
    expect(existing.defaultPriceNet).toBe(32.75);
  });

  it('clones each travel policy array independently and does not activate payment or billing defaults', () => {
    const travel = templates.find((template) => template.category === 'travel')!;
    const first = createCatalogTemplateItem(travel, [], 'first').travelPolicy!;
    const second = createCatalogTemplateItem(travel, [], 'second').travelPolicy!;
    expect(first).toEqual(DEFAULT_TRAVEL_COMPENSATION_POLICY);
    for (const key of ['logbookRouteTypes', 'payrollRouteTypes', 'workTimeRouteTypes', 'clientBillingRouteTypes'] as const) {
      expect(first[key]).not.toBe(second[key]);
      expect(first[key]).not.toBe(DEFAULT_TRAVEL_COMPENSATION_POLICY[key]);
    }
    first.logbookRouteTypes.length = 0;
    first.payrollRouteTypes.push('with_client');
    first.workTimeRouteTypes.push('with_client');
    first.clientBillingRouteTypes.push('with_client');
    expect(second).toEqual(DEFAULT_TRAVEL_COMPENSATION_POLICY);
    expect(second.logbookRouteTypes.length).toBeGreaterThan(0);
    expect(second.payrollRouteTypes).toEqual([]);
    expect(second.workTimeRouteTypes).toEqual([]);
    expect(second.clientBillingRouteTypes).toEqual([]);
  });
});

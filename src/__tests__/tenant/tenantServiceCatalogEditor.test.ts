import { describe, expect, it } from 'vitest';
import { filterCompanyCatalog, formatCatalogPrice, parseCatalogAmount } from '@/lib/tenant/tenantServiceCatalogEditor';
import type { TenantServiceCatalogItem } from '@/types/tenant/tenantCenter';
const item: TenantServiceCatalogItem = { id: 'item', moduleKey: 'assist', serviceKey: 'assist.support', name: 'Alltagsbegleitung', description: 'Hilfe beim Einkauf', category: 'service', unit: 'hour', isActive: true, sortOrder: 10, defaultPriceNet: 32.75, defaultTaxMode: 'none' };

describe('company catalogue editor values', () => {
  it.each([['32,75', 32.75], ['0', 0], ['25.50', 25.5], ['1.234,56', 1234.56], ['', null], ['  ', null]] as const)('parses %s without silently discarding input', (input, expected) => { expect(parseCatalogAmount(input)).toBe(expected); });
  it.each(['12foo', '-1', 'NaN', 'Infinity', '1.2.3,45', '23,555', '1,2,3', '100000000'])('rejects malformed amount %s', (input) => { expect(parseCatalogAmount(input)).toBe('invalid'); });
  it('formats percentage surcharges as percentages and keeps zero prices visible', () => {
    expect(formatCatalogPrice({ ...item, unit: 'percent', defaultPriceNet: 25 })).toBe('25,00 %');
    expect(formatCatalogPrice({ ...item, defaultPriceNet: 0 })).toBe('0,00 € / Stunde');
    expect(formatCatalogPrice({ ...item, defaultPriceNet: null })).toBe('Preis noch offen');
  });
  it('combines categories and case-insensitive description search without exposing locked modules', () => {
    const all: TenantServiceCatalogItem[] = [item, { ...item, id: 'travel', category: 'travel', name: 'Fahrt', sortOrder: 30 }, { ...item, id: 'locked', moduleKey: 'pflege' }];
    expect(filterCompanyCatalog(all, 'service', 'EINKAUF').map((entry) => entry.id)).toEqual(['item']);
    expect(filterCompanyCatalog(all, 'travel', '').map((entry) => entry.id)).toEqual(['travel']);
    expect(filterCompanyCatalog(all, 'all', '').map((entry) => entry.id)).toEqual(['item', 'travel']);
    expect(all).toHaveLength(3);
  });
});

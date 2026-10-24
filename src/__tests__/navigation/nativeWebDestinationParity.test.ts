import { describe, expect, it } from 'vitest';
import { canonicalDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { nativeAdministrationRoute } from '@/liquid-command/navigation/nativeAdministrationModel';
import { administrationWorkspaceContext } from '@/lib/navigation/administrationWorkspaceContext';
import { COMPANY_INVENTORY_LEGACY_VIEWS } from '@/lib/navigation/companyInventoryRoute';
import { inferLiquidArea } from '@/liquid-command/navigation/routeContext';

describe('Shared Web and native destinations', () => {
  it.each([
    ['clients', '/business/office/clients'], ['people', '/business/office/employees'],
    ['inventory', '/unternehmen/inventar'], ['billing', '/business/office/invoices'],
    ['communication', '/business/messages'], ['documents', '/business/office/documents'],
    ['company', '/unternehmen'], ['timekeeping', '/business/office/time-tracking'],
    ['payroll', '/business/office/payroll'], ['portals', '/business/office/access'],
  ])('preserves the %s work area and deep-link context', (area, target) => {
    const input = `/office?area=${area}&client=client-17&month=2026-10#details`;
    const result = nativeAdministrationRoute(input);
    expect(result).toBe(`${target}?client=client-17&month=2026-10#details`);
    expect(result).toBe(canonicalDesktopCatalogRoute(input));
    expect(nativeAdministrationRoute(result)).toBe(result);
  });
  it('keeps an unknown Office work area rather than silently opening company data', () => {
    expect(nativeAdministrationRoute('/office?area=unknown&client=17')).toBe('/office?area=unknown&client=17');
  });
  it.each(Object.entries(COMPANY_INVENTORY_LEGACY_VIEWS))('opens the correct view for the old inventory link %s', (leaf, view) => {
    for (const prefix of ['/office/inventory', '/business/office/inventory']) {
      const result = nativeAdministrationRoute(`${prefix}/${leaf}?itemId=device-4&employeeId=person-2#record`);
      const [url, hash] = result.split('#');
      const [path, query] = url.split('?');
      expect(path).toBe('/unternehmen/inventar');
      expect(Object.fromEntries(new URLSearchParams(query))).toEqual({ itemId: 'device-4', employeeId: 'person-2', ansicht: view });
      expect(hash).toBe('record');
    }
  });
  it('identifies company and inventory as Office instead of Settings', () => {
    expect(administrationWorkspaceContext('/unternehmen/fuhrpark')).toMatchObject({ area: 'office', title: 'Fuhrpark' });
    expect(inferLiquidArea('/unternehmen/fuhrpark', 'office')).toBe('company');
    expect(inferLiquidArea('/unternehmen/inventar', 'office')).toBe('inventory');
  });
  it('names a document detail without displaying its database ID as the page title', () => {
    expect(administrationWorkspaceContext('/business/office/documents/4f4327a9-c37e-498d-aa81-9f61961c8071').title).toBe('Dokument ansehen');
  });
});

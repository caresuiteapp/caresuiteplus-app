export const COMPANY_INVENTORY_ROUTE = '/unternehmen/inventar';

export type CompanyInventoryView = 'stock' | 'assignments' | 'locations' | 'damage' | 'offboarding' | 'history';

/** Saved Office links keep their useful destination inside the company workspace. */
export const COMPANY_INVENTORY_LEGACY_VIEWS: Readonly<Record<string, CompanyInventoryView>> = {
  items: 'stock',
  assignments: 'assignments',
  returns: 'assignments',
  protocols: 'assignments',
  categories: 'locations',
  locations: 'locations',
  damage: 'damage',
  employees: 'offboarding',
  offboarding: 'offboarding',
  audit: 'history',
  barcode: 'stock',
  mdm: 'stock',
  settings: 'stock',
};

export function canonicalCompanyInventoryHref(href: string): string | null {
  const [pathAndQuery, hash] = href.split('#', 2);
  const [pathname, query] = pathAndQuery.split('?', 2);
  const match = /^\/(?:business\/)?office\/inventory(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return null;
  const leaf = match[1];
  const view = leaf ? COMPANY_INVENTORY_LEGACY_VIEWS[leaf] : undefined;
  if (leaf && !view) return null;
  const params = new URLSearchParams(query);
  if (view) params.set('ansicht', view);
  const search = params.toString();
  return `${COMPANY_INVENTORY_ROUTE}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}

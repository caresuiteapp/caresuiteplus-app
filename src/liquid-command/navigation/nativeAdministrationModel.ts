import { canonicalCompanyInventoryHref } from '@/lib/navigation/companyInventoryRoute';
import { canonicalDesktopCatalogRoute } from './appsWidgetsCatalogModel.shared';
/** Canonical native destinations preserve parameters while replacing retired entry points. */
export function nativeAdministrationRoute(route: string): string {
  const [path, ...query] = route.split('?');
  const suffix = query.length ? '?' + query.join('?') : '';
  if (['/office', '/business/office/dashboard'].includes(path)) return '/unternehmen' + suffix;
  if (['/office/inventory', '/business/office/inventory'].includes(path)) return '/unternehmen/inventar' + suffix;
  if (path === '/assist/einsaetze') return '/assist/assignments' + suffix;
  if (path === '/assist/kalender') return '/assist/calendar' + suffix;
  return canonicalDesktopCatalogRoute(canonicalCompanyInventoryHref(route) ?? route);
}

import { canonicalDesktopCatalogRoute } from './appsWidgetsCatalogModel.shared';
/** Canonical native destinations preserve parameters while replacing retired entry points. */
export function nativeAdministrationRoute(route: string): string {
  return canonicalDesktopCatalogRoute(route);
}

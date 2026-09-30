import { isHealthOSContextualPopupRoute } from '@/lib/navigation/healthosRoutePresentation';

/** The compact management workspace uses the former 90% size as its new 100%. */
export const MOBILE_WORKSPACE_BASE_SCALE = 0.9;
export const MOBILE_WORKSPACE_FONT_KEY = '@caresuite/mobile-workspace-font-scale.v2';

export function isMobileWorkspace(pathname: string, width: number): boolean {
  return width > 0 && width < 900 &&
    (pathname === '/' || isHealthOSContextualPopupRoute(pathname));
}

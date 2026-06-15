import type { ShellTabConfig } from '@/types/navigation/shell';
import {
  ASSIST_TABS,
  BUSINESS_TABS,
  OFFICE_TABS,
  PFLEGE_TABS,
} from './shellConfig';
import { CLIENT_INTAKE_NEW_ROUTE } from './clientRoutes';

/** Default post-login destination for business demo roles (Office hub). */
export const DEMO_BUSINESS_ENTRY_ROUTE = '/office' as const;

/** Legacy create route — must only appear in redirect stubs, not live navigation. */
export const FORBIDDEN_LEGACY_NAV_ROUTES = ['/office/clients/create'] as const;

/** Tab configs the demo user actually navigates via bottom nav. */
export const DEMO_SHELL_TAB_GROUPS: Record<string, ShellTabConfig[]> = {
  office: OFFICE_TABS,
  business: BUSINESS_TABS,
  pflege: PFLEGE_TABS,
  assist: ASSIST_TABS,
};

/** Canonical intake route for dashboard quick actions. */
export { CLIENT_INTAKE_NEW_ROUTE };

export function collectDemoTabHrefs(): string[] {
  return Object.values(DEMO_SHELL_TAB_GROUPS).flatMap((tabs) => tabs.map((t) => t.href));
}

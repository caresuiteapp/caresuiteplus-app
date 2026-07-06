import { useMemo } from 'react';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { usePortalContext } from '@/hooks/usePortalContext';
import {
  buildClientPortalPrimaryTabs,
  resolveClientPortalNavigationTabs,
} from '@/lib/navigation/clientPortalNavigation';
import { PORTAL_CLIENT_TABS } from '@/lib/navigation/shellConfig';

/** Dynamic bottom nav + drawer for Klient:innenportal. */
export function usePortalClientTabs(): ShellTabConfig[] {
  const { context } = usePortalContext();

  return useMemo(() => {
    if (!context?.hasModuleAssignments) {
      return [
        { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
        ...PORTAL_CLIENT_TABS,
      ];
    }

    return resolveClientPortalNavigationTabs();
  }, [context]);
}

/** Primary bottom tabs on phone — fixed five-tab bar. */
export function usePortalClientPrimaryTabs(): ShellTabConfig[] {
  const { context } = usePortalContext();

  return useMemo(() => {
    if (!context?.hasModuleAssignments) {
      return [
        { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
        ...PORTAL_CLIENT_TABS.slice(0, 4),
      ];
    }

    return buildClientPortalPrimaryTabs();
  }, [context]);
}

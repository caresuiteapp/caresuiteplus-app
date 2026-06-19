import { useMemo } from 'react';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { usePortalContext } from '@/hooks/usePortalContext';
import { buildPortalNavigation, portalNavToShellTabs } from '@/lib/portal/engine';
import { PORTAL_CLIENT_TABS } from '@/lib/navigation/shellConfig';

/** Dynamic bottom nav for Klient:innenportal — Übersicht + module tabs + global items. */
export function usePortalClientTabs(): ShellTabConfig[] {
  const { context } = usePortalContext();

  return useMemo(() => {
    if (!context?.hasModuleAssignments) {
      return [
        { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
        ...PORTAL_CLIENT_TABS,
      ];
    }

    return portalNavToShellTabs(
      buildPortalNavigation({
        activeModuleKeys: context.activeModuleKeys,
        hasModuleAssignments: context.hasModuleAssignments,
        primaryModule: context.primaryModule,
        visibleFeatures: context.visibleFeatures,
      }),
    );
  }, [context]);
}

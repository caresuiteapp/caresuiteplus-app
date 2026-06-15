import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'expo-router';
import type { AppShellArea } from '@/types/navigation/shell';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getModuleSwitcherItems, getTabsForArea, resolveActiveTabKey } from '@/lib/navigation/shellConfig';

export function useAppShell(area: AppShellArea) {
  const pathname = usePathname();
  const tenantId = useServiceTenantId();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const tabs = useMemo(() => getTabsForArea(area), [area]);
  const activeTabKey = useMemo(() => resolveActiveTabKey(pathname, tabs), [pathname, tabs]);
  const modules = useMemo(() => getModuleSwitcherItems(tenantId ?? ''), [tenantId]);

  const openSwitcher = useCallback(() => setSwitcherOpen(true), []);
  const closeSwitcher = useCallback(() => setSwitcherOpen(false), []);

  return {
    tabs,
    activeTabKey,
    modules,
    switcherOpen,
    openSwitcher,
    closeSwitcher,
  };
}

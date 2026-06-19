import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'expo-router';
import type { AppShellArea } from '@/types/navigation/shell';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { getModuleSwitcherItems, getTabsForArea, resolveActiveTabKey } from '@/lib/navigation/shellConfig';

export function useAppShell(area: AppShellArea) {
  const pathname = usePathname();
  const tenantId = useServiceTenantId();
  const { profile, portalSession, user } = useAuth();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const shellContext = useMemo(
    () => ({ tenantId: tenantId ?? null, roleKey }),
    [tenantId, roleKey],
  );

  const tabs = useMemo(() => getTabsForArea(area, shellContext), [area, shellContext]);
  const activeTabKey = useMemo(() => resolveActiveTabKey(pathname, tabs), [pathname, tabs]);
  const modules = useMemo(
    () => getModuleSwitcherItems(tenantId ?? '', roleKey),
    [tenantId, roleKey],
  );

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

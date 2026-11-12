import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'expo-router';
import type { AppShellArea } from '@/types/navigation/shell';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { getModuleSwitcherItems, getTabsForArea, resolveActiveTabKey } from '@/lib/navigation/shellConfig';

export function useAppShell(area: AppShellArea) {
  const pathname = usePathname();
  const { tenantId, cacheRevision, entitlementRevision } = useModuleAccess();
  const { profile, portalSession, user } = useAuth();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const shellContext = useMemo(
    () => ({ tenantId: tenantId ?? null, roleKey }),
    [tenantId, roleKey],
  );

  const tabs = useMemo(() => getTabsForArea(area, shellContext), [area, shellContext, cacheRevision, entitlementRevision]);
  const activeTabKey = useMemo(() => resolveActiveTabKey(pathname, tabs), [pathname, tabs]);
  const modules = useMemo(
    () => getModuleSwitcherItems(tenantId ?? '', roleKey),
    [tenantId, roleKey, cacheRevision, entitlementRevision],
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

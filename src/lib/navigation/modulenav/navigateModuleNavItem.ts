import type { ModuleNavItem } from '@/types/navigation/platform';
import type { Router } from 'expo-router';
import { MODULE_NAV_MODAL_SCREENS } from '@/lib/navigation/modulenav/modalscreens';
import type { OpenModalOptions } from '@/types/modalNavigation';

export function shouldOpenNavItemInModal(item: ModuleNavItem, adaptiveShell: string): boolean {
  return Boolean(
    item.openInModal &&
      item.modalKey &&
      (adaptiveShell === 'web' || adaptiveShell === 'desktop'),
  );
}

export function buildModalOpenOptions(item: ModuleNavItem): OpenModalOptions {
  const registry = item.modalKey ? MODULE_NAV_MODAL_SCREENS[item.modalKey] : undefined;
  return {
    modalKey: item.modalKey,
    title: registry?.title ?? item.label,
    subtitle: registry?.subtitle,
    maxWidth: registry?.maxWidth,
  };
}

export function navigateModuleNavItem(
  item: ModuleNavItem,
  router: Router,
  openModal: (options: OpenModalOptions) => void,
  adaptiveShell: string,
): void {
  if (shouldOpenNavItemInModal(item, adaptiveShell)) {
    openModal(buildModalOpenOptions(item));
    return;
  }
  router.push(item.href as never);
}

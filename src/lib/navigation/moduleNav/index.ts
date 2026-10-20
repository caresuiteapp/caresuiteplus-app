import type { MainModuleKey, ModuleNavConfig } from '@/types/navigation/platform';
import { adminNav } from './adminNav';
import { assistNav } from './assistNav';
import { akademieNav } from './akademieNav';
import { beratungNav } from './beratungNav';
import { officeNav } from './officeNav';
import { pflegeNav } from './pflegeNav';
import { stationaerNav } from './stationaerNav';
import { zentraleNav } from './zentraleNav';

const NAV_BY_MODULE: Record<MainModuleKey, ModuleNavConfig> = {
  admin: adminNav,
  assist: assistNav,
  akademie: akademieNav,
  beratung: beratungNav,
  office: officeNav,
  pflege: pflegeNav,
  stationaer: stationaerNav,
  zentrale: zentraleNav,
};

export function getModuleNavConfig(mainModule: MainModuleKey): ModuleNavConfig {
  return NAV_BY_MODULE[mainModule];
}

export function resolveActiveModuleNavKey(pathname: string, config: ModuleNavConfig): string {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const items = config.groups
    .flatMap((group) => group.items)
    .sort((a, b) => b.href.split('?')[0].length - a.href.split('?')[0].length);

  for (const item of items) {
    const href = item.href.split('?')[0].replace(/\/$/, '') || '/';
    if (path === href || path.startsWith(`${href}/`)) {
      return item.key;
    }
  }

  return config.groups[0]?.items[0]?.key ?? 'dashboard';
}

export { MODULE_NAV_MODAL_SCREENS } from './modalScreens';
export { navigateModuleNavItem, shouldOpenNavItemInModal, buildModalOpenOptions } from './navigateModuleNavItem';

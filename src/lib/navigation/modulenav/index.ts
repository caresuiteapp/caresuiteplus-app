import type { MainModuleKey, ModuleNavConfig } from '@/types/navigation/platform';
import { adminNav } from './adminnav';
import { assistNav } from './assistnav';
import { akademieNav } from './akademienav';
import { beratungNav } from './beratungnav';
import { officeNav } from './officenav';
import { pflegeNav } from './pflegenav';
import { stationaerNav } from './stationaernav';
import { zentraleNav } from './zentralenav';

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

export { MODULE_NAV_MODAL_SCREENS } from './modalscreens';
export { navigateModuleNavItem, shouldOpenNavItemInModal, buildModalOpenOptions } from './navigateModuleNavItem';

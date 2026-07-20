import { moduleColor } from '@/design/tokens/modules';
import type { ColorMode } from '@/design/tokens/colors';
import type { MainModuleKey } from '@/types/navigation/platform';

/** Canonical system accent — one electric blue across all product modules. */
export function resolveMainModuleAccent(
  mainModule: MainModuleKey,
  mode: ColorMode = 'dark',
): string {
  switch (mainModule) {
    case 'zentrale':
      return moduleColor('insight', mode);
    case 'office':
      return moduleColor('office', mode);
    case 'assist':
      return moduleColor('assist', mode);
    case 'pflege':
      return moduleColor('pflege', mode);
    case 'stationaer':
      return moduleColor('stationaer', mode);
    case 'beratung':
      return moduleColor('beratung', mode);
    case 'akademie':
      return moduleColor('akademie', mode);
    case 'admin':
      return moduleColor('insight', mode);
    default:
      return moduleColor('insight', mode);
  }
}

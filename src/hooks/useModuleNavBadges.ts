import { useMemo } from 'react';
import { useOfficeMessageNavBadges } from '@/hooks/useOfficeMessageNavBadges';
import type { MainModuleKey } from '@/types/navigation/platform';

/** Dynamic nav badges keyed by ModuleNavItem.key — extensible per module. */
export function useModuleNavBadges(mainModule: MainModuleKey): Record<string, string | undefined> {
  const office = useOfficeMessageNavBadges(mainModule === 'office');

  return useMemo(() => {
    switch (mainModule) {
      case 'office':
        return office.badges;
      default:
        return {};
    }
  }, [mainModule, office.badges]);
}
